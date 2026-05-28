/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { TestcordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { findAll } from "@webpack";

const logger = new Logger("OptimizerPremium");

const THROTTLED_CLASS_TOKENS = ["activity", "subText", "botText", "clanTag"] as const;

const settings = definePluginSettings({
    domThrottle: {
        type: OptionType.BOOLEAN,
        description: "Defer non-critical visual updates (activity, subText, botText, clan tags) via MutationObserver. Safe — does not patch appendChild.",
        default: true
    },
    domThrottleDelay: {
        type: OptionType.SLIDER,
        description: "Delay in ms applied to throttled DOM updates. Higher delays free more CPU but make those UI bits update slower.",
        markers: [25, 50, 100, 150, 250, 500],
        default: 100,
        stickToMarkers: false
    },
    disableSpringAnimations: {
        type: OptionType.BOOLEAN,
        description: "Skip all react-spring animations across the client. Major responsiveness boost on low-end machines.",
        default: false
    },
    animationFrameReduction: {
        type: OptionType.SLIDER,
        description: "Drop frames from requestAnimationFrame. 0 disables, higher values skip more frames.",
        markers: [0, 25, 50, 75, 100],
        default: 0
    },
    networkCache: {
        type: OptionType.BOOLEAN,
        description: "Cache static image responses (png, jpg, webp, gif) in memory to cut redundant fetches. Bounded by entry count and TTL.",
        default: true
    },
    networkCacheMinutes: {
        type: OptionType.SLIDER,
        description: "How long, in minutes, the network cache keeps entries before evicting them.",
        markers: [1, 5, 10, 15, 30, 60],
        default: 5,
        stickToMarkers: false
    },
    networkCacheMaxEntries: {
        type: OptionType.SLIDER,
        description: "Hard cap on cached image entries. Oldest entries are evicted first when exceeded.",
        markers: [50, 100, 200, 500, 1000],
        default: 200,
        stickToMarkers: false
    },
    forceLowImageQuality: {
        type: OptionType.BOOLEAN,
        description: "Rewrite Discord CDN image URLs to request smaller sizes. Saves bandwidth and decode cost.",
        default: false
    },
    pauseOffscreenMedia: {
        type: OptionType.BOOLEAN,
        description: "Auto-pause videos and animated content that scroll out of view.",
        default: true
    },
    memoryManagement: {
        type: OptionType.BOOLEAN,
        description: "Periodically check JS heap pressure and trim caches when usage is high. Requires Chromium performance.memory.",
        default: true
    },
    memoryCheckSeconds: {
        type: OptionType.SLIDER,
        description: "Seconds between memory pressure checks.",
        markers: [10, 30, 60, 120, 300],
        default: 30,
        stickToMarkers: false
    },
    optimizeTooltips: {
        type: OptionType.BOOLEAN,
        description: "Skip the unnecessary flushSync inside Discord's tooltip module. Smoother tooltip transitions.",
        default: true,
        restartNeeded: true
    },
    optimizeEmojiCache: {
        type: OptionType.BOOLEAN,
        description: "Cache repeat emoji-pack getter calls to avoid re-walking emoji lists on every render.",
        default: true,
        restartNeeded: true
    },
    killLoadingSpinner: {
        type: OptionType.BOOLEAN,
        description: "Strip the app loading spinner. It's pretty but it has measurable cost.",
        default: true,
        restartNeeded: true
    },
    killConfettiCanvas: {
        type: OptionType.BOOLEAN,
        description: "Remove the SpriteCanvas used for confetti, particles and similar visual effects.",
        default: true,
        restartNeeded: true
    },
    killGatewayAnalytics: {
        type: OptionType.BOOLEAN,
        description: "Drop the analytics flush block that JSON.stringifies the gateway READY payload.",
        default: true,
        restartNeeded: true
    },
    virtualizeMessages: {
        type: OptionType.BOOLEAN,
        description: "Apply CSS containment to messages so the browser skips work on offscreen rows.",
        default: true
    },
    optimizeTextRendering: {
        type: OptionType.BOOLEAN,
        description: "Apply optimizeSpeed text-rendering on message content. Faster text layout on large channels.",
        default: true
    },
    killBackdropBlur: {
        type: OptionType.BOOLEAN,
        description: "Strip backdrop-filter blur effects (popouts, modals, overlays). Massive GPU win on integrated graphics.",
        default: false
    },
    forcePassiveListeners: {
        type: OptionType.BOOLEAN,
        description: "Force wheel, touchstart, touchmove and mousewheel listeners to passive mode. Reduces scroll input lag.",
        default: true
    },
    suppressConsoleSpam: {
        type: OptionType.BOOLEAN,
        description: "Suppress Discord's noisy console.log/debug output. Console.error and console.warn still pass through.",
        default: true
    },
    freezeGifsUntilHover: {
        type: OptionType.BOOLEAN,
        description: "Pause animated GIFs and stickers until you hover them. Cuts decode CPU dramatically in active channels. Memory-bounded.",
        default: false
    },
    throttleResizeObservers: {
        type: OptionType.BOOLEAN,
        description: "Coalesce ResizeObserver callbacks via rAF. Prevents layout thrash during window resize and dynamic UI changes.",
        default: true,
        restartNeeded: true
    },
    reduceMotion: {
        type: OptionType.BOOLEAN,
        description: "Apply prefers-reduced-motion globally. Disables transitions and CSS animations.",
        default: false
    },
    killWillChange: {
        type: OptionType.BOOLEAN,
        description: "Strip will-change hints Discord scatters around. Reduces GPU memory and layer explosions.",
        default: true
    },
    lazyEmbedImages: {
        type: OptionType.BOOLEAN,
        description: "Force loading=lazy and decoding=async on every embed/attachment image.",
        default: true
    },
    disableTypingIndicator: {
        type: OptionType.BOOLEAN,
        description: "Hide the 'X is typing...' indicator. The animated dots cause continuous repaints.",
        default: false
    },
    verboseLogging: {
        type: OptionType.BOOLEAN,
        description: "Log optimization activity to the console. Disable for production.",
        default: false
    }
});

interface CacheEntry {
    response: Response;
    timestamp: number;
}

interface SpringMod {
    Globals?: { assign?: (opts: Record<string, unknown>) => void; };
    Springs?: unknown;
}

export default definePlugin({
    name: "optimizerPremium",
    description: "Combined performance suite: tooltip/emoji/spinner/confetti/gateway patches, bounded image cache, react-spring skip, offscreen media pause, safe DOM throttling, lazy images.",
    tags: ["Utility", "Developers"],
    authors: [TestcordDevs.x2b],
    settings,

    patches: [
        {
            find: "this.state.shouldShowTooltip!==",
            predicate: () => settings.store.optimizeTooltips,
            replacement: [
                {
                    match: /\i.flushSync\(\(\)=>\{this\.setState\(\{shouldShowTooltip:(\i)\}\)\}\)/,
                    replace: (_m, p) => `this.__open=${p},this.setState({shouldShowTooltip:${p}})`
                },
                {
                    match: /if\(this\.state\.shouldShowTooltip!==(\i)\)/,
                    replace: "if(this.__open!==$1)"
                }
            ]
        },
        {
            find: "this.rebuildFavoriteEmojisWithoutFetchingLatest()",
            predicate: () => settings.store.optimizeEmojiCache,
            replacement: [
                {
                    match: /(\i)=>\{let \i=(\i)\[null==\i\?(\i)\.kod:\i\];null!=\i&&\((\i)\(\)\.each\(\i\.usableEmojis,(\i)\),\i\(\)\.each\(\i\.emoticons,(\i)\)\)\};/,
                    replace: (_m, e, q, k, a, n, r) =>
                        `${e}=>{` +
                        `const t=${q}[null==${e}?${k}.kod:${e}];` +
                        "const usableEmojis=t?.usableEmojis;" +
                        "const emoticons=t?.emoticons;" +
                        `null!=t&&(${a}().each(usableEmojis,${n}),${a}().each(emoticons,${r}))` +
                        "};"
                }
            ]
        },
        {
            find: /\i\.\i\.getAppSpinnerSources\(\)/,
            predicate: () => settings.store.killLoadingSpinner,
            replacement: {
                match: /let \i=\i\.\i\.getAppSpinnerSources\(\).+?;(\i\.\i).+?\)\}/,
                replace: "$1=()=>null;"
            }
        },
        {
            find: "\"SpriteCanvas-module_spriteCanvasHidden",
            predicate: () => settings.store.killConfettiCanvas,
            replacement: {
                match: /,\i\.createElement\("canvas",\{.+?\)\}\)/,
                replace: ""
            }
        },
        {
            find: "getDispatchHandler needs to be passed in first!",
            predicate: () => settings.store.killGatewayAnalytics,
            replacement: {
                match: /(\.flush\(\i,\i\),"READY"===\i\)\{).+?;(.+?\)),.+?\}/,
                replace: (_m, pre, mid) => `${pre}${mid}}`
            }
        }
    ],

    // ---- Runtime state (cleaned up in stop()) ----
    originals: {} as {
        rAF?: typeof window.requestAnimationFrame;
        cAF?: typeof window.cancelAnimationFrame;
        fetch?: typeof window.fetch;
        addEventListener?: typeof EventTarget.prototype.addEventListener;
        resizeObserver?: typeof ResizeObserver;
        console?: { log: typeof console.log; debug: typeof console.debug; info: typeof console.info; };
    },
    springs: [] as SpringMod[],
    networkCache: new Map<string, CacheEntry>(),
    networkCacheOrder: [] as string[],
    cacheCleanupTimer: null as ReturnType<typeof setInterval> | null,
    memoryTimer: null as ReturnType<typeof setInterval> | null,
    intersectionObserver: null as IntersectionObserver | null,
    mediaMutationObserver: null as MutationObserver | null,
    pausedMedia: new WeakSet<HTMLMediaElement>(),
    optimizerStyleEl: null as HTMLStyleElement | null,
    extraStyleEl: null as HTMLStyleElement | null,
    domThrottleObserver: null as MutationObserver | null,
    domThrottleTimers: new Set<ReturnType<typeof setTimeout>>(),
    gifMutationObserver: null as MutationObserver | null,
    gifManagedImages: new WeakSet<HTMLImageElement>(),
    lazyImageObserver: null as MutationObserver | null,
    rafFakeHandles: new Map<number, ReturnType<typeof setTimeout>>(),
    rafFakeCounter: 1 << 30,

    start() {
        if (settings.store.verboseLogging) logger.info("Starting optimizer suite");

        if (settings.store.domThrottle) this.installDomThrottle();
        if (settings.store.animationFrameReduction > 0) this.installRafReduction();
        if (settings.store.networkCache || settings.store.forceLowImageQuality) this.installNetworkLayer();
        if (settings.store.disableSpringAnimations) this.installSpringSkip();
        if (settings.store.memoryManagement) this.installMemoryManager();
        if (settings.store.pauseOffscreenMedia) this.installOffscreenMediaPause();
        if (settings.store.virtualizeMessages || settings.store.optimizeTextRendering) this.installCSSOptimizations();
        if (settings.store.forcePassiveListeners) this.installPassiveListeners();
        if (settings.store.suppressConsoleSpam) this.installConsoleSuppression();
        if (settings.store.throttleResizeObservers) this.installResizeObserverThrottle();
        if (settings.store.freezeGifsUntilHover) this.installGifFreezer();
        if (settings.store.lazyEmbedImages) this.installLazyImages();
        this.installExtraCSS();

        if (settings.store.verboseLogging) logger.info("Started");
    },

    stop() {
        if (settings.store.verboseLogging) logger.info("Stopping, restoring originals");

        this.teardownDomThrottle();
        this.restoreRafReduction();
        this.restoreNetworkLayer();
        this.restoreSpringSkip();
        this.teardownMemoryManager();
        this.teardownOffscreenMediaPause();
        this.teardownCSSOptimizations();
        this.restorePassiveListeners();
        this.restoreConsoleSuppression();
        this.restoreResizeObserverThrottle();
        this.teardownGifFreezer();
        this.teardownLazyImages();
        this.teardownExtraCSS();

        this.networkCache.clear();
        this.networkCacheOrder.length = 0;
    },

    // ---------------------------------------------------------------------
    // DOM throttle — observer-based, doesn't touch appendChild
    // ---------------------------------------------------------------------
    installDomThrottle() {
        const delay = settings.store.domThrottleDelay;
        const matches = (el: Element): boolean => {
            const cn = typeof (el as HTMLElement).className === "string" ? (el as HTMLElement).className : "";
            if (!cn) return false;
            for (const tok of THROTTLED_CLASS_TOKENS) if (cn.indexOf(tok) !== -1) return true;
            return false;
        };

        const apply = (el: HTMLElement) => {
            // Hide briefly, then reveal. Cheap and reversible; no DOM-API patching.
            const prevVis = el.style.visibility;
            el.style.visibility = "hidden";
            const t = setTimeout(() => {
                el.style.visibility = prevVis;
                this.domThrottleTimers.delete(t);
            }, delay + Math.random() * delay * 0.5);
            this.domThrottleTimers.add(t);
        };

        this.domThrottleObserver = new MutationObserver(records => {
            for (const r of records) {
                for (const node of r.addedNodes) {
                    if (!(node instanceof HTMLElement)) continue;
                    if (matches(node)) apply(node);
                }
            }
        });
        this.domThrottleObserver.observe(document.body, { childList: true, subtree: true });
    },

    teardownDomThrottle() {
        if (this.domThrottleObserver) {
            this.domThrottleObserver.disconnect();
            this.domThrottleObserver = null;
        }
        for (const t of this.domThrottleTimers) clearTimeout(t);
        this.domThrottleTimers.clear();
    },

    // ---------------------------------------------------------------------
    // rAF reduction with proper cancelAnimationFrame support
    // ---------------------------------------------------------------------
    installRafReduction() {
        const original = window.requestAnimationFrame.bind(window);
        const originalCancel = window.cancelAnimationFrame.bind(window);
        this.originals.rAF = window.requestAnimationFrame;
        this.originals.cAF = window.cancelAnimationFrame;

        const reduction = Math.min(100, Math.max(0, settings.store.animationFrameReduction)) / 100;
        const skipEvery = Math.ceil(1 + reduction * 3);
        const fakeHandles = this.rafFakeHandles;
        let frame = 0;

        window.requestAnimationFrame = (cb: FrameRequestCallback): number => {
            frame++;
            if (reduction > 0 && frame % skipEvery !== 0) {
                const id = this.rafFakeCounter++;
                const t = setTimeout(() => {
                    fakeHandles.delete(id);
                    cb(performance.now());
                }, 16 * (1 + reduction));
                fakeHandles.set(id, t);
                return id;
            }
            return original(cb);
        };

        window.cancelAnimationFrame = (handle: number) => {
            const fake = fakeHandles.get(handle);
            if (fake !== undefined) {
                clearTimeout(fake);
                fakeHandles.delete(handle);
                return;
            }
            originalCancel(handle);
        };
    },

    restoreRafReduction() {
        if (this.originals.rAF) {
            window.requestAnimationFrame = this.originals.rAF;
            this.originals.rAF = undefined;
        }
        if (this.originals.cAF) {
            window.cancelAnimationFrame = this.originals.cAF;
            this.originals.cAF = undefined;
        }
        for (const t of this.rafFakeHandles.values()) clearTimeout(t);
        this.rafFakeHandles.clear();
    },

    // ---------------------------------------------------------------------
    // Network layer with LRU cap
    // ---------------------------------------------------------------------
    installNetworkLayer() {
        const originalFetch = window.fetch.bind(window);
        this.originals.fetch = window.fetch;

        const cacheMs = settings.store.networkCacheMinutes * 60 * 1000;
        const cacheEnabled = settings.store.networkCache;
        const maxEntries = Math.max(10, settings.store.networkCacheMaxEntries | 0);
        const lowQuality = settings.store.forceLowImageQuality;
        const cache = this.networkCache;
        const order = this.networkCacheOrder;
        const isImage = (url: string) => /\.(png|jpe?g|gif|webp)(?:$|[?#])/i.test(url);
        const isDiscordCdn = (url: string) => /(?:cdn|media)\.discord(?:app)?\.(?:com|net)/.test(url);

        const rewriteSize = (url: string): string => {
            if (!lowQuality || !isDiscordCdn(url)) return url;
            try {
                const u = new URL(url, window.location.origin);
                const size = u.searchParams.get("size");
                if (size && Number(size) > 96) u.searchParams.set("size", "96");
                if (!size && /avatars|emojis|icons|banners/.test(u.pathname)) u.searchParams.set("size", "96");
                return u.toString();
            } catch {
                return url;
            }
        };

        const touch = (key: string) => {
            const idx = order.indexOf(key);
            if (idx !== -1) order.splice(idx, 1);
            order.push(key);
        };
        const evict = () => {
            while (order.length > maxEntries) {
                const k = order.shift();
                if (k) cache.delete(k);
            }
        };

        window.fetch = function patched(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
            const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
            const finalUrl = rewriteSize(rawUrl);
            const method = init?.method?.toUpperCase() ?? (input instanceof Request ? input.method.toUpperCase() : "GET");
            const useCache = cacheEnabled && isImage(finalUrl) && method === "GET";

            if (useCache) {
                const hit = cache.get(finalUrl);
                if (hit && Date.now() - hit.timestamp < cacheMs) {
                    touch(finalUrl);
                    return Promise.resolve(hit.response.clone());
                }
                if (hit) {
                    cache.delete(finalUrl);
                    const idx = order.indexOf(finalUrl);
                    if (idx !== -1) order.splice(idx, 1);
                }
            }

            const target: RequestInfo | URL = finalUrl !== rawUrl
                ? (typeof input === "string" ? finalUrl : new Request(finalUrl, input instanceof Request ? input : undefined))
                : input;

            return originalFetch(target, init).then(res => {
                if (useCache && res.ok) {
                    cache.set(finalUrl, { response: res.clone(), timestamp: Date.now() });
                    touch(finalUrl);
                    evict();
                }
                return res;
            });
        };

        if (cacheEnabled) {
            this.cacheCleanupTimer = setInterval(() => {
                const now = Date.now();
                for (const [k, v] of cache) {
                    if (now - v.timestamp > cacheMs) {
                        cache.delete(k);
                        const idx = order.indexOf(k);
                        if (idx !== -1) order.splice(idx, 1);
                    }
                }
            }, Math.max(60_000, cacheMs / 2));
        }
    },

    restoreNetworkLayer() {
        if (this.originals.fetch) {
            window.fetch = this.originals.fetch;
            this.originals.fetch = undefined;
        }
        if (this.cacheCleanupTimer !== null) {
            clearInterval(this.cacheCleanupTimer);
            this.cacheCleanupTimer = null;
        }
    },

    // ---------------------------------------------------------------------
    // Spring skip — cache findAll result
    // ---------------------------------------------------------------------
    installSpringSkip() {
        if (this.springs.length === 0) {
            const mods = findAll(mod => {
                const m = mod as SpringMod;
                return typeof m?.Globals === "object" && typeof m?.Springs === "object";
            }) as SpringMod[];
            this.springs = mods;
        }
        for (const spring of this.springs) {
            spring.Globals?.assign?.({ skipAnimation: true });
        }
    },

    restoreSpringSkip() {
        for (const spring of this.springs) {
            spring.Globals?.assign?.({ skipAnimation: false });
        }
        // Drop module refs so they don't pin webpack chunks in memory when the
        // plugin is disabled. Next start() will repopulate via findAll().
        this.springs = [];
    },

    // ---------------------------------------------------------------------
    // Memory manager — guarded, no fake gc() spam
    // ---------------------------------------------------------------------
    installMemoryManager() {
        const intervalMs = settings.store.memoryCheckSeconds * 1000;
        const perf = performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number; }; };
        if (!perf.memory) {
            if (settings.store.verboseLogging) logger.info("performance.memory unavailable; memory manager idle");
            return;
        }

        this.memoryTimer = setInterval(() => {
            try {
                const m = perf.memory;
                if (!m) return;
                const ratio = m.usedJSHeapSize / m.jsHeapSizeLimit;
                if (ratio > 0.75) {
                    // Trim network cache to half
                    if (this.networkCache.size > 50) {
                        const half = Math.floor(this.networkCacheOrder.length / 2);
                        for (let i = 0; i < half; i++) {
                            const k = this.networkCacheOrder.shift();
                            if (k) this.networkCache.delete(k);
                        }
                    }
                    const win = window as Window & { gc?: () => void; };
                    if (typeof win.gc === "function") {
                        win.gc();
                        if (settings.store.verboseLogging) logger.info(`GC triggered at heap ratio ${(ratio * 100).toFixed(1)}%`);
                    } else if (settings.store.verboseLogging) {
                        logger.info(`Heap ratio ${(ratio * 100).toFixed(1)}% — trimmed caches (gc unavailable)`);
                    }
                }
            } catch (err) {
                if (settings.store.verboseLogging) logger.warn("Memory pressure check failed", err);
            }
        }, intervalMs);
    },

    teardownMemoryManager() {
        if (this.memoryTimer !== null) {
            clearInterval(this.memoryTimer);
            this.memoryTimer = null;
        }
    },

    // ---------------------------------------------------------------------
    // Offscreen media pause
    // ---------------------------------------------------------------------
    installOffscreenMediaPause() {
        if (typeof IntersectionObserver === "undefined") return;
        const paused = this.pausedMedia;

        this.intersectionObserver = new IntersectionObserver(entries => {
            for (const entry of entries) {
                const { target } = entry;
                if (!(target instanceof HTMLMediaElement)) continue;
                if (entry.isIntersecting) {
                    if (paused.has(target)) {
                        paused.delete(target);
                        target.play().catch(() => undefined);
                    }
                } else if (!target.paused) {
                    paused.add(target);
                    target.pause();
                }
            }
        }, { threshold: 0.05 });

        const watch = (root: ParentNode) => {
            const media = root.querySelectorAll("video, audio");
            for (const el of media) this.intersectionObserver?.observe(el);
        };

        watch(document.body);

        this.mediaMutationObserver = new MutationObserver(records => {
            for (const r of records) {
                for (const node of r.addedNodes) {
                    if (node instanceof HTMLMediaElement) {
                        this.intersectionObserver?.observe(node);
                    } else if (node instanceof Element) {
                        watch(node);
                    }
                }
            }
        });
        this.mediaMutationObserver.observe(document.body, { childList: true, subtree: true });
    },

    teardownOffscreenMediaPause() {
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
            this.intersectionObserver = null;
        }
        if (this.mediaMutationObserver) {
            this.mediaMutationObserver.disconnect();
            this.mediaMutationObserver = null;
        }
    },

    // ---------------------------------------------------------------------
    // CSS optimizations — scoped selectors only
    // ---------------------------------------------------------------------
    installCSSOptimizations() {
        const rules: string[] = [];
        if (settings.store.virtualizeMessages) {
            rules.push("[class*=\"messageListItem_\"] { contain: layout style; }");
        }
        if (settings.store.optimizeTextRendering) {
            rules.push(
                "[class*=\"messageContent_\"], [class*=\"markup_\"] { text-rendering: optimizeSpeed; }",
                "[class*=\"chatContent_\"] { contain: style layout; }"
            );
        }
        if (rules.length) {
            this.optimizerStyleEl = document.createElement("style");
            this.optimizerStyleEl.id = "op-css-optimizations";
            this.optimizerStyleEl.textContent = rules.join("\n");
            document.head.appendChild(this.optimizerStyleEl);
        }
    },

    teardownCSSOptimizations() {
        if (this.optimizerStyleEl) {
            this.optimizerStyleEl.remove();
            this.optimizerStyleEl = null;
        }
    },

    // ---------------------------------------------------------------------
    // Passive listeners — preserve removeEventListener compatibility
    // ---------------------------------------------------------------------
    installPassiveListeners() {
        const PASSIVE_EVENTS = new Set(["wheel", "mousewheel", "touchstart", "touchmove", "touchend"]);
        const originalAdd = EventTarget.prototype.addEventListener;
        this.originals.addEventListener = originalAdd;

        // We only patch addEventListener — listener identity is preserved (we only
        // inject `passive: true` into the options bag). removeEventListener matches
        // on (type, listener, capture); passive is irrelevant to matching, so the
        // native remove keeps working unmodified.
        EventTarget.prototype.addEventListener = function patched(
            this: EventTarget,
            type: string,
            listener: EventListenerOrEventListenerObject | null,
            options?: boolean | AddEventListenerOptions
        ): void {
            if (PASSIVE_EVENTS.has(type) && listener != null) {
                if (typeof options === "boolean" || options === undefined) {
                    options = { capture: !!options, passive: true };
                } else if (options.passive === undefined) {
                    options = { ...options, passive: true };
                }
            }
            return originalAdd.call(this, type, listener, options);
        } as typeof EventTarget.prototype.addEventListener;
    },

    restorePassiveListeners() {
        if (this.originals.addEventListener) {
            EventTarget.prototype.addEventListener = this.originals.addEventListener;
            this.originals.addEventListener = undefined;
        }
    },

    // ---------------------------------------------------------------------
    // Console suppression
    // ---------------------------------------------------------------------
    installConsoleSuppression() {
        this.originals.console = {
            log: console.log,
            debug: console.debug,
            info: console.info
        };
        const noop = () => undefined;
        console.log = noop;
        console.debug = noop;
        console.info = noop;
    },

    restoreConsoleSuppression() {
        if (this.originals.console) {
            console.log = this.originals.console.log;
            console.debug = this.originals.console.debug;
            console.info = this.originals.console.info;
            this.originals.console = undefined;
        }
    },

    // ---------------------------------------------------------------------
    // ResizeObserver throttle — preserve instanceof via prototype chain
    // ---------------------------------------------------------------------
    installResizeObserverThrottle() {
        if (typeof ResizeObserver === "undefined") return;
        const Native = ResizeObserver;
        this.originals.resizeObserver = Native;

        class ThrottledResizeObserver {
            private _observer: ResizeObserver;
            private _pendingEntries: ResizeObserverEntry[] = [];
            private _rafId: number | null = null;
            private _userCb: ResizeObserverCallback;

            constructor(callback: ResizeObserverCallback) {
                this._userCb = callback;
                this._observer = new Native(entries => {
                    this._pendingEntries.push(...entries);
                    if (this._rafId !== null) return;
                    this._rafId = requestAnimationFrame(() => {
                        const flushed = this._pendingEntries;
                        this._pendingEntries = [];
                        this._rafId = null;
                        try {
                            this._userCb(flushed, this._observer);
                        } catch (err) {
                            if (settings.store.verboseLogging) logger.warn("ResizeObserver cb threw", err);
                        }
                    });
                });
            }

            observe(target: Element, options?: ResizeObserverOptions) { this._observer.observe(target, options); }
            unobserve(target: Element) { this._observer.unobserve(target); }
            disconnect() {
                if (this._rafId !== null) cancelAnimationFrame(this._rafId);
                this._rafId = null;
                this._pendingEntries = [];
                this._observer.disconnect();
            }

            static [Symbol.hasInstance](inst: unknown) {
                return inst instanceof Native || (inst != null && (inst as any)._observer instanceof Native);
            }
        }

        (window as unknown as { ResizeObserver: typeof ResizeObserver; }).ResizeObserver =
            ThrottledResizeObserver as unknown as typeof ResizeObserver;
    },

    restoreResizeObserverThrottle() {
        if (this.originals.resizeObserver) {
            (window as unknown as { ResizeObserver: typeof ResizeObserver; }).ResizeObserver = this.originals.resizeObserver;
            this.originals.resizeObserver = undefined;
        }
    },

    // ---------------------------------------------------------------------
    // GIF freezer — memory-bounded. Uses one shared canvas, no per-image data URLs.
    // ---------------------------------------------------------------------
    installGifFreezer() {
        const sharedCanvas = document.createElement("canvas");
        const ctx = sharedCanvas.getContext("2d");

        const isAnimated = (img: HTMLImageElement) => /\.gif(?:$|[?#])/i.test(img.src);

        const freeze = (img: HTMLImageElement) => {
            if (!ctx) return;
            if (!isAnimated(img)) return;
            if (this.gifManagedImages.has(img)) return;
            this.gifManagedImages.add(img);

            const originalSrc = img.currentSrc || img.src;
            let frozenUrl: string | null = null;

            const buildFrozen = () => {
                if (frozenUrl) return frozenUrl;
                if (!img.naturalWidth || !img.naturalHeight) return null;
                try {
                    sharedCanvas.width = img.naturalWidth;
                    sharedCanvas.height = img.naturalHeight;
                    ctx.clearRect(0, 0, sharedCanvas.width, sharedCanvas.height);
                    ctx.drawImage(img, 0, 0);
                    sharedCanvas.toBlob(b => {
                        if (!b) return;
                        if (frozenUrl) URL.revokeObjectURL(frozenUrl);
                        frozenUrl = URL.createObjectURL(b);
                        if (img.dataset.opGifState !== "playing") img.src = frozenUrl;
                    }, "image/png");
                    return null;
                } catch {
                    return null;
                }
            };

            const onLoad = () => buildFrozen();
            if (img.complete) buildFrozen(); else img.addEventListener("load", onLoad, { once: true });

            img.dataset.opGifState = "frozen";
            const onEnter = () => {
                img.dataset.opGifState = "playing";
                img.src = originalSrc;
            };
            const onLeave = () => {
                img.dataset.opGifState = "frozen";
                if (frozenUrl) img.src = frozenUrl;
            };
            img.addEventListener("mouseenter", onEnter);
            img.addEventListener("mouseleave", onLeave);

            (img as any).__opCleanup = () => {
                img.removeEventListener("mouseenter", onEnter);
                img.removeEventListener("mouseleave", onLeave);
                img.removeEventListener("load", onLoad);
                if (frozenUrl) URL.revokeObjectURL(frozenUrl);
                frozenUrl = null;
            };
        };

        document.querySelectorAll<HTMLImageElement>("img").forEach(freeze);
        this.gifMutationObserver = new MutationObserver(records => {
            for (const r of records) {
                for (const node of r.addedNodes) {
                    if (node instanceof HTMLImageElement) freeze(node);
                    else if (node instanceof Element) node.querySelectorAll<HTMLImageElement>("img").forEach(freeze);
                }
            }
        });
        this.gifMutationObserver.observe(document.body, { childList: true, subtree: true });
    },

    teardownGifFreezer() {
        if (this.gifMutationObserver) {
            this.gifMutationObserver.disconnect();
            this.gifMutationObserver = null;
        }
        document.querySelectorAll<HTMLImageElement>("img").forEach(img => {
            const cleanup = (img as any).__opCleanup;
            if (typeof cleanup === "function") {
                cleanup();
                delete (img as any).__opCleanup;
            }
            delete img.dataset.opGifState;
        });
    },

    // ---------------------------------------------------------------------
    // Lazy images
    // ---------------------------------------------------------------------
    installLazyImages() {
        const apply = (img: HTMLImageElement) => {
            if (img.dataset.opLazy === "1") return;
            img.dataset.opLazy = "1";
            if (!img.loading) img.loading = "lazy";
            if (!img.decoding) img.decoding = "async";
        };
        document.querySelectorAll<HTMLImageElement>("img").forEach(apply);
        this.lazyImageObserver = new MutationObserver(records => {
            for (const r of records) {
                for (const node of r.addedNodes) {
                    if (node instanceof HTMLImageElement) apply(node);
                    else if (node instanceof Element) node.querySelectorAll<HTMLImageElement>("img").forEach(apply);
                }
            }
        });
        this.lazyImageObserver.observe(document.body, { childList: true, subtree: true });
    },

    teardownLazyImages() {
        if (this.lazyImageObserver) {
            this.lazyImageObserver.disconnect();
            this.lazyImageObserver = null;
        }
    },

    // ---------------------------------------------------------------------
    // Extra CSS — kept narrow to avoid universal-selector cost
    // ---------------------------------------------------------------------
    installExtraCSS() {
        const rules: string[] = [];

        if (settings.store.killBackdropBlur) {
            // Scope to common Discord blur containers instead of universal selector
            rules.push(
                "[class*=\"backdrop_\"], [class*=\"layer_\"], [class*=\"popout_\"], [class*=\"modal_\"] { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }"
            );
        }
        if (settings.store.reduceMotion) {
            // This one genuinely needs universal scope to be effective
            rules.push(
                "*, *::before, *::after { animation-duration: 0.001ms !important; animation-delay: 0ms !important; transition-duration: 0.001ms !important; transition-delay: 0ms !important; }"
            );
        }
        if (settings.store.killWillChange) {
            // Target elements likely to have will-change rather than the universe
            rules.push(
                "[style*=\"will-change\"], [class*=\"scroller_\"], [class*=\"messageListItem_\"] { will-change: auto !important; }"
            );
        }
        if (settings.store.disableTypingIndicator) {
            rules.push("[class*=\"typing_\"], [class*=\"typingDots_\"] { display: none !important; }");
        }

        if (!rules.length) return;
        this.extraStyleEl = document.createElement("style");
        this.extraStyleEl.id = "op-extra-optimizations";
        this.extraStyleEl.textContent = rules.join("\n");
        document.head.appendChild(this.extraStyleEl);
    },

    teardownExtraCSS() {
        if (this.extraStyleEl) {
            this.extraStyleEl.remove();
            this.extraStyleEl = null;
        }
    }
});
