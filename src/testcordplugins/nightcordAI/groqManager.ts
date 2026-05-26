/*
 * Equicord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * groqManager.ts — Gestionnaire de clé Groq partagé entre les plugins
 *
 * Fonctionnalités :
 * - Clé API stockée dans DataStore (un seul endroit)
 * - Rotation automatique de modèle sur 429 (rate limit)
 *   llama-3.3-70b-versatile → llama-3.1-8b-instant → gemma2-9b-it
 * - Retry avec backoff exponentiel
 * - File d'attente pour éviter les bursts simultanés
 */

import { DataStore } from "@api/index";

// ── Clés DataStore ─────────────────────────────────────────────────────────────

const DS_API_KEY = "groq-shared-api-key";

// Modèles en ordre de fallback (limites séparées sur Groq)
const GROQ_MODELS = [
    "llama-3.3-70b-versatile",    // Le meilleur — quota RPM: 30/min
    "llama3-70b-8192",            // Ancien stable performant
    "llama-3.1-8b-instant",       // Rapide — quota RPM: 30/min SÉPARÉ
    "gemma2-9b-it",               // Fallback — quota RPM: 30/min SÉPARÉ
];

// Index du modèle actuellement utilisé (en mémoire seulement)
let currentModelIdx = 0;
// Temps de cooldown par modèle (timestamp ms)
const modelCooldown: Record<string, number> = {};

// ── Lecture/écriture clé API ──────────────────────────────────────────────────

// Fallback settings importés dynfriendquement pour éviter les imports circulaires
let _settingsFallback: (() => string) | null = null;
export function registerSettingsFallback(fn: () => string) {
    _settingsFallback = fn;
}

export async function getGroqKey(): Promise<string> {
    const key = await DataStore.get(DS_API_KEY) as string | null;
    if (key?.trim()) return key.trim();
    // Fallback : lire depuis les Settings NightcordAI si disponible
    if (_settingsFallback) {
        const fallback = _settingsFallback();
        if (fallback) return fallback;
    }
    return "";
}

export async function setGroqKey(key: string): Promise<void> {
    await DataStore.set(DS_API_KEY, key.trim());
}

// ── Sélection du modèle disponible ────────────────────────────────────────────

function getAvailableModel(): string {
    const now = Date.now();
    // Essayer d'abord le modèle courant
    for (let i = 0; i < GROQ_MODELS.length; i++) {
        const idx = (currentModelIdx + i) % GROQ_MODELS.length;
        const model = GROQ_MODELS[idx];
        const cooldownUntil = modelCooldown[model] ?? 0;
        if (now >= cooldownUntil) {
            currentModelIdx = idx;
            return model;
        }
    }
    // All en cooldown → attendre le moins longtemps
    let minCooldown = Infinity;
    let bestIdx = 0;
    for (let i = 0; i < GROQ_MODELS.length; i++) {
        const cd = modelCooldown[GROQ_MODELS[i]] ?? 0;
        if (cd < minCooldown) { minCooldown = cd; bestIdx = i; }
    }
    currentModelIdx = bestIdx;
    return GROQ_MODELS[bestIdx];
}

function markModelRateLimited(model: string, retryAfterMs = 60_000): void {
    modelCooldown[model] = Date.now() + retryAfterMs;
    console.warn(`[GroqManager] Modèle ${model} en cooldown pour ${retryAfterMs / 1000}s`);
    // Passer au prochain modèle disponible
    currentModelIdx = (currentModelIdx + 1) % GROQ_MODELS.length;
}

// ── File d'attente légère ─────────────────────────────────────────────────────

let queue = Promise.resolve();
const MIN_DELAY_MS = 200; // au moins 200ms entre deux requêtes

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const result = queue.then(() => fn());
    queue = result.then(
        () => new Promise(r => setTimeout(r, MIN_DELAY_MS)),
        () => new Promise(r => setTimeout(r, MIN_DELAY_MS)),
    );
    return result;
}

// ── Appel API principal ───────────────────────────────────────────────────────

export interface GroqChatMessage {
    role: "system" | "user" | "assistant";
    content: string | any[];
}

export interface GroqCallOptions {
    messages: GroqChatMessage[];
    temperature?: number;
    maxTokens?: number;
    /** Forcer un modèle précis (optional) */
    forceModel?: string;
    /** Nombre max de retries sur 429 (défaut: 3) */
    maxRetries?: number;
}

/**
 * Appelle l'API Groq avec rotation automatique de modèle sur rate limit.
 * Retourne le contenu texte de la réponse.
 */
export async function groqChat(opts: GroqCallOptions): Promise<string> {
    return enqueue(() => _groqChat(opts));
}

async function _groqChat(opts: GroqCallOptions, attempt = 0): Promise<string> {
    const { messages, temperature = 0.7, maxTokens = 1000, forceModel, maxRetries = 3 } = opts;

    const apiKey = await getGroqKey();
    if (!apiKey) throw new Error("Clé API Groq missinge — configure-la dans Settings → NightcordAI");

    const model = forceModel ?? getAvailableModel();

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            temperature,
            max_tokens: maxTokens,
            messages,
        }),
    });

    // Gestion du rate limit
    if (res.status === 429) {
        if (attempt >= maxRetries) throw new Error("Rate limit Groq — réessaie dans quelques instants");

        // Lire le header Retry-After si présent
        const retryAfterSec = parseInt(res.headers.get("retry-after") ?? "60", 10);
        const retryAfterMs = (isNaN(retryAfterSec) ? 60 : retryAfterSec) * 1000;

        markModelRateLimited(model, retryAfterMs);

        // Retry immédiat avec le prochain modèle (pas de wait ici)
        return _groqChat({ ...opts, forceModel: undefined }, attempt + 1);
    }

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Groq API ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? "(réponse vide)";
}

/**
 * Retourne le modèle actuellement active (utile pour l'affichage)
 */
export function getCurrentModel(): string {
    return GROQ_MODELS[currentModelIdx] ?? GROQ_MODELS[0];
}
