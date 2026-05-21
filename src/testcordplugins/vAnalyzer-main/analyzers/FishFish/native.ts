/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

let cachedDomains: Set<string> | null = null;
let lastFetch = 0;
const CACHE_TTL = 60 * 60 * 1000;

async function fetchDomainList(): Promise<Set<string>> {
    const now = Date.now();
    if (cachedDomains && (now - lastFetch) < CACHE_TTL) {
        return cachedDomains;
    }

    const res = await fetch("https://api.fishfish.gg/v1/domains", {
        headers: {
            "accept": "application/json",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
        }
    });

    if (!res.ok) {
        throw new Error(`FishFish fetch failed: HTTP ${res.status}`);
    }

    const domains: string[] = await res.json();
    cachedDomains = new Set(domains.map(d => d.toLowerCase()));
    lastFetch = now;
    return cachedDomains;
}

export async function queryFishFish(_: IpcMainInvokeEvent, domain: string): Promise<{ found: boolean; error?: string; }> {
    try {
        const domainSet = await fetchDomainList();
        const normalizedDomain = domain.toLowerCase();

        // exact domain match
        let found = domainSet.has(normalizedDomain);

        // check parent domains 
        if (!found) {
            const parts = normalizedDomain.split(".");
            for (let i = 1; i < parts.length - 1; i++) {
                const parent = parts.slice(i).join(".");
                if (domainSet.has(parent)) {
                    found = true;
                    break;
                }
            }
        }

        return { found };
    } catch (e) {
        return { found: false, error: String(e) };
    }
}
