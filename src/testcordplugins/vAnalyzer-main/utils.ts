/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@utils/css";
import { Toasts } from "@webpack/common";

export const cl = classNameFactory("vc-analyze-");

export function safeToast(message: string, type: string = Toasts.Type.MESSAGE) {
    try {
        Toasts.show({ message, id: Toasts.genId(), type });
    } catch { }
}

export function extractDomain(url: string): string {
    try {
        return new URL(url).hostname.toLowerCase();
    } catch {
        try {
            return new URL("https://" + url).hostname.toLowerCase();
        } catch {
            return url;
        }
    }
}

export function pruneMap<V>(map: Map<string, V>, isExpired: (value: V) => boolean, maxSize: number) {
    for (const [key, value] of map.entries()) {
        if (isExpired(value)) map.delete(key);
    }
    while (map.size > maxSize) {
        const oldestKey = map.keys().next().value;
        if (!oldestKey) break;
        map.delete(oldestKey);
    }
}

const DISCORD_CDN_FILE_REGEX = /^https?:\/\/(?:cdn|media)\.discord(?:app)?\.(?:com|net)\/attachments\//i;

export interface CdnFileInfo {
    url: string;
    fileName: string;
}

export function extractCdnFileUrls(urls: string[]): CdnFileInfo[] {
    const files: CdnFileInfo[] = [];
    for (const url of urls) {
        if (!DISCORD_CDN_FILE_REGEX.test(url)) continue;
        try {
            const pathname = new URL(url).pathname;
            const lastSegment = pathname.split("/").pop() ?? "";
            const fileName = decodeURIComponent(lastSegment);
            if (fileName && fileName.includes(".")) {
                files.push({ url, fileName });
            }
        } catch {
            // invalid URL
        }
    }
    return files;
}

export function truncateUrl(url: string, maxLen = 60): string {
    if (url.length > maxLen) {
        return url.slice(0, maxLen - 3) + "...";
    }
    return url;
}

export interface AnalysisValue {
    details: Array<{
        message: string;
        type: "safe" | "suspicious" | "malicious" | "neutral" | "error";
        discordConnectedMembers?: Array<{
            id: string;
            username: string;
            status: string;
            avatar_url: string;
            activityName?: string;
        }>;
        discordPresenceCount?: number;
    }>;
    timestamp: number;
}

export class ConcurrencyLimiter {
    private queue: (() => Promise<any>)[] = [];
    private running = 0;
    private readonly maxConcurrent: number;

    constructor(maxConcurrent: number = 3) {
        this.maxConcurrent = maxConcurrent;
    }

    async run<T>(task: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            const wrappedTask = async () => {
                try {
                    const result = await task();
                    resolve(result);
                } catch (error) {
                    reject(error);
                } finally {
                    this.running--;
                    this.processQueue();
                }
            };

            this.queue.push(wrappedTask);
            this.processQueue();
        });
    }

    private processQueue() {
        while (this.running < this.maxConcurrent && this.queue.length > 0) {
            this.running++;
            const task = this.queue.shift();
            if (task) {
                task().catch(() => {
                    // error already handled in run()
                });
            }
        }
    }

    clear() {
        this.queue = [];
        this.running = 0;
    }
}

export const analyzerLimiter = new ConcurrencyLimiter(3);