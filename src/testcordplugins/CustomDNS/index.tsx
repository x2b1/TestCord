/*
 * CustomDNS Plugin
 * Forces Discord to use custom DNS servers (DNS.SB or Quad9) for enhanced privacy
 */

// @ts-ignore
import { definePluginSettings } from "@api/Settings";
// @ts-ignore
import definePlugin from "@utils/types";
// @ts-ignore
import { OptionType } from "@utils/types";

enum DnsProvider {
    DNS_SB = "dns_sb",
    QUAD9 = "quad9",
    CUSTOM = "custom"
}

// Plugin settings
const settings = definePluginSettings({
    dnsProvider: {
        type: OptionType.SELECT,
        description: "Choose which DNS provider to use",
        options: [
            { label: "DNS.SB", value: DnsProvider.DNS_SB },
            { label: "Quad9", value: DnsProvider.QUAD9 },
            { label: "Custom", value: DnsProvider.CUSTOM }
        ],
        default: DnsProvider.DNS_SB
    },
    customDNSv4Primary: {
        type: OptionType.STRING,
        description: "Custom IPv4 DNS Primary (e.g., 8.8.8.8)",
        default: "",
        placeholder: "8.8.8.8"
    },
    customDNSv4Secondary: {
        type: OptionType.STRING,
        description: "Custom IPv4 DNS Secondary (optional)",
        default: "",
        placeholder: "8.8.4.4"
    },
    customDNSv6Primary: {
        type: OptionType.STRING,
        description: "Custom IPv6 DNS Primary (e.g., 2001:4860:4860::8888)",
        default: "",
        placeholder: "2001:4860:4860::8888"
    },
    customDNSv6Secondary: {
        type: OptionType.STRING,
        description: "Custom IPv6 DNS Secondary (optional)",
        default: "",
        placeholder: "2001:4860:4860::8844"
    },
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
    name: "CustomDNS",
    description: "Force Discord to use custom DNS servers (DNS.SB or Quad9) for enhanced privacy (If Activated Remove MullvadDNS) ",
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
        const PLUGIN_NAME = "CustomDNS";
        const VERSION = "1.0.0";

        // DNS.SB DNS records for Discord services
        const DNS_SB_RECORDS = {
            "discord.com": "185.222.222.222",
            "gateway.discord.gg": "185.222.222.222",
            "media.discordapp.net": "185.222.222.222",
            "cdn.discordapp.com": "185.222.222.222",
            "status.discord.com": "185.222.222.222",
            "ptb.discord.com": "185.222.222.222",
            "canary.discord.com": "185.222.222.222",
            "discordapp.net": "185.222.222.222"
        };

        // Quad9 DNS records for Discord services
        const QUAD9_RECORDS = {
            "discord.com": "9.9.9.9",
            "gateway.discord.gg": "9.9.9.9",
            "media.discordapp.net": "9.9.9.9",
            "cdn.discordapp.com": "9.9.9.9",
            "status.discord.com": "9.9.9.9",
            "ptb.discord.com": "9.9.9.9",
            "canary.discord.com": "9.9.9.9",
            "discordapp.net": "9.9.9.9"
        };

        // State management
        const originalFetch = window.fetch;
        let isActive = false;
        const dnsCache = new Map();
        const statistics = {
            totalRequests: 0,
            successfulResolutions: 0,
            failedResolutions: 0,
            cacheHits: 0
        };

        // Get current DNS records based on selected provider
        function getCurrentDNSRecords() {
            if (settings.store.dnsProvider === DnsProvider.CUSTOM) {
                const records: Record<string, string> = {};
                // Use primary IPv4 or fallback to secondary
                const customIP = settings.store.customDNSv4Primary || settings.store.customDNSv4Secondary;

                if (customIP) {
                    Object.keys(DNS_SB_RECORDS).forEach(hostname => {
                        records[hostname] = customIP;
                    });
                }
                return records;
            }
            return settings.store.dnsProvider === DnsProvider.DNS_SB ? DNS_SB_RECORDS : QUAD9_RECORDS;
        }

        // Get provider name for display
        function getProviderName() {
            if (settings.store.dnsProvider === DnsProvider.CUSTOM) {
                const customIP = settings.store.customDNSv4Primary || settings.store.customDNSv4Secondary || "Not configured";
                return `Custom (${customIP})`;
            }
            return settings.store.dnsProvider === DnsProvider.DNS_SB ? "DNS.SB" : "Quad9";
        }

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
            info: function (msg: string) {
                if (settings.store.enableLogging && ["verbose", "info"].includes(settings.store.logLevel ?? "")) {
                    console.log(
                        `%c[${PLUGIN_NAME}] %cINFO: ${msg}`,
                        "color: #4CAF50; font-weight: bold",
                        "color: #4CAF50"
                    );
                }
            },
            warn: function (msg: string) {
                if (settings.store.enableLogging && ["verbose", "info", "warn"].includes(settings.store.logLevel ?? "")) {
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

        // Domains to exclude from DNS modification (whitelist)
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
        function getDNSRecord(hostname) {
            // Check cache first
            if (dnsCache.has(hostname)) {
                statistics.cacheHits++;
                log.verbose(`Cache hit for ${hostname}: ${dnsCache.get(hostname)}`);
                return dnsCache.get(hostname);
            }

            const records = getCurrentDNSRecords();
            const record = records[hostname] || null;
            if (record) {
                dnsCache.set(hostname, record);
                log.verbose(`Cached new record: ${hostname} -> ${record} (${getProviderName()})`);
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
                        !shouldExcludeURL(url)) {
                        const ip = getDNSRecord(url.hostname);

                        if (ip) {
                            // Replace hostname with IP
                            url.hostname = ip;
                            urlStr = url.toString();

                            statistics.successfulResolutions++;
                            log.info(`🔄 Resolved ${url.hostname} -> ${ip} (${getProviderName()})`);

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

                    return originalFetch(request, init);

                } catch (error: any) {
                    statistics.failedResolutions++;
                    log.error(`Fetch patch error: ${error.message}`);
                    return originalFetch(input, init);
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

        // Public API
        const CustomDNS = {
            name: PLUGIN_NAME,
            version: VERSION,
            isActive: () => isActive,
            statistics,

            start: () => {
                if (isActive) {
                    log.warn("Plugin is already active!");
                    return;
                }

                // Validate custom DNS configuration
                if (settings.store.dnsProvider === DnsProvider.CUSTOM) {
                    const hasCustomDNS = settings.store.customDNSv4Primary || settings.store.customDNSv4Secondary;
                    if (!hasCustomDNS) {
                        log.error("❌ Custom DNS selected but no DNS server configured!");
                        showNotification("Please configure a custom DNS server in settings", "error");
                        return;
                    }
                }

                try {
                    log.info(`🚀 Starting ${PLUGIN_NAME} v${VERSION}`);
                    log.info(`Using DNS provider: ${getProviderName()}`);

                    const fetchSuccess = patchFetch();

                    if (fetchSuccess) {
                        isActive = true;
                        showNotification(`${PLUGIN_NAME} activated with ${getProviderName()}`, "success");
                        log.info(`✅ Plugin started successfully with ${Object.keys(getCurrentDNSRecords()).length} DNS records`);
                    } else {
                        throw new Error("Failed to patch network functions");
                    }

                } catch (error: any) {
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
            getDNSTable: () => getCurrentDNSRecords(),
            getCurrentProvider: () => getProviderName(),
            getCustomDNSConfig: () => ({
                v4Primary: settings.store.customDNSv4Primary,
                v4Secondary: settings.store.customDNSv4Secondary,
                v6Primary: settings.store.customDNSv6Primary,
                v6Secondary: settings.store.customDNSv6Secondary
            }),
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
                const size = dnsCache.size;
                dnsCache.clear();
                log.info(`🧹 Cleared ${size} DNS cache entries`);
                return size;
            },
            addCustomRecord: (hostname, ip) => {
                if (typeof hostname === "string" && typeof ip === "string") {
                    const records = getCurrentDNSRecords();
                    records[hostname] = ip;
                    log.info(`➕ Added custom DNS record: ${hostname} -> ${ip}`);
                    return true;
                }
                return false;
            },
            removeCustomRecord: (hostname) => {
                const records = getCurrentDNSRecords();
                if (Object.prototype.hasOwnProperty.call(records, hostname)) {
                    delete records[hostname];
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
                CustomDNS.start();
            }, 2000);
        } else {
            log.info("Auto-start disabled. Plugin ready but not active.");
            showNotification(`${PLUGIN_NAME} loaded - start manually from settings`, "info");
        }

        // Expose API globally for debugging
        // @ts-ignore
        window.CustomDNS = CustomDNS;

        log.info(`📦 ${PLUGIN_NAME} v${VERSION} loaded and ready`);
        log.info(`📊 Features: Provider=${getProviderName()}, Logging=${settings.store.enableLogging}, Notifications=${settings.store.showNotifications}`);
    },

    stop() {
        // Clean shutdown
        try {
            if (typeof (window as any).CustomDNS?.stop === "function") {
                (window as any).CustomDNS.stop();
            }
            console.log("[CustomDNS] Plugin stopped");
        } catch (error) {
            console.error("[CustomDNS] Error during shutdown:", error);
        }
    }
});
