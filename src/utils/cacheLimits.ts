export let DIFF_CACHE_MAX = 500;
export let TRANSLATION_CACHE_MAX = 200;
export let ZIP_CACHE_MAX = 50;
export let CACHED_MESSAGES_MAX = 2000;
export let TOTALS_MAX = 1000;
export let CSP_MAX_ENTRIES = 100;

export function setCacheLimits(limits: Partial<{
    diff: number;
    translation: number;
    zip: number;
    messages: number;
    totals: number;
    csp: number;
}>) {
    if (limits.diff !== undefined) DIFF_CACHE_MAX = limits.diff;
    if (limits.translation !== undefined) TRANSLATION_CACHE_MAX = limits.translation;
    if (limits.zip !== undefined) ZIP_CACHE_MAX = limits.zip;
    if (limits.messages !== undefined) CACHED_MESSAGES_MAX = limits.messages;
    if (limits.totals !== undefined) TOTALS_MAX = limits.totals;
    if (limits.csp !== undefined) CSP_MAX_ENTRIES = limits.csp;
}

export function resetCacheLimits() {
    DIFF_CACHE_MAX = 500;
    TRANSLATION_CACHE_MAX = 200;
    ZIP_CACHE_MAX = 50;
    CACHED_MESSAGES_MAX = 2000;
    TOTALS_MAX = 1000;
    CSP_MAX_ENTRIES = 100;
}

export function disableCacheLimits() {
    DIFF_CACHE_MAX = Infinity;
    TRANSLATION_CACHE_MAX = Infinity;
    ZIP_CACHE_MAX = Infinity;
    CACHED_MESSAGES_MAX = Infinity;
    TOTALS_MAX = Infinity;
    CSP_MAX_ENTRIES = Infinity;
}
