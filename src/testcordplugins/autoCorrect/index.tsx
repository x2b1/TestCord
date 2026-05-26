/*
 * Equicord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { React } from "@webpack/common";
import { groqChat, getGroqKey } from "../nightcordAI/groqManager";
import { showApiKeyWarning } from "@utils/apiKeyWarning";

// ── Settings ───────────────────────────────────────────────────────────────────

const settings = definePluginSettings({
    isActive: {
        type: OptionType.BOOLEAN,
        description: "Enable automatic correction",
        default: true,
    },
    language: {
        type: OptionType.SELECT,
        description: "Correction language",
        options: [
            { label: "English", value: "en", default: true },
            { label: "French", value: "fr" },
            { label: "Spanish", value: "es" },
            { label: "German", value: "de" },
            { label: "Italian", value: "it" },
            { label: "Portuguese", value: "pt" },
        ],
    },
    aggressiveness: {
        type: OptionType.SELECT,
        description: "Correction level",
        options: [
            { label: "Soft — obvious mistakes only", value: "low", default: true },
            { label: "Normal — mistakes + style", value: "medium" },
            { label: "Aggressive — full rewrite", value: "high" },
        ],
        default: "low",
    },
});

// ── Correction via groqManager ────────────────────────────────────────────────

const LANG_PROMPTS: Record<string, string> = {
    fr: "Tu es un correcteur orthographique. Corrige UNIQUEMENT les fautes d'orthographe et de grammaire. Retourne le texte corrigé sans explication ni guillemets. INTERDIT: ajouter des mots, changer le sens, reformuler. Si le texte est correct, retourne-le identique.",
    en: "You are a spell-checker. Fix ONLY spelling and grammar mistakes. Return the corrected text without explanation or quotes. FORBIDDEN: adding words, changing meaning, rephrasing. If already correct, return as-is.",
    es: "Eres un corrector ortográfico. Corrige SOLO errores ortográficos y gramaticales. Devuelve el texte corrigé sans explication. PROHIBIDO: añadir palabras, cambiar el sentido.",
    de: "Du bist ein Rechtschreibprüfer. Korrigiere NUR Rechtschreib- und Grammatikfehler. Gib den korrigierten Text ohne Erklärung zurück. VERBOTEN: Wörter hinzufügen, Bedeutung ändern.",
    it: "Sei un correttore ortografico. Correggi SOLO errori ortografici e grammaticali. Restituisci il testo corretto senza spiegazioni. VIETATO: aggiungere parole, cambiare il significato.",
    pt: "Você é um corretor ortográfico. Corrija SOMENTE erros ortográficos e gramaticais. Retorne o texto corrigido sem explicação. PROIBIDO: adicionar palavras, mudar o sentido.",
};

const AGGR_SUFFIX: Record<string, string> = {
    low: " STRICT INSTRUCTION: DO NOT FIX STYLE. ONLY fix obvious typos and basic grammar. DO NOT change the choice of words. KEEP THE TEXT AS IDENTICAL AS POSSIBLE. Return ONLY the text.",
    medium: " Fix mistakes and slightly improve clarity if necessary, but don't change the meaning.",
    high: " Fix everything and rewrite for perfect, fluid, and professional text.",
};

async function correctText(text: string): Promise<string> {
    if (text.trim().length < 3) return text;

    const lang = settings.store.language ?? "en";
    const aggr = settings.store.aggressiveness ?? "low";
    const systemPrompt = (LANG_PROMPTS[lang] ?? LANG_PROMPTS.en) + (AGGR_SUFFIX[aggr] ?? "");

    try {
        const corrected = await groqChat({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: text },
            ],
            temperature: 0,
            maxTokens: 512,
            // Forcer un modèle léger pour la correction — économise le quota du 70B pour l'IA
            forceModel: "llama-3.1-8b-instant",
        });

        if (!corrected || corrected.trim() === "" || corrected === text) return text;

        // Sécurité contre les répétitions infinies ou les hallucinations
        if (corrected.toLowerCase().includes("correction:") || corrected.toLowerCase().includes("text:")) return text;

        // Sécurité : réponse trop différente → on n'applique pas
        if (corrected.length > text.length * 1.5 || corrected.length < text.length * 0.4) return text;

        // En mode low : vérification plus stricte du nombre de mots
        if (aggr === "low") {
            const srcWords = text.trim().split(/\s+/).filter(w => w.length > 0).length;
            const corrWords = corrected.trim().split(/\s+/).filter(w => w.length > 0).length;
            // Mode soft ne doit pas ajouter/enlever plus d'un mot sur des phrases courtes
            if (Math.abs(corrWords - srcWords) > Math.max(1, Math.floor(srcWords * 0.15))) {
                console.log("[AutoCorrect] Soft mode rejected: word count changed too much", { srcWords, corrWords });
                return text;
            }
        }
        return corrected.replace(/^"(.*)"$/, '$1').trim(); // Nettoie les guillemets éventuels
    } catch (e: any) {
        console.warn("[AutoCorrect] Error correction:", e.message);
        return text; // En cas d'error, envoyer le texte original
    }
}



// ── Chat Bar Button ────────────────────────────────────────────────────────────

function AutoCorrectIcon({ enabled }: { enabled: boolean; }) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
                fill="currentColor"
                d="M8.87 2.31A.5.5 0 0 1 9.34 2h10.92c.36 0 .6.36.47.69l-.6 1.5a.5.5 0 0 1-.47.31h-4.28l-4.17 15h4.05c.36 0 .6.36.47.69l-.6 1.5a.5.5 0 0 1-.47.31H3.74a.5.5 0 0 1-.47-.69l.6-1.5a.5.5 0 0 1 .47-.31h4.28l4.17-15H8.74a.5.5 0 0 1-.47-.69l.6-1.5Z"
                opacity={enabled ? 1 : 0.35}
            />
            {!enabled && (
                <path
                    fill="var(--status-danger)"
                    d="M21.178 1.707 22.592 3.12 4.12 21.593l-1.414-1.415L21.178 1.707Z"
                />
            )}
        </svg>
    );
}

const AutoCorrectChatBarButton: ChatBarButtonFactory = ({ type }) => {
    const [enabled, setEnabled] = React.useState(settings.store.isActive);
    const validChat = ["normal", "sidebar"].some(x => type.analyticsName === x);
    if (!validChat) return null;

    const toggle = async () => {
        if (!enabled) {
            // Vérifie que la clé API est configurée avant d'activer
            const key = await getGroqKey();
            if (!key) {
                showApiKeyWarning("AutoCorrect");
                return;
            }
        }
        settings.store.isActive = !settings.store.isActive;

        setEnabled(settings.store.isActive);
    };

    const tooltip = enabled
        ? "AutoCorrect: enabled — click to disable"
        : "AutoCorrect: disabled — click to enable";

    return (
        <ChatBarButton tooltip={tooltip} onClick={toggle}>
            <AutoCorrectIcon enabled={enabled} />
        </ChatBarButton>
    );
};

// ── Plugin ─────────────────────────────────────────────────────────────────────

export default definePlugin({
    name: "AutoCorrectNC",
    enabledByDefault: true,
    description: "Automatically corrects spelling and grammar before sending. Requires a free Groq API key configured in NightcordAI.",
    authors: [{ name: "Nightcord", id: 0n }],
    settings,

    start() { },

    chatBarButton: {
        icon: () => <AutoCorrectIcon enabled={settings.store.isActive} />,
        render: AutoCorrectChatBarButton,
    },

    async onBeforeMessageSend(_channelId: string, message: { content: string; }) {
        if (!settings.store.isActive) return;
        if (!message.content || message.content.trim().length < 3) return;

        const corrected = await correctText(message.content);
        if (corrected && corrected !== message.content) {
            message.content = corrected;
        }
    },
});

