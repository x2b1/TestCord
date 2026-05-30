/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isArabicMode } from "@utils/esharqI18n";
import pluginI18n from "~i18n";

import type { LocalizedString } from "./types";

/**
 * Drift tracker. Records only DRIFT — a plugin that HAS an overlay entry but is
 * missing the specific key being requested (e.g. upstream added an option and
 * the translation lagged). Plain absence (no overlay entry at all) is NOT
 * tracked: it is a permitted, often-intentional state, not an actionable gap.
 *
 * Strictly local: an in-memory deduped Set, surfaced only via getMissedI18nKeys
 * for a local debug view. Never transmitted anywhere.
 */
const missedKeys = new Set<string>();

function trackDrift(key: string): void {
    if (missedKeys.has(key)) return;
    missedKeys.add(key);
    if (IS_DEV) console.warn(`[Esharq i18n] drift — overlay exists but key missing: ${key}`);
}

function pick(str: LocalizedString, original: string): string {
    return isArabicMode() ? str.ar : (str.en ?? original);
}

/**
 * Resolve a plugin's description. Returns the overlay translation when present,
 * otherwise the original string the plugin already ships (override-or-original).
 * Never throws — a missing overlay degrades silently to the original.
 */
export function resolvePluginDescription(pluginName: string, original: string): string {
    const desc = pluginI18n[pluginName]?.description;
    return desc ? pick(desc, original) : original;
}

/**
 * Resolve a single option's description. Same override-or-original contract.
 * Fires the drift tracker only when the plugin has an options overlay but this
 * specific key is absent from it.
 */
export function resolvePluginOption(pluginName: string, key: string, original: string): string {
    const entry = pluginI18n[pluginName];
    const opt = entry?.options?.[key];
    if (!opt) {
        if (entry?.options && !(key in entry.options)) trackDrift(`${pluginName}.options.${key}`);
        return original;
    }
    return pick(opt, original);
}

/** Local-only snapshot of drifted keys observed this session, for a debug view. */
export const getMissedI18nKeys = (): string[] => [...missedKeys];
