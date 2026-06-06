/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";

import type { NativeOSINTResponse } from "./native";

const DS_API_KEY = "testcord-osint-api-key";
const DS_API_URL = "testcord-osint-api-url";
const DS_MODEL = "testcord-osint-model";

// ── Native IPC fetch ────────────────────────────────────────────────────────

let _nativeFetch: ((url: string, method: string, headers: Record<string, string>, body?: string) => Promise<NativeOSINTResponse>) | null = null;

function getNativeFetch() {
    if (_nativeFetch) return _nativeFetch;
    try {
        const vn = (globalThis as any).VencordNative;
        if (vn?.pluginHelpers?.TestcordOSINT?.osintFetch) {
            _nativeFetch = vn.pluginHelpers.TestcordOSINT.osintFetch;
            return _nativeFetch;
        }
    } catch { /* renderer-only mode */ }
    return null;
}

export async function osintFetch(url: string, method: string, headers: Record<string, string>, body?: string): Promise<Response> {
    const native = getNativeFetch();
    if (native) {
        const res = await native(url, method, headers, body);
        if (res.error) throw new Error(res.error);
        return new Response(res.body, {
            status: res.status,
            headers: res.headers ?? {},
        });
    }
    return fetch(url, { method, headers, body });
}

// ── DataStore read/write ────────────────────────────────────────────────────

export async function getApiKey(): Promise<string> {
    const key = await DataStore.get(DS_API_KEY) as string | null;
    return key?.trim() ?? "";
}

export async function setApiKey(key: string): Promise<void> {
    await DataStore.set(DS_API_KEY, key.trim());
}

export async function getApiUrl(): Promise<string> {
    const url = await DataStore.get(DS_API_URL) as string | null;
    return url?.trim() ?? "";
}

export async function setApiUrl(url: string): Promise<void> {
    await DataStore.set(DS_API_URL, url.trim());
}

export async function getModel(): Promise<string> {
    const model = await DataStore.get(DS_MODEL) as string | null;
    return model?.trim() ?? "";
}

export async function setModel(model: string): Promise<void> {
    await DataStore.set(DS_MODEL, model.trim());
}

// ── Provider URL resolution ─────────────────────────────────────────────────

export function resolveApiUrl(provider: string, customUrl?: string): string {
    if (provider === "custom" || provider === "localhost") {
        const base = customUrl?.trim() || "http://localhost:11434";
        return `${base.replace(/\/+$/, "")}/v1/chat/completions`;
    }
    switch (provider) {
        case "openai":
            return "https://api.openai.com/v1/chat/completions";
        case "groq":
            return "https://api.groq.com/openai/v1/chat/completions";
        case "anthropic":
            return "https://api.anthropic.com/v1/messages";
        case "together":
            return "https://api.together.xyz/v1/chat/completions";
        case "openrouter":
            return "https://openrouter.ai/api/v1/chat/completions";
        default:
            return "https://api.groq.com/openai/v1/chat/completions";
    }
}

// ── Main AI call ────────────────────────────────────────────────────────────

export interface OSINTAIMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface OSINTAICallOptions {
    messages: OSINTAIMessage[];
    provider: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    customUrl?: string;
}

export async function callAI(opts: OSINTAICallOptions): Promise<string> {
    const { messages, provider, temperature = 0.3, maxTokens = 4000, customUrl } = opts;

    const apiKey = await getApiKey();
    const modelOverride = await getModel();
    const model = opts.model || modelOverride || getDefaultModel(provider);

    const url = resolveApiUrl(provider, customUrl);

    if (provider === "anthropic") {
        return callAnthropic(url, apiKey, messages, model, temperature, maxTokens);
    }

    return callOpenAICompatible(url, apiKey, messages, model, temperature, maxTokens);
}

function getDefaultModel(provider: string): string {
    switch (provider) {
        case "groq": return "llama-3.3-70b-versatile";
        case "openai": return "gpt-4o";
        case "anthropic": return "claude-sonnet-4-20250514";
        case "together": return "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo";
        case "openrouter": return "meta-llama/llama-3.3-70b-instruct";
        case "localhost": return "llama3";
        case "custom": return "default";
        default: return "llama-3.3-70b-versatile";
    }
}

async function callOpenAICompatible(
    url: string,
    apiKey: string,
    messages: OSINTAIMessage[],
    model: string,
    temperature: number,
    maxTokens: number
): Promise<string> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const res = await osintFetch(url, "POST", headers, JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        messages,
    }));

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`AI API ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? "(empty response)";
}

async function callAnthropic(
    url: string,
    apiKey: string,
    messages: OSINTAIMessage[],
    model: string,
    temperature: number,
    maxTokens: number
): Promise<string> {
    const systemMsg = messages.find(m => m.role === "system");
    const userMsgs = messages.filter(m => m.role !== "system");

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
    };

    const res = await osintFetch(url, "POST", headers, JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        system: systemMsg?.content ?? "",
        messages: userMsgs.map(m => ({ role: m.role, content: m.content })),
    }));

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    return data.content?.[0]?.text?.trim() ?? "(empty response)";
}
