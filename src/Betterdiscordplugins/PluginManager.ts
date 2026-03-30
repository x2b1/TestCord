/*
 * Testcord BetterDiscord Plugin Manager
 * Loads and manages BetterDiscord .plugin.js files
 */

import { Logger } from "@utils/Logger";
import { createBdApi, BdApi } from "./BdApi";
import { Settings } from "@api/Settings";

const logger = new Logger("BDPluginManager", "#ff7373");

export interface BDPluginMeta {
    name: string;
    author: string;
    version: string;
    description: string;
    source?: string;
    website?: string;
    invite?: string;
    authorId?: string;
    authorLink?: string;
    updateUrl?: string;
    donationUrl?: string;
    patreon?: string;
}

export interface BDPlugin {
    id: string;
    file: string;
    meta: BDPluginMeta;
    enabled: boolean;
    started?: boolean;
    start?: () => void;
    stop?: () => void;
    load?: () => void;
    unload?: () => void;
    onStart?: () => void;
    onStop?: () => void;
    getSettingsPanel?: () => HTMLElement;
    observer?: (mutations: MutationRecord[]) => void;
    onMessage?: () => void;
    onSwitch?: () => void;
    getSettingsConfig?: () => any;
    saveSettings?: () => void;
    [key: string]: any;
}

