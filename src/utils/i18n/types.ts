/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * A localized string. `ar` is required (the whole point of an overlay entry is
 * to provide the Arabic translation); `en` is optional — when omitted the
 * resolver falls back to the original string the plugin already ships in source.
 */
export interface LocalizedString {
    ar: string;
    en?: string;
}

/**
 * Translation overlay for a single plugin, keyed by plugin name at the file
 * level (the filename in src/i18n/plugins/ IS the plugin name). The schema is a
 * fixed two levels — description + per-option strings — matching exactly how the
 * settings UI consumes it. No deeper namespacing: option keys are unique within
 * a plugin, so the nesting already disambiguates them.
 */
export interface PluginI18n {
    description?: LocalizedString;
    options?: Record<string, LocalizedString>;
}

/**
 * Identity helper that exists purely for the type annotation + editor support.
 * Each src/i18n/plugins/<PluginName>.ts default-exports definePluginI18n({...}).
 */
export function definePluginI18n(i18n: PluginI18n): PluginI18n {
    return i18n;
}
