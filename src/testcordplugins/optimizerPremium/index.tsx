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
        description: "Throttle non-critical DOM insertions for activity, subText, botText and clan tags. Reduces main-thread blocking from frequent profile and member-list updates.",
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
        description: "Cache static image responses (png, jpg, webp, gif) in memory to cut redundant fetches.",
        default: true
    },
    networkCacheMinutes: {
        type: OptionType.SLIDER,
        description: "How long, in minutes, the network cache keeps entries before evicting them.",
        markers: [1, 5, 10, 15, 30, 60],
        default: 5,
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
        description: "Periodically check JS heap pressure and request a GC pass when usage is high.",
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
        description: "Apply content-visibility:auto to messages so the browser skips rendering offscreen ones. Saves CPU/RAM without breaking scroll.",
        default: true
    },
    optimizeTextRendering: {
        type: OptionType.BOOLEAN,
        description: "Apply optimizeSpeed text-rendering and reduce subpixel work on message content. Faster text layout on large channels.",
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
        description: "Pause animated GIFs and stickers until you hover them. Cuts decode CPU dramatically in active channels.",
        default: false
    },
    throttleResizeObservers: {
        type: OptionType.BOOLEAN,
        description: "Coalesce ResizeObserver callbacks via rAF. Prevents layout thrash during window resize and dynamic UI changes.",
        default: true
    },
    reduceMotion: {
        type: OptionType.BOOLEAN,
        description: "Apply prefers-reduced-motion globally. Disables transitions, transforms and CSS animations across the client.",
        default: false
    },
    killWillChange: {
        type: OptionType.BOOLEAN,
        description: "Strip will-change hints Discord scatters everywhere. Reduces GPU memory and layer explosions.",
        default: true
    },
    lazyEmbedImages: {
        type: OptionType.BOOLEAN,
        description: "Force loading=lazy and decoding=async on every embed/attachment image. Faster scroll past media-heavy channels.",
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

type AnyFn = (...args: unknown[]) => unknown;

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
    description: "Combined performance suite. Bundles OpenOptimizer DOM throttling, perf module patches, react-spring skip, image and network caching, GC pressure handling and a few extras.",
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

    originals: {} as {
        appendChild?: typeof Element.prototype.appendChild;
        removeChild?: typeof Element.prototype.removeChild;
        rAF?: typeof window.requestAnimationFrame;
        fetch?: typeof window.fetch;
    },
    springs: [] as SpringMod[],
    networkCache: new Map<string, CacheEntry>(),
    cacheCleanupTimer: null as ReturnType<typeof setInterval> | null,
    memoryTimer: null as ReturnType<typeof setInterval> | null,
    intersectionObserver: null as IntersectionObserver | null,
    pausedMedia: new WeakSet<HTMLMediaElement>(),
    optimizerStyleEl: null as HTMLStyleElement | null,
    extraStyleEl: null as HTMLStyleElement | null,
    originalAddEventListener: null as typeof EventTarget.prototype.addEventListener | null,
    originalConsole: null as { log: typeof console.log; debug: typeof console.debug; info: typeof console.info; } | null,
    originalResizeObserver: null as typeof ResizeObserver | null,
    gifMutationObserver: null as MutationObserver | null,
    lazyImageObserver: null as MutationObserver | null,

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

        this.restoreDomThrottle();
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
    },

    installDomThrottle() {
        const delay = settings.store.domThrottleDelay;
        const wrap = (orig: AnyFn) => {
            return function patched(this: Element, ...args: unknown[]) {
                const node = args[0] as { className?: unknown; } | undefined;
                if (node && typeof node.className === "string") {
                    const cn = node.className;
                    for (const tok of THROTTLED_CLASS_TOKENS) {
                        if (cn.indexOf(tok) !== -1) {
                            return setTimeout(() => orig.apply(this, args), delay + Math.random() * delay * 0.5);
                        }
                    }
                }
                return orig.apply(this, args);
            };
        };

        this.originals.appendChild = Element.prototype.appendChild;
        this.originals.removeChild = Element.prototype.removeChild;
        Element.prototype.appendChild = wrap(Element.prototype.appendChild as unknown as AnyFn) as typeof Element.prototype.appendChild;
        Element.prototype.removeChild = wrap(Element.prototype.removeChild as unknown as AnyFn) as typeof Element.prototype.removeChild;
    },

    restoreDomThrottle() {
        if (this.originals.appendChild) {
            Element.prototype.appendChild = this.originals.appendChild;
            this.originals.appendChild = undefined;
        }
        if (this.originals.removeChild) {
            Element.prototype.removeChild = this.originals.removeChild;
            this.originals.removeChild = undefined;
        }
    },

    installRafReduction() {
        const original = window.requestAnimationFrame.bind(window);
        this.originals.rAF = window.requestAnimationFrame;

        const reduction = Math.min(100, Math.max(0, settings.store.animationFrameReduction)) / 100;
        const skipEvery = Math.ceil(1 + reduction * 3);
        let frame = 0;

        window.requestAnimationFrame = function patched(cb: FrameRequestCallback): number {
            frame++;
            if (reduction > 0 && frame % skipEvery !== 0) {
                return setTimeout(() => cb(performance.now()), 16 * (1 + reduction)) as unknown as number;
            }
            return original(cb);
        };
    },

    restoreRafReduction() {
        if (this.originals.rAF) {
            window.requestAnimationFrame = this.originals.rAF;
            this.originals.rAF = undefined;
        }
    },

    installNetworkLayer() {
        const originalFetch = window.fetch.bind(window);
        this.originals.fetch = window.fetch;

        const cacheMs = settings.store.networkCacheMinutes * 60 * 1000;
        const cacheEnabled = settings.store.networkCache;
        const lowQuality = settings.store.forceLowImageQuality;
        const cache = this.networkCache;
        const isImage = (url: string) => /\.(png|jpe?g|gif|webp)/i.test(url);
        const isDiscordCdn = (url: string) => /(?:cdn|media)\.discord(?:app)?\.(?:com|net)/.test(url);

        const rewriteSize = (url: string): string => {
            if (!lowQuality || !isDiscordCdn(url)) return url;
            try {
                const u = new URL(url, window.location.origin);
                const size = u.searchParams.get("size");
                if (size && Number(size) > 96) u.searchParams.set("size", "96");
                if (!size && /avatars|emojis|icons|banners/.test(u.pathname)) u.searchParams.set("size", "96");
                u.searchParams.delete("quality");
                u.searchParams.set("quality", "lossless");
                return u.toString();
            } catch {
                return url;
            }
        };

        window.fetch = function patched(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
            const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
            const finalUrl = rewriteSize(rawUrl);
            const useCache = cacheEnabled && isImage(finalUrl) && (!init || init.method === undefined || init.method.toUpperCase() === "GET");

            if (useCache) {
                const hit = cache.get(finalUrl);
                if (hit && Date.now() - hit.timestamp < cacheMs) {
                    return Promise.resolve(hit.response.clone());
                }
            }

            const target: RequestInfo | URL = finalUrl !== rawUrl
                ? (typeof input === "string" ? finalUrl : new Request(finalUrl, input instanceof Request ? input : undefined))
                : input;

            return originalFetch(target, init).then(res => {
                if (useCache && res.ok) {
                    cache.set(finalUrl, { response: res.clone(), timestamp: Date.now() });
                }
                return res;
            });
        };

        if (cacheEnabled) {
            this.cacheCleanupTimer = setInterval(() => {
                const now = Date.now();
                for (const [k, v] of cache) {
                    if (now - v.timestamp > cacheMs) cache.delete(k);
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

    installSpringSkip() {
        const mods = findAll(mod => {
            const m = mod as SpringMod;
            return typeof m.Globals === "object" && typeof m.Springs === "object";
        }) as SpringMod[];

        this.springs = mods;
        for (const spring of mods) {
            spring.Globals?.assign?.({ skipAnimation: true });
        }
    },

    restoreSpringSkip() {
        for (const spring of this.springs) {
            spring.Globals?.assign?.({ skipAnimation: false });
        }
        this.springs = [];
    },

    installMemoryManager() {
        const intervalMs = settings.store.memoryCheckSeconds * 1000;
        this.memoryTimer = setInterval(() => {
            try {
                const perf = performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number; }; };
                if (!perf.memory) return;
                const ratio = perf.memory.usedJSHeapSize / perf.memory.jsHeapSizeLimit;
                if (ratio > 0.75) {
                    const win = window as Window & { gc?: () => void; };
                    if (typeof win.gc === "function") {
                        win.gc();
                        if (settings.store.verboseLogging) logger.info(`GC triggered at heap ratio ${(ratio * 100).toFixed(1)}%`);
                    }
                    if (this.networkCache.size > 50) {
                        const sorted = [...this.networkCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
                        for (const [k] of sorted.slice(0, Math.floor(sorted.length / 2))) this.networkCache.delete(k);
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

        const observer = new MutationObserver(records => {
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
        observer.observe(document.body, { childList: true, subtree: true });
        (this as { _mediaMutationObserver?: MutationObserver; })._mediaMutationObserver = observer;
    },

    teardownOffscreenMediaPause() {
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
            this.intersectionObserver = null;
        }
        const self = this as { _mediaMutationObserver?: MutationObserver; };
        if (self._mediaMutationObserver) {
            self._mediaMutationObserver.disconnect();
            self._mediaMutationObserver = undefined;
        }
    },

    installCSSOptimizations() {
        const rules: string[] = [];

        if (settings.store.virtualizeMessages) {
            rules.push(
                "[class*=\"messageListItem_\"] { contain: layout style; }"
            );
        }

        if (settings.store.optimizeTextRendering) {
            rules.push(
                "[class*=\"messageContent_\"], [class*=\"markup_\"] { text-rendering: optimizeSpeed; will-change: contents; }",
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

    installPassiveListeners() {
        const PASSIVE_EVENTS = new Set(["wheel", "mousewheel", "touchstart", "touchmove", "touchend"]);
        const original = EventTarget.prototype.addEventListener;
        this.originalAddEventListener = original;

        EventTarget.prototype.addEventListener = function patched(
            this: EventTarget,
            type: string,
            listener: EventListenerOrEventListenerObject | null,
            options?: boolean | AddEventListenerOptions
        ): void {
            if (PASSIVE_EVENTS.has(type)) {
                if (typeof options === "boolean" || options === undefined) {
                    options = { capture: !!options, passive: true };
                } else if (options.passive === undefined) {
                    options = { ...options, passive: true };
                }
            }
            return original.call(this, type, listener, options);
        } as typeof EventTarget.prototype.addEventListener;
    },

    restorePassiveListeners() {
        if (this.originalAddEventListener) {
            EventTarget.prototype.addEventListener = this.originalAddEventListener;
            this.originalAddEventListener = null;
        }
    },

    installConsoleSuppression() {
        this.originalConsole = {
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
        if (this.originalConsole) {
            console.log = this.originalConsole.log;
            console.debug = this.originalConsole.debug;
            console.info = this.originalConsole.info;
            this.originalConsole = null;
        }
    },

    installResizeObserverThrottle() {
        if (typeof ResizeObserver === "undefined") return;
        const Native = ResizeObserver;
        this.originalResizeObserver = Native;

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
        }

        (window as unknown as { ResizeObserver: typeof ResizeObserver; }).ResizeObserver = ThrottledResizeObserver as unknown as typeof ResizeObserver;
    },

    restoreResizeObserverThrottle() {
        if (this.originalResizeObserver) {
            (window as unknown as { ResizeObserver: typeof ResizeObserver; }).ResizeObserver = this.originalResizeObserver;
            this.originalResizeObserver = null;
        }
    },

    installGifFreezer() {
        const freeze = (img: HTMLImageElement) => {
            if (!/\.gif/i.test(img.src) && !img.src.includes("a_")) return;
            if (img.dataset.opFrozen === "1") return;
            const realSrc = img.src;
            img.dataset.opFrozen = "1";
            img.dataset.opOriginal = realSrc;
            const canvas = document.createElement("canvas");
            const draw = () => {
                if (!img.naturalWidth) return;
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext("2d");
                if (!ctx) return;
                try {
                    ctx.drawImage(img, 0, 0);
                    img.src = canvas.toDataURL();
                } catch {
                    // CORS fallback: leave it
                }
            };
            if (img.complete) draw(); else img.addEventListener("load", draw, { once: true });
            img.addEventListener("mouseenter", () => { if (img.dataset.opOriginal) img.src = img.dataset.opOriginal; });
            img.addEventListener("mouseleave", () => { draw(); });
        };

        document.querySelectorAll("img").forEach(i => freeze(i as HTMLImageElement));
        this.gifMutationObserver = new MutationObserver(records => {
            for (const r of records) {
                for (const node of r.addedNodes) {
                    if (node instanceof HTMLImageElement) freeze(node);
                    else if (node instanceof Element) node.querySelectorAll("img").forEach(i => freeze(i as HTMLImageElement));
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
        document.querySelectorAll<HTMLImageElement>("img[data-op-frozen='1']").forEach(img => {
            if (img.dataset.opOriginal) img.src = img.dataset.opOriginal;
            delete img.dataset.opFrozen;
            delete img.dataset.opOriginal;
        });
    },

    installLazyImages() {
        const apply = (img: HTMLImageElement) => {
            if (img.dataset.opLazy === "1") return;
            img.dataset.opLazy = "1";
            if (!img.loading) img.loading = "lazy";
            if (!img.decoding) img.decoding = "async";
        };
        document.querySelectorAll("img").forEach(i => apply(i as HTMLImageElement));
        this.lazyImageObserver = new MutationObserver(records => {
            for (const r of records) {
                for (const node of r.addedNodes) {
                    if (node instanceof HTMLImageElement) apply(node);
                    else if (node instanceof Element) node.querySelectorAll("img").forEach(i => apply(i as HTMLImageElement));
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

    installExtraCSS() {
        const rules: string[] = [];

        if (settings.store.killBackdropBlur) {
            rules.push("* { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }");
        }
        if (settings.store.reduceMotion) {
            rules.push("*, *::before, *::after { animation-duration: 0.001ms !important; animation-delay: 0ms !important; transition-duration: 0.001ms !important; transition-delay: 0ms !important; }");
        }
        if (settings.store.killWillChange) {
            rules.push("* { will-change: auto !important; }");
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