// Parse BetterDiscord plugin metadata from comment block
export function parsePluginMeta(content: string, fileName: string): BDPluginMeta {
    const meta: Partial<BDPluginMeta> = {
        name: fileName.replace(/\.plugin\.js$/i, ""),
        author: "Unknown",
        version: "1.0.0",
        description: "No description provided"
    };

    // Try to find the comment block
    const commentMatch = content.match(/\/\*\*([\s\S]*?)\*\//);
    if (commentMatch) {
        const block = commentMatch[1];

        // Parse @key value pairs
        const lines = block.split("\n");
        for (const line of lines) {
            const match = line.match(/@(\w+)\s*(.*)/);
            if (match) {
                const [, key, value] = match;
                const trimmedValue = value.trim();

                switch (key.toLowerCase()) {
                    case "name":
                        meta.name = trimmedValue;
                        break;
                    case "author":
                        meta.author = trimmedValue;
                        break;
                    case "version":
                        meta.version = trimmedValue;
                        break;
                    case "description":
                        meta.description = trimmedValue;
                        break;
                    case "source":
                        meta.source = trimmedValue;
                        break;
                    case "website":
                        meta.website = trimmedValue;
                        break;
                    case "invite":
                        meta.invite = trimmedValue;
                        break;
                    case "authorid":
                        meta.authorId = trimmedValue;
                        break;
                    case "authorlink":
                        meta.authorLink = trimmedValue;
                        break;
                    case "updateurl":
                        meta.updateUrl = trimmedValue;
                        break;
                    case "donationurl":
                        meta.donationUrl = trimmedValue;
                        break;
                    case "patreon":
                        meta.patreon = trimmedValue;
                        break;
                }
            }
        }
    }

    // Also try // style comments
    if (!meta.name || meta.name === fileName.replace(/\.plugin\.js$/i, "")) {
        const nameMatch = content.match(/\/\/\s*@name\s+(.+)/i);
        if (nameMatch) meta.name = nameMatch[1].trim();

        const authorMatch = content.match(/\/\/\s*@author\s+(.+)/i);
        if (authorMatch) meta.author = authorMatch[1].trim();

        const versionMatch = content.match(/\/\/\s*@version\s+(.+)/i);
        if (versionMatch) meta.version = versionMatch[1].trim();

        const descMatch = content.match(/\/\/\s*@description\s+(.+)/i);
        if (descMatch) meta.description = descMatch[1].trim();
    }

    return meta as BDPluginMeta;
}

// Plugin Manager Class
export class BDPluginManager {
    private static plugins: Map<string, BDPlugin> = new Map();
    private static bdApis: Map<string, ReturnType<typeof createBdApi>> = new Map();

    /**
     * Load a BetterDiscord plugin from source code
     */
    static loadPlugin(fileName: string, sourceCode: string): BDPlugin | null {
        try {
            const meta = parsePluginMeta(sourceCode, fileName);
            const pluginId = meta.name.replace(/\s+/g, "_");

            // Create BdApi instance for this plugin
            const bdApi = createBdApi(meta.name);
            this.bdApis.set(pluginId, bdApi);

            // Create a sandbox for the plugin
            const pluginExports: any = {};

            // Create the plugin module context
            const module = { exports: pluginExports };

            // BD plugin template function
            let pluginInstance: any = null;

            // Try to execute the plugin code
            try {
                // Create a function that wraps the plugin code
                const pluginFn = new Function(
                    "module",
                    "exports",
                    "require",
                    "BdApi",
                    "window",
                    "document",
                    "console",
                    "setTimeout",
                    "setInterval",
                    "clearTimeout",
                    "clearInterval",
                    "fetch",
                    "XMLHttpRequest",
                    "MutationObserver",
                    sourceCode + "\nreturn module.exports || exports.default || this;"
                );

                // Execute the plugin with proper context
                pluginInstance = pluginFn.call(
                    pluginExports,  // 'this' context
                    module,
                    pluginExports,
                    // Mock require for BD plugins - return stubs for Node modules
                    (name: string) => {
                        // Return stub objects for Node.js modules that don't exist in browser
                        if (name === "fs" || name === "path" || name === "electron") {
                            logger.warn(`Plugin ${meta.name} tried to require("${name}") - returning stub (not available in browser)`);
                            return {
                                // Stub functions that don't crash
                                readFile: () => { },
                                writeFile: () => { },
                                join: (...args: string[]) => args.join("/"),
                                basename: (p: string) => p.split("/").pop() || p,
                                dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
                                ipcRenderer: { invoke: () => Promise.resolve(null), send: () => { } },
                                remote: {}
                            };
                        }
                        if (name === "events") {
                            return { EventEmitter: class EventEmitter { on() { } off() { } emit() { } } };
                        }
                        logger.warn(`Plugin ${meta.name} tried to require("${name}") - not supported`);
                        return {};
                    },
                    bdApi,
                    typeof window !== "undefined" ? window : {},
                    typeof document !== "undefined" ? document : {},
                    console,
                    setTimeout,
                    setInterval,
                    clearTimeout,
                    clearInterval,
                    typeof fetch !== "undefined" ? fetch : () => Promise.resolve(null),
                    typeof XMLHttpRequest !== "undefined" ? XMLHttpRequest : class { },
                    typeof MutationObserver !== "undefined" ? MutationObserver : class { }
                );
            } catch (execError) {
                logger.error(`Failed to execute plugin ${meta.name}:`, execError);
                // Try alternative loading method for self-executing plugins
                try {
                    const wrappedCode = `(function(module, exports, BdApi) {
                        try {
                            ${sourceCode}
                        } catch(e) { console.error('BD Plugin error:', e); }
                        return module.exports || exports.default;
                    })(module, pluginExports, bdApi)`;
                    pluginInstance = eval(wrappedCode);
                } catch (e) {
                    logger.error(`Alternative loading also failed for ${meta.name}:`, e);
                }
            }

            // Create the plugin object
            const plugin: BDPlugin = {
                id: pluginId,
                file: fileName,
                meta,
                enabled: false,
                started: false,
                ...(pluginInstance || {}),
                ...pluginExports
            };

            // Store the plugin
            this.plugins.set(pluginId, plugin);
            (window as any).TestcordBDPlugins = Object.fromEntries(this.plugins);

            logger.info(`Loaded BD plugin: ${meta.name} v${meta.version} by ${meta.author}`);

            // Don't auto-start - let Testcord's plugin system handle it
            // But mark as enabled if it was previously enabled
            if (this.isPluginEnabled(pluginId)) {
                plugin.enabled = true;
            }

            return plugin;
        } catch (error) {
            logger.error(`Failed to load plugin ${fileName}:`, error);
            return null;
        }
    }

    /**
     * Start a loaded plugin
     */
    static startPlugin(pluginId: string): boolean {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            logger.error(`Cannot start plugin ${pluginId}: not found`);
            return false;
        }

        // Don't start if already started
        if (plugin.started) {
            logger.debug(`Plugin ${pluginId} is already started`);
            return true;
        }

        try {
            // Call the appropriate start method
            if (typeof plugin.start === "function") {
                plugin.start();
            } else if (typeof plugin.onStart === "function") {
                plugin.onStart();
            } else if (typeof plugin.load === "function") {
                plugin.load();
            }

            plugin.enabled = true;
            plugin.started = true;
            this.saveEnabledState(pluginId, true);

            logger.info(`Started BD plugin: ${plugin.meta.name}`);
            return true;
        } catch (error) {
            logger.error(`Failed to start plugin ${plugin.meta.name}:`, error);
            return false;
        }
    }

    /**
     * Stop a running plugin
     */
    static stopPlugin(pluginId: string): boolean {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            logger.error(`Cannot stop plugin ${pluginId}: not found`);
            return false;
        }

        // Don't stop if not started
        if (!plugin.started) {
            logger.debug(`Plugin ${pluginId} is not started`);
            plugin.enabled = false;
            this.saveEnabledState(pluginId, false);
            return true;
        }

        try {
            // Call the appropriate stop method
            if (typeof plugin.stop === "function") {
                plugin.stop();
            } else if (typeof plugin.onStop === "function") {
                plugin.onStop();
            } else if (typeof plugin.unload === "function") {
                plugin.unload();
            }

            plugin.enabled = false;
            this.saveEnabledState(pluginId, false);

            logger.info(`Stopped BD plugin: ${plugin.meta.name}`);
            return true;
        } catch (error) {
            logger.error(`Failed to stop plugin ${plugin.meta.name}:`, error);
            return false;
        }
    }

    /**
     * Toggle a plugin's state
     */
    static togglePlugin(pluginId: string): boolean {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) return false;

        if (plugin.enabled) {
            return this.stopPlugin(pluginId);
        } else {
            return this.startPlugin(pluginId);
        }
    }

    /**
     * Get a plugin by ID
     */
    static getPlugin(pluginId: string): BDPlugin | undefined {
        return this.plugins.get(pluginId);
    }

    /**
     * Get all loaded plugins
     */
    static getAllPlugins(): BDPlugin[] {
        return Array.from(this.plugins.values());
    }

    /**
     * Check if a plugin is enabled
     */
    static isPluginEnabled(pluginId: string): boolean {
        // First check Settings system, then fall back to localStorage
        if (Settings.plugins[pluginId]) {
            return Settings.plugins[pluginId].enabled ?? true; // Default to enabled
        }
        const enabled = localStorage.getItem("Testcord_BDPlugins_enabled");
        if (!enabled) return true; // Default to enabled if no preference stored
        const enabledList: string[] = JSON.parse(enabled);
        return enabledList.includes(pluginId);
    }

    /**
     * Save plugin enabled state
     */
    private static saveEnabledState(pluginId: string, enabled: boolean): void {
        // First try to use Settings system
        if (Settings.plugins[pluginId]) {
            Settings.plugins[pluginId].enabled = enabled;
            return;
        }

        // Fall back to localStorage
        let enabledList: string[] = [];
        const stored = localStorage.getItem("Testcord_BDPlugins_enabled");
        if (stored) {
            enabledList = JSON.parse(stored);
        }

        const index = enabledList.indexOf(pluginId);
        if (enabled && index === -1) {
            enabledList.push(pluginId);
        } else if (!enabled && index > -1) {
            enabledList.splice(index, 1);
        }

        localStorage.setItem("Testcord_BDPlugins_enabled", JSON.stringify(enabledList));
    }

    /**
     * Get the BdApi instance for a plugin
     */
    static getBdApi(pluginId: string): ReturnType<typeof createBdApi> | undefined {
        return this.bdApis.get(pluginId);
    }

    /**
     * Unload a plugin completely
     */
    static unloadPlugin(pluginId: string): void {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) return;

        // Stop if running
        if (plugin.enabled) {
            this.stopPlugin(pluginId);
        }

        // Remove patches
        const bdApi = this.bdApis.get(pluginId);
        if (bdApi) {
            bdApi.Patcher.unpatchAll(pluginId);
        }

        // Remove from registry
        this.plugins.delete(pluginId);
        this.bdApis.delete(pluginId);
        (window as any).TestcordBDPlugins = Object.fromEntries(this.plugins);

        logger.info(`Unloaded BD plugin: ${plugin.meta.name}`);
    }

    /**
     * Reload a plugin
     */
    static reloadPlugin(pluginId: string): boolean {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) return false;

        const wasEnabled = plugin.enabled;
        this.unloadPlugin(pluginId);

        // Note: This would need the source code to be reloaded
        // For now, just restart if it was enabled
        if (wasEnabled) {
            // Would need to reload from file system
            logger.warn(`Plugin ${pluginId} needs manual reload`);
        }

        return true;
    }

    /**
     * Load all plugins from the Betterdiscordplugins folder
     * This is called by the main plugin system
     */
    static async loadAllPlugins(): Promise<void> {
        try {
            // In a real implementation, this would read from the file system
            // For now, we'll use the dynamically imported plugins
            logger.info("Loading all BetterDiscord plugins...");

            // The actual plugin files are loaded via the build system
            // This method just initializes any that are enabled
            const plugins = this.getAllPlugins();
            let loadedCount = 0;

            for (const plugin of plugins) {
                if (this.isPluginEnabled(plugin.id)) {
                    if (this.startPlugin(plugin.id)) {
                        loadedCount++;
                    }
                }
            }

            logger.info(`Loaded ${loadedCount}/${plugins.length} BetterDiscord plugins`);
        } catch (error) {
            logger.error("Failed to load BetterDiscord plugins:", error);
        }
    }

    /**
     * Register a plugin that was loaded via the build system
     */
    static registerPlugin(pluginData: BDPlugin): void {
        if (!pluginData.id) {
            pluginData.id = pluginData.meta?.name?.replace(/\s+/g, "_") || `unknown_${Date.now()}`;
        }

        // Create BdApi instance
        const bdApi = createBdApi(pluginData.meta?.name || pluginData.id);
        this.bdApis.set(pluginData.id, bdApi);

        // Store the plugin
        this.plugins.set(pluginData.id, pluginData);
        (window as any).TestcordBDPlugins = Object.fromEntries(this.plugins);

        logger.info(`Registered BD plugin: ${pluginData.meta?.name || pluginData.id}`);

        // Auto-start if enabled
        if (this.isPluginEnabled(pluginData.id)) {
            this.startPlugin(pluginData.id);
        }
    }
}

// Initialize global plugin registry
if (typeof window !== "undefined") {
    (window as any).TestcordBDPlugins = {};
    (window as any).TestcordBDPluginManager = BDPluginManager;
}
