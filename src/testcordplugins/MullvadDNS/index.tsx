/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// @ts-ignore
import { definePluginSettings } from "@api/Settings";
// @ts-ignore
import definePlugin from "@utils/types";
// @ts-ignore
import { OptionType } from "@utils/types";

// Plugin settings
const settings = definePluginSettings({
    enableLogging: {
        type: OptionType.BOOLEAN,
        description: "Enable detailed logging",
        default: true
    },
    showNotifications: {
        type: OptionType.BOOLEAN,
        description: "Show toast notifications for DNS resolutions",
        default: true
    },
    autoStart: {
        type: OptionType.BOOLEAN,
        description: "Auto-start plugin on load",
        default: true
    },
    logLevel: {
        type: OptionType.SELECT,
        description: "Logging level",
        options: [
            { label: "Verbose", value: "verbose" },
            { label: "Info", value: "info" },
            { label: "Warning", value: "warn" },
            { label: "Error", value: "error" }
        ],
        default: "info"
    }
});

// @ts-ignore
export default definePlugin({
    name: "MullvadDNS",
    description: "Force Discord to use Mullvad DNS servers for enhanced privacy",
    authors: [{ name: "Irritably", id: 928787166916640838n }],
    settings,

    // Statistics tracking
    statistics: {
        totalRequests: 0,
        successfulResolutions: 0,
        failedResolutions: 0,
        cacheHits: 0
    },

    start() {
        // Plugin configuration
        const PLUGIN_NAME = "MullvadDNS";
        const VERSION = "1.3.0";

        // Capture statistics reference for use in closures
        const { statistics } = this;

        // Mullvad DNS records for Discord services
        const MULLVAD_DNS_RECORDS = {
            "discord.com": "162.159.137.233",
            "gateway.discord.gg": "162.159.135.233",
            "media.discordapp.net": "152.67.79.60",
            "cdn.discordapp.com": "152.67.72.12",
            "status.discord.com": "104.18.33.247",
            "ptb.discord.com": "162.159.137.233",
            "canary.discord.com": "162.159.137.233",
            "discordapp.net": "152.67.79.60"
        };

        // State management
        const originalFetch = window.fetch;
        let isActive = false;
        const dnsCache = new Map();

        // Advanced logger with colors and levels
        const log = {
            verbose: function (msg) {
                if (settings.store.enableLogging && settings.store.logLevel === "verbose") {
                    console.debug(
                        `%c[${PLUGIN_NAME}] %cVERBOSE: ${msg}`,
                        "color: #9E9E9E; font-weight: bold",
                        "color: #9E9E9E"
                    );
                }
            },
            info: function (msg) {
                if (settings.store.enableLogging && ["verbose", "info"].includes(settings.store.logLevel)) {
                    console.log(
                        `%c[${PLUGIN_NAME}] %cINFO: ${msg}`,
                        "color: #4CAF50; font-weight: bold",
                        "color: #4CAF50"
                    );
                }
            },
            warn: function (msg) {
                if (settings.store.enableLogging && ["verbose", "info", "warn"].includes(settings.store.logLevel)) {
                    console.warn(
                        `%c[${PLUGIN_NAME}] %cWARN: ${msg}`,
                        "color: #FF9800; font-weight: bold",
                        "color: #FF9800"
                    );
                }
            },
            error: function (msg) {
                if (settings.store.enableLogging) {
                    console.error(
                        `%c[${PLUGIN_NAME}] %cERROR: ${msg}`,
                        "color: #F44336; font-weight: bold",
                        "color: #F44336"
                    );
                }
            }
        };

        // Domains to exclude from DNS interception (whitelist)
        const EXCLUDED_DOMAINS = [
            // OAuth and authentication services
            "discord.com/api/v9/oauth2",
            "discord.com/api/oauth2",
            "discordapp.com/api/oauth2",
            // Cloud sync services
            "discord.com/api/v9/users/@me/settings-proto",
            "discord.com/api/v9/users/@me/applications-role-connection",
            // Critical API endpoints
            "discord.com/api/v9/auth",
            "discord.com/api/v9/verify",
            // CDN for critical assets
            "cdn.discordapp.com/attachments",
            "media.discordapp.net/attachments"
        ];

        // Check if URL should be excluded from DNS modification
        function shouldExcludeURL(url) {
            const urlString = url.toString().toLowerCase();

            // Check against excluded patterns
            for (const pattern of EXCLUDED_DOMAINS) {
                if (urlString.includes(pattern)) {
                    log.verbose(`Excluding URL from DNS modification: ${url.hostname}${url.pathname}`);
                    return true;
                }
            }

            // Exclude OAuth endpoints specifically
            if (url.pathname.includes("/oauth2/") || url.pathname.includes("/auth/")) {
                log.verbose(`Excluding OAuth endpoint: ${url.hostname}${url.pathname}`);
                return true;
            }

            return false;
        }

        // Enhanced DNS record lookup with caching
        function getDNSRecord(hostname: string) {
            // Check cache first
            if (dnsCache.has(hostname)) {
                statistics.cacheHits++;
                log.verbose(`Cache hit for ${hostname}: ${dnsCache.get(hostname)}`);
                return dnsCache.get(hostname);
            }

            const record = MULLVAD_DNS_RECORDS[hostname] || null;
            if (record) {
                dnsCache.set(hostname, record);
                log.verbose(`Cached new record: ${hostname} -> ${record}`);
            }
            return record;
        }

        // Enhanced fetch patch with statistics
        function patchFetch() {
            if (!originalFetch) {
                log.error("Original fetch not found!");
                return false;
            }

            window.fetch = function (input, init) {
                try {
                    let urlStr = (input instanceof Request) ? input.url : String(input);
                    const url = new URL(urlStr);

                    // Increment request counter
                    statistics.totalRequests++;

                    // Check if this is a Discord-related hostname AND not excluded
                    if (url.hostname.includes("discord") &&
                        !url.hostname.includes("mullvad") &&
                        !shouldExcludeURL(url)) {
                        const ip = getDNSRecord(url.hostname);

                        if (ip) {
                            // Replace hostname with IP
                            url.hostname = ip;
                            urlStr = url.toString();

                            statistics.successfulResolutions++;
                            log.info(`🔄 Resolved ${url.hostname} -> ${ip} (Mullvad)`);

                            // Show notification if enabled
                            if (settings.store.showNotifications) {
                                showNotification(`DNS resolved: ${url.hostname} -> ${ip}`, "success");
                            }
                        } else {
                            statistics.failedResolutions++;
                            log.warn(`No DNS record found for ${url.hostname}`);
                        }
                    } else {
                        if (shouldExcludeURL(url)) {
                            log.verbose(`Whitelisted URL skipped: ${url.hostname}${url.pathname}`);
                        } else {
                            log.verbose(`Skipping non-Discord host: ${url.hostname}`);
                        }
                    }

                    // Call original fetch with modified URL
                    const request = (input instanceof Request)
                        ? new Request(urlStr, input)
                        : urlStr;

                    return originalFetch.call(this, request, init);

                } catch (error: any) {
                    statistics.failedResolutions++;
                    log.error(`Fetch patch error: ${error.message}`);
                    return originalFetch.call(this, input, init);
                }
            };

            log.info("✅ Fetch patched successfully");
            return true;
        }

        // Toast notification helper
        function showNotification(message, type = "info") {
            try {
                const toastModule = (window as any).Vencord?.Plugins?.Plugins?.Toasts;
                if (toastModule) {
                    toastModule.show({
                        message: `🔒 ${message}`,
                        type: type === "success"
                            ? toastModule.Type.SUCCESS
                            : type === "error"
                                ? toastModule.Type.FAILURE
                                : toastModule.Type.MESSAGE,
                        id: Date.now(),
                        options: { position: toastModule.Position.BOTTOM }
                    });
                } else {
                    log[type === "error" ? "error" : "info"](message);
                }
            } catch (e) {
                log.verbose("Toast system not available, using console");
                log[type === "error" ? "error" : "info"](message);
            }
        }

        // Capture statistics reference for the API
        const pluginStats = this.statistics;

        // Public API
        const MullvadDNS = {
            name: PLUGIN_NAME,
            version: VERSION,
            isActive: () => isActive,
            statistics: this.statistics,

            start: () => {
                if (isActive) {
                    log.warn("Plugin is already active!");
                    return;
                }

                try {
                    log.info(`🚀 Starting ${PLUGIN_NAME} v${VERSION}`);

                    const fetchSuccess = patchFetch.call(this);

                    if (fetchSuccess) {
                        isActive = true;
                        showNotification(`${PLUGIN_NAME} activated successfully`, "success");
                        log.info(`✅ Plugin started successfully with ${Object.keys(MULLVAD_DNS_RECORDS).length} DNS records`);
                    } else {
                        throw new Error("Failed to patch network functions");
                    }

                } catch (error) {
                    log.error(`❌ Failed to start plugin: ${error.message}`);
                    showNotification(`${PLUGIN_NAME} failed to start`, "error");
                }
            },

            stop: () => {
                if (!isActive) {
                    log.warn("Plugin is not active!");
                    return;
                }

                try {
                    log.info(`🛑 Stopping ${PLUGIN_NAME}`);

                    if (originalFetch) {
                        window.fetch = originalFetch;
                        log.info("🔄 Fetch restored to original");
                    }

                    // Clear cache
                    dnsCache.clear();
                    isActive = false;

                    showNotification(`${PLUGIN_NAME} deactivated`, "info");
                    log.info("✅ Plugin stopped successfully");

                } catch (error: any) {
                    log.error(`❌ Error stopping plugin: ${error.message}`);
                }
            },

            // Utility methods
            getDNSTable: () => ({ ...MULLVAD_DNS_RECORDS }),
            getCacheStats: () => ({
                cacheSize: dnsCache.size,
                cachedHostnames: Array.from(dnsCache.keys()),
                cacheEntries: Object.fromEntries(dnsCache)
            }),
            getStatistics: () => ({ ...statistics }),
            clearStatistics: () => {
                statistics.totalRequests = 0;
                statistics.successfulResolutions = 0;
                statistics.failedResolutions = 0;
                statistics.cacheHits = 0;
                log.info("📊 Statistics cleared");
            },
            clearCache: () => {
                const { size } = dnsCache;
                dnsCache.clear();
                log.info(`🧹 Cleared ${size} DNS cache entries`);
                return size;
            },
            addCustomRecord: (hostname, ip) => {
                if (typeof hostname === "string" && typeof ip === "string") {
                    MULLVAD_DNS_RECORDS[hostname] = ip;
                    log.info(`➕ Added custom DNS record: ${hostname} -> ${ip}`);
                    return true;
                }
                return false;
            },
            removeCustomRecord: hostname => {
                if (Object.prototype.hasOwnProperty.call(MULLVAD_DNS_RECORDS, hostname)) {
                    delete MULLVAD_DNS_RECORDS[hostname];
                    dnsCache.delete(hostname);
                    log.info(`➖ Removed DNS record: ${hostname}`);
                    return true;
                }
                return false;
            }
        };

        // Auto-start based on settings
        if (settings.store.autoStart) {
            setTimeout(() => {
                MullvadDNS.start();
            }, 2000);
        } else {
            log.info("Auto-start disabled. Plugin ready but not active.");
            showNotification(`${PLUGIN_NAME} loaded - start manually from settings`, "info");
        }

        // Expose API globally for debugging
        // @ts-ignore
        window.MullvadDNS = MullvadDNS;

        log.info(`📦 ${PLUGIN_NAME} v${VERSION} loaded and ready`);
        log.info(`📊 Features: Logging=${settings.store.enableLogging}, Notifications=${settings.store.showNotifications}`);
    },

    stop() {
        // Clean shutdown
        try {
            if (typeof (window as any).MullvadDNS?.stop === "function") {
                (window as any).MullvadDNS.stop();
            }
            console.log("[MullvadDNS] Plugin stopped");
        } catch (error) {
            console.error("[MullvadDNS] Error during shutdown:", error);
        }
    }
});
