/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

export interface FetchResult {
    success: boolean;
    data?: Uint8Array;
    error?: string;
}

const ALLOWED_ORIGINS = [
    "https://cdn.discordapp.com",
    "https://media.discordapp.net",
    "https://images-ext-1.discordapp.net",
    "https://images-ext-2.discordapp.net"
];

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

export async function fetchAttachment(
    _event: IpcMainInvokeEvent,
    url: unknown
): Promise<FetchResult> {
    try {
        if (typeof url !== "string") {
            return { success: false, error: "Invalid URL parameter" };
        }

        let parsedUrl: URL;
        try {
            parsedUrl = new URL(url);
        } catch {
            return { success: false, error: "Invalid URL format" };
        }

        if (!ALLOWED_ORIGINS.some(allowed => parsedUrl.origin === allowed || url.startsWith(allowed))) {
            return { success: false, error: "Domain not allowed" };
        }

        if (parsedUrl.protocol !== "https:") {
            return { success: false, error: "Only HTTPS protocol is supported" };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second timeout

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) {
            return { success: false, error: `HTTP status ${res.status}` };
        }

        const contentLength = res.headers.get("content-length");
        if (contentLength && parseInt(contentLength, 10) > MAX_SIZE) {
            return { success: false, error: "File exceeds size limit (50MB)" };
        }

        const reader = res.body?.getReader();
        if (!reader) {
            return { success: false, error: "Failed to read response body" };
        }

        const chunks: Uint8Array[] = [];
        let totalSize = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            if (totalSize + value.length > MAX_SIZE) {
                await reader.cancel();
                return { success: false, error: "File size limit exceeded during download" };
            }

            chunks.push(value);
            totalSize += value.length;
        }

        const buffer = new Uint8Array(totalSize);
        let offset = 0;
        for (const chunk of chunks) {
            buffer.set(chunk, offset);
            offset += chunk.length;
        }

        return { success: true, data: buffer };
    } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
}
