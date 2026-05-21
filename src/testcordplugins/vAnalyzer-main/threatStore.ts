/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { extractDomain } from "./utils";

export { extractDomain };

export type ThreatLevel = "malicious" | "suspicious";

interface ThreatEntry {
    level: ThreatLevel;
    reasons: string[];
    timestamp: number;
}
class LRUThreatStore {
    private store = new Map<string, ThreatEntry>();
    private readonly maxSize = 10000;

    get(key: string): ThreatEntry | undefined {
        if (!this.store.has(key)) return undefined;
        // move to end (most recently used)
        const value = this.store.get(key)!;
        this.store.delete(key);
        this.store.set(key, value);
        return value;
    }

    set(key: string, value: ThreatEntry): void {
        if (this.store.has(key)) {
            this.store.delete(key);
        }
        this.store.set(key, value);

        if (this.store.size > this.maxSize) {
            const oldestKey = this.store.keys().next().value;
            if (oldestKey) {
                this.store.delete(oldestKey);
            }
        }
    }

    has(key: string): boolean {
        return this.store.has(key);
    }

    clear(): void {
        this.store.clear();
    }

    size(): number {
        return this.store.size;
    }
}

const flaggedDomains = new LRUThreatStore();

export function flagDomain(domain: string, level: ThreatLevel, reason: string) {
    const normalized = domain.toLowerCase();
    const existing = flaggedDomains.get(normalized);

    if (existing) {
        if (level === "malicious") existing.level = "malicious";
        if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
        existing.timestamp = Date.now();
        flaggedDomains.set(normalized, existing);
    } else {
        flaggedDomains.set(normalized, {
            level,
            reasons: [reason],
            timestamp: Date.now()
        });
    }
}

export function getThreat(url: string): ThreatEntry | null {
    const domain = extractDomain(url);

    // exact match
    const exact = flaggedDomains.get(domain);
    if (exact) return exact;

    // check parent domains
    const parts = domain.split(".");
    for (let i = 1; i < parts.length - 1; i++) {
        const parent = parts.slice(i).join(".");
        const entry = flaggedDomains.get(parent);
        if (entry) return entry;
    }

    return null;
}

export function clearThreats() {
    flaggedDomains.clear();
}
