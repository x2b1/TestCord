/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useLayoutEffect } from "@webpack/common";

import { useForceUpdater } from "./react";
import { CSP_MAX_ENTRIES } from "./cacheLimits";

const cssRelevantDirectives = ["style-src", "style-src-elem", "img-src", "font-src"] as const;

export const CspBlockedUrls = new Set<string>();
const CspErrorListeners = new Set<() => void>();

document.addEventListener("securitypolicyviolation", ({ effectiveDirective, blockedURI }) => {
    if (!blockedURI || !cssRelevantDirectives.includes(effectiveDirective as any)) return;

    CspBlockedUrls.add(blockedURI);
    if (CSP_MAX_ENTRIES < Infinity && CspBlockedUrls.size > CSP_MAX_ENTRIES) {
        const first = CspBlockedUrls.values().next().value;
        if (first !== undefined) CspBlockedUrls.delete(first);
    }

    CspErrorListeners.forEach(listener => listener());
});

export function useCspErrors() {
    const forceUpdate = useForceUpdater();

    useLayoutEffect(() => {
        CspErrorListeners.add(forceUpdate);

        return () => void CspErrorListeners.delete(forceUpdate);
    }, [forceUpdate]);

    return [...CspBlockedUrls] as const;
}
