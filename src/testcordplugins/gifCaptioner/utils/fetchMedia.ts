/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { PluginNative } from "@utils/types";

const CORS_PROXIES = [
    "https://corsproxy.io/?url=",
];

const DISCORD_MEDIA_SUFFIXES = [
    "discordapp.com",
    "discordapp.net",
];

type NativeGifCaptioner = PluginNative<typeof import("../native")>;

interface NativeFetchResult {
    contentType?: string;
    data: Uint8Array;
}

interface FetchResult {
    buffer: ArrayBuffer;
    contentType: string;
}

function withProxy(base: string, url: string) {
    return base + encodeURIComponent(url);
}

function normalizeBuffer(data: Uint8Array): ArrayBuffer {
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    return copy.buffer;
}

function normalizeUrl(url: string) {
    return url.startsWith("//") ? `https:${url}` : url;
}

function isDiscordMediaHost(host: string) {
    return DISCORD_MEDIA_SUFFIXES.some(suffix => host.endsWith(suffix));
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object";
}

function getNativeModule(value: unknown): NativeGifCaptioner | null {
    if (!isRecord(value)) return null;

    const { fetchMedia } = value;
    if (typeof fetchMedia !== "function") return null;

    return value as NativeGifCaptioner;
}

async function tryFetch(url: string): Promise<FetchResult | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;

        const buffer = await response.arrayBuffer();
        if (!buffer.byteLength) return null;

        return {
            buffer,
            contentType: response.headers.get("content-type") ?? ""
        };
    } catch {
        return null;
    }
}

function getNative(): NativeGifCaptioner | null {
    if (IS_WEB || !VencordNative?.pluginHelpers) return null;

    const helpers = VencordNative.pluginHelpers as Record<string, unknown>;
    const direct = getNativeModule(helpers.GifCaptioner);
    if (direct) return direct;

    for (const candidate of Object.values(helpers)) {
        const native = getNativeModule(candidate);
        if (native) return native;
    }

    return null;
}

async function fetchNative(url: string): Promise<FetchResult | null> {
    const native = getNative();
    if (!native?.fetchMedia) return null;

    try {
        const result = await native.fetchMedia(url) as NativeFetchResult | null;
        if (!result?.data?.length) return null;

        return {
            buffer: normalizeBuffer(result.data),
            contentType: result.contentType ?? ""
        };
    } catch {
        return null;
    }
}

async function fetchSingle(url: string): Promise<FetchResult | null> {
    const normalizedUrl = normalizeUrl(url);
    const native = await fetchNative(normalizedUrl);
    if (native) return native;

    let host = "";
    try {
        host = new URL(normalizedUrl).host;
    } catch { }

    const shouldProxyFirst = !!host && !isDiscordMediaHost(host);

    const tryDirect = () => tryFetch(normalizedUrl);
    const tryProxies = async () => {
        for (const proxy of CORS_PROXIES) {
            const proxied = await tryFetch(withProxy(proxy, normalizedUrl));
            if (proxied) return proxied;
        }

        return null;
    };

    if (shouldProxyFirst) {
        const proxied = await tryProxies();
        if (proxied) return proxied;
    }

    const direct = await tryDirect();
    if (direct) return direct;

    return await tryProxies();
}

export async function fetchMedia(
    url: string | string[],
    validate?: (result: FetchResult) => boolean
): Promise<FetchResult | null> {
    const urls = Array.isArray(url) ? url : [url];

    for (const entry of urls) {
        if (!entry) continue;

        const result = await fetchSingle(entry);
        if (!result) continue;
        if (validate && !validate(result)) continue;

        return result;
    }

    return null;
}
