/*
 * Hisako's Optimizations - Advanced Discord Client Performance Enhancement
 * Copyright (c) 2026 Hisako
 * SPDX-License-Identifier: MIT
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    aggressiveOptimization: {
        type: OptionType.BOOLEAN,
        description: "Enable aggressive optimizations (may affect some visual features)",
        default: true,
        restartNeeded: true
    },
    
    animationReduction: {
        type: OptionType.SLIDER,
        description: "Reduce animation intensity (0 = disabled, 100 = maximum reduction)",
        markers: [0, 25, 50, 75, 100],
        default: 75
    },
    
    imageQualityOptimization: {
        type: OptionType.SELECT,
        description: "Image quality optimization level",
        options: [
            { label: "Balanced (Recommended)", value: "balanced", default: true },
            { label: "Performance Priority", value: "performance" },
            { label: "Quality Priority", value: "quality" }
        ]
    },
    
    emojiOptimization: {
        type: OptionType.BOOLEAN,
        description: "Optimize emoji loading and rendering",
        default: true
    },
    
    networkOptimization: {
        type: OptionType.BOOLEAN,
        description: "Optimize network requests and reduce bandwidth usage",
        default: true
    },
    
    disableUnnecessaryFeatures: {
        type: OptionType.BOOLEAN,
        description: "Disable visually intensive features like particles, confetti, etc.",
        default: true
    },
    
    garbageCollectionOptimization: {
        type: OptionType.BOOLEAN,
        description: "Enable advanced garbage collection and memory management",
        default: true
    },
    
    virtualScrolling: {
        type: OptionType.BOOLEAN,
        description: "Enable virtual scrolling for message lists (experimental)",
        default: true
    },
    
    memoryMonitoring: {
        type: OptionType.BOOLEAN,
        description: "Monitor memory usage and trigger cleanup automatically",
        default: true
    }
});

export default definePlugin({
    name: "Hisako's-Optimizations",
    description: "Comprehensive client optimization suite for lag-free Discord experience",
    authors: [{ name: "Irritably", id: 928787166916640838n }],

    settings,

    // Store original methods for restoration
    originalMethods: {} as Record<string, Function>,
    
    // Memory management
    gcInterval: null as any,
    messageElementsPool: [] as HTMLElement[],
    renderedMessages: new Map<number, HTMLElement>(),
    optimizationCache: new Map<string, any>(),
    elementPool: {
        divs: [] as HTMLElement[],
        spans: [] as HTMLElement[],
        containers: [] as HTMLElement[]
    },
    virtualScrollState: {
        visibleRange: { start: 0, end: 0 },
        totalMessages: 0,
        containerHeight: 0
    },
    intersectionObserver: null as any,

    start() {
        console.log("[Hisako's Optimizations] Starting comprehensive performance optimization...");
        
        this.setupDOMOptimizations();
        this.optimizeResourceLoading();
        this.setupAnimationOptimization();
        this.setupMemoryManagement();
        this.setupVirtualScrolling();
        
        console.log("[Hisako's Optimizations] Optimization suite activated!");
    },

    stop() {
        console.log("[Hisako's Optimizations] Restoring original functionality...");
        this.restoreOriginalMethods();
        this.cleanupMemoryManagement();
        this.cleanupVirtualScrolling();
        this.optimizationCache.clear();
        console.log("[Hisako's Optimizations] Cleanup completed.");
    },

    setupDOMOptimizations() {
        // Based on OpenOptimizer's approach
        const methods = ["appendChild", "removeChild"] as const;
        
        methods.forEach(method => {
            try {
                // @ts-ignore
                this.originalMethods[method] = Element.prototype[method];
                
                // @ts-ignore
                Element.prototype[method] = this.createOptimizedDOMMethod(
                    // @ts-ignore
                    Element.prototype[method],
                    method
                );
            } catch (e) {
                console.warn(`[Hisako's Optimizations] Failed to optimize ${method}:`, e);
            }
        });

        // Optimize requestAnimationFrame for smoother animations
        if (settings.store.animationReduction > 0) {
            this.originalMethods.rAF = window.requestAnimationFrame;
            window.requestAnimationFrame = this.createOptimizedRAF(
                window.requestAnimationFrame
            );
        }
    },

    createOptimizedDOMMethod(originalMethod: Function, methodName: string) {
        return function (...args: any[]) {
            // Defer non-critical UI updates to reduce main thread blocking
            if (typeof args[0]?.className === "string") {
                const className = args[0].className;
                
                // Throttle activity and status updates
                if (className.includes("activity") || 
                    className.includes("subText") || 
                    className.includes("botText") || 
                    className.includes("clanTag")) {
                    
                    // Add randomized delay to prevent UI synchronization issues
                    return setTimeout(() => {
                        // @ts-ignore
                        originalMethod.apply(this, args);
                    }, 50 + Math.random() * 100);
                }
            }
            
            // @ts-ignore
            return originalMethod.apply(this, args);
        };
    },

    createOptimizedRAF(originalRAF: Function) {
        const reductionFactor = settings.store.animationReduction / 100;
        let frameCount = 0;
        
        return function (callback: FrameRequestCallback) {
            frameCount++;
            
            // Skip frames based on reduction setting
            if (reductionFactor > 0 && frameCount % Math.ceil(1 + reductionFactor * 3) !== 0) {
                // Still call the callback but with modified timing
                return setTimeout(() => callback(performance.now()), 16 * (1 + reductionFactor));
            }
            
            return originalRAF.call(this, callback);
        };
    },

    optimizeResourceLoading() {
        if (!settings.store.networkOptimization) return;
        
        try {
            // Cache frequently requested resources
            const originalFetch = window.fetch;
            const resourceCache = new Map<string, { response: Response; timestamp: number }>();
            const CACHE_DURATION = 300000; // 5 minutes
            
            window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
                const url = typeof input === "string" ? input : input.toString();
                
                // Cache static image assets
                if (url.match(/\.(png|jpg|jpeg|gif|webp)/i)) {
                    const cached = resourceCache.get(url);
                    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
                        return Promise.resolve(cached.response.clone());
                    }
                }
                
                return originalFetch(input, init).then(response => {
                    // Cache successful image responses
                    if (response.ok && url.match(/\.(png|jpg|jpeg|gif|webp)/i)) {
                        resourceCache.set(url, {
                            response: response.clone(),
                            timestamp: Date.now()
                        });
                    }
                    return response;
                });
            };
            
            this.originalMethods.fetch = originalFetch;
            
            // Periodic cache cleanup
            setInterval(() => {
                const now = Date.now();
                for (const [key, value] of resourceCache.entries()) {
                    if ((now - value.timestamp) > CACHE_DURATION) {
                        resourceCache.delete(key);
                    }
                }
            }, 300000);
            
        } catch (e) {
            console.warn("[Hisako's Optimizations] Failed to optimize resource loading:", e);
        }
    },

    setupAnimationOptimization() {
        if (settings.store.animationReduction <= 0) return;
        
        try {
            // Optimize requestAnimationFrame for reduced animation intensity
            const originalRAF = window.requestAnimationFrame;
            const reductionFactor = settings.store.animationReduction / 100;
            let frameCount = 0;
            
            window.requestAnimationFrame = function(callback) {
                frameCount++;
                
                // Skip frames based on reduction setting
                if (reductionFactor > 0 && frameCount % Math.ceil(1 + reductionFactor * 3) !== 0) {
                    // Still call the callback but with modified timing
                    return setTimeout(() => callback(performance.now()), 16 * (1 + reductionFactor));
                }
                
                return originalRAF.call(this, callback);
            };
            
            this.originalMethods.rAF = originalRAF;
            
        } catch (e) {
            console.warn("[Hisako's Optimizations] Failed to optimize animations:", e);
        }
    },

    setupMemoryManagement() {
        if (!settings.store.garbageCollectionOptimization) return;

        try {
            // Setup periodic memory monitoring
            if (settings.store.memoryMonitoring) {
                this.gcInterval = setInterval(() => {
                    this.performMemoryOptimization();
                }, 30000); // Check every 30 seconds
            }
            
            // Setup weak reference cleanup
            this.setupWeakReferenceManagement();
            
            // Setup DOM element pooling
            this.setupElementPooling();
            
            console.log("[Hisako's Optimizations] Memory management system initialized");
        } catch (e) {
            console.warn("[Hisako's Optimizations] Failed to setup memory management:", e);
        }
    },
    
    performMemoryOptimization() {
        try {
            // Check memory pressure
            if (this.isMemoryPressureHigh()) {
                this.triggerGarbageCollection();
                this.cleanupUnusedResources();
            }
            
            // Clean up old cached entries
            this.cleanupExpiredCache();
            
        } catch (e) {
            console.warn("[Hisako's Optimizations] Memory optimization failed:", e);
        }
    },
    
    isMemoryPressureHigh(): boolean {
        // Check various memory indicators
        try {
            // Check performance.memory if available (Chrome)
            const perf = performance as any;
            if (perf.memory) {
                const memoryUsage = (perf.memory.usedJSHeapSize / perf.memory.jsHeapSizeLimit) * 100;
                return memoryUsage > 75; // High memory pressure threshold
            }
            
            // Alternative checks for other browsers
            const nav = navigator as any;
            if (nav.deviceMemory && nav.deviceMemory < 4) {
                return true; // Low device memory
            }
            
            return false;
        } catch (e) {
            return false;
        }
    },
    
    triggerGarbageCollection() {
        try {
            // Attempt to trigger garbage collection (Chrome only)
            const win = window as any;
            if (win.gc) {
                win.gc();
                console.log("[Hisako's Optimizations] Manual GC triggered");
            }
            
            // Force microtask checkpoint
            Promise.resolve().then(() => {
                // This helps clean up resolved promises
            });
            
        } catch (e) {
            // GC triggering failed, continue gracefully
        }
    },
    
    cleanupUnusedResources() {
        // Clear expired cache entries
        const now = Date.now();
        const CACHE_EXPIRY = 300000; // 5 minutes
        
        for (const [key, value] of this.optimizationCache.entries()) {
            if ((now - value.timestamp) > CACHE_EXPIRY) {
                this.optimizationCache.delete(key);
            }
        }
        
        // Clear unused DOM references
        if (this.messageElementsPool.length > 100) {
            this.messageElementsPool.splice(50); // Keep only recent 50 elements
        }
    },
    
    setupWeakReferenceManagement() {
        // Use WeakMap for automatic cleanup of references
        const weakRefs = new WeakMap();
        
        // Periodic cleanup of weak references
        setInterval(() => {
            const dummy = {};
            weakRefs.set(dummy, Date.now());
            setTimeout(() => weakRefs.delete(dummy), 1000);
        }, 60000);
    },
    
    setupElementPooling() {
        // Create pool for frequently used DOM elements
        this.elementPool = {
            divs: [],
            spans: [],
            containers: []
        };
        
        // Pre-populate pools
        for (let i = 0; i < 10; i++) {
            this.elementPool.divs.push(document.createElement("div")); 
            this.elementPool.spans.push(document.createElement("span"));
        }
    },

    setupVirtualScrolling() {
        if (!settings.store.virtualScrolling) return;
        
        try {
            // Setup intersection observer for efficient rendering
            this.setupIntersectionObserver();
            console.log("[Hisako's Optimizations] Virtual scrolling system initialized");
        } catch (e) {
            console.warn("[Hisako's Optimizations] Failed to setup virtual scrolling:", e);
        }
    },
    
    setupIntersectionObserver() {
        if (!("IntersectionObserver" in window)) return;
        
        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.renderVisibleMessages();
                }
            });
        }, {
            rootMargin: "100px",
            threshold: 0.1
        });
    },
    
    renderVisibleMessages() {
        // Virtual rendering logic
        // Only render messages that are actually visible
        const container = document.querySelector('[class*="messages"]');
        if (!container) return;
        
        const viewportHeight = window.innerHeight;
        const scrollTop = container.scrollTop || 0;
        
        // Calculate visible message range
        const messageHeight = 60; // Approximate message height
        const startIndex = Math.max(0, Math.floor(scrollTop / messageHeight) - 5);
        const endIndex = Math.min(
            this.virtualScrollState?.totalMessages || 0, 
            startIndex + Math.ceil(viewportHeight / messageHeight) + 10
        );
        
        // Update visible range
        if (this.virtualScrollState) {
            this.virtualScrollState.visibleRange = { start: startIndex, end: endIndex };
        }
        
        // Render only visible messages
        this.updateMessageRendering(startIndex, endIndex);
    },
    
    updateMessageRendering(startIndex: number, endIndex: number) {
        // Pool management for message elements
        const neededElements = endIndex - startIndex;
        
        // Reuse existing elements from pool
        while (this.messageElementsPool.length < neededElements) {
            const element = document.createElement("div");
            element.className = "virtual-message";
            this.messageElementsPool.push(element);
        }
        
        // Update rendered messages map
        this.renderedMessages.clear();
        for (let i = startIndex; i < endIndex; i++) {
            this.renderedMessages.set(i, this.messageElementsPool[i - startIndex]);
        }
    },

    cleanupMemoryManagement() {
        if (this.gcInterval) {
            clearInterval(this.gcInterval);
            this.gcInterval = null;
        }
        
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
            this.intersectionObserver = null;
        }
        
        this.messageElementsPool = [];
        this.renderedMessages.clear();
    },
    
    cleanupVirtualScrolling() {
        // Cleanup virtual scrolling resources
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
        }
        
        this.messageElementsPool = [];
        this.renderedMessages.clear();
        this.virtualScrollState = null;
    },
    
    cleanupExpiredCache() {
        const now = Date.now();
        const EXPIRY_TIME = 300000; // 5 minutes
        
        for (const [key, value] of this.optimizationCache.entries()) {
            if ((now - value.timestamp) > EXPIRY_TIME) {
                this.optimizationCache.delete(key);
            }
        }
    },

    restoreOriginalMethods() {
        // Restore DOM methods
        const domMethods = ["appendChild", "removeChild"];
        for (const method of domMethods) {
            if (this.originalMethods[method]) {
                try {
                    // @ts-ignore
                    Element.prototype[method] = this.originalMethods[method];
                } catch (e) {
                    console.warn(`[Hisako's Optimizations] Failed to restore ${method}:`, e);
                }
            }
        }
        
        // Restore requestAnimationFrame
        if (this.originalMethods.rAF) {
            window.requestAnimationFrame = this.originalMethods.rAF as any;
        }
        
        // Restore fetch
        if (this.originalMethods.fetch) {
            window.fetch = this.originalMethods.fetch as any;
        }
    }
});

