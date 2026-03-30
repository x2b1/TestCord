/*
 * Testcord BetterDiscord Plugin Compatibility Layer
 * Based on BetterDiscord's BdApi implementation
 */

import { Logger } from "@utils/Logger";
import { FluxDispatcher, React, ReactDOM } from "@webpack/common";
import { filters } from "@webpack";
import type { Plugin } from "@utils/types";

// BD-compatible Logger
class BdLogger {
    private prefix: string;

    constructor(prefix?: string) {
        this.prefix = prefix ? `[${prefix}]` : "[BdApi]";
    }

    log(...args: any[]) {
        console.log(this.prefix, ...args);
    }

    info(...args: any[]) {
        console.info(this.prefix, ...args);
    }

    warn(...args: any[]) {
        console.warn(this.prefix, ...args);
    }

    error(...args: any[]) {
        console.error(this.prefix, ...args);
    }

    debug(...args: any[]) {
        console.debug(this.prefix, ...args);
    }
}

// BD-compatible Data API
class BdData {
    private pluginName: string;

    constructor(pluginName?: string) {
        this.pluginName = pluginName || "";
    }

    async save(key: string, value: any): Promise<void> {
        const fullKey = this.pluginName ? `${this.pluginName}_${key}` : key;
        localStorage.setItem(`BdData_${fullKey}`, JSON.stringify(value));
    }

    async load(key: string): Promise<any> {
        const fullKey = this.pluginName ? `${this.pluginName}_${key}` : key;
        const data = localStorage.getItem(`BdData_${fullKey}`);
        return data ? JSON.parse(data) : null;
    }

    async delete(key: string): Promise<void> {
        const fullKey = this.pluginName ? `${this.pluginName}_${key}` : key;
        localStorage.removeItem(`BdData_${fullKey}`);
    }

    async has(key: string): Promise<boolean> {
        const fullKey = this.pluginName ? `${this.pluginName}_${key}` : key;
        return localStorage.getItem(`BdData_${fullKey}`) !== null;
    }

    async getAll(): Promise<Record<string, any>> {
        const prefix = `BdData_${this.pluginName ? this.pluginName + "_" : ""}`;
        const result: Record<string, any> = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(prefix)) {
                const dataKey = key.slice(prefix.length);
                try {
                    result[dataKey] = JSON.parse(localStorage.getItem(key)!);
                } catch {
                    // Skip invalid JSON
                }
            }
        }
        return result;
    }
}

// BD-compatible DOM API
class BdDOM {
    private pluginName: string;

    constructor(pluginName?: string) {
        this.pluginName = pluginName || "";
    }

    createElement(tag: string = "div"): HTMLElement {
        return document.createElement(tag);
    }

    appendStyle(id: string, css: string): void {
        let style = document.getElementById(id) as HTMLStyleElement;
        if (!style) {
            style = document.createElement("style");
            style.id = id;
            document.head.appendChild(style);
        }
        style.textContent = css;
    }

    removeStyle(id: string): void {
        const style = document.getElementById(id);
        if (style) style.remove();
    }

    querySelector(selector: string): Element | null {
        return document.querySelector(selector);
    }

    querySelectorAll(selector: string): NodeListOf<Element> {
        return document.querySelectorAll(selector);
    }

    addListener(selector: string, event: string, handler: EventListener, options?: boolean | AddEventListenerOptions): void {
        const elements = this.querySelectorAll(selector);
        elements.forEach(el => el.addEventListener(event, handler, options));
    }

    removeListener(selector: string, event: string, handler: EventListener): void {
        const elements = this.querySelectorAll(selector);
        elements.forEach(el => el.removeEventListener(event, handler));
    }

    getStyle(id: string): string {
        const style = document.getElementById(id) as HTMLStyleElement;
        return style?.textContent || "";
    }

    toggleStyle(id: string, toggle?: boolean): boolean {
        const style = document.getElementById(id) as HTMLStyleElement;
        if (!style) return false;
        const shouldEnable = toggle ?? style.disabled;
        style.disabled = !shouldEnable;
        return shouldEnable;
    }
}

// BD-compatible Patcher API
class BdPatcher {
    private pluginName: string;

    constructor(pluginName?: string) {
        this.pluginName = pluginName || "";
    }

    before(moduleToPatch: object, functionName: string, callback: Function): () => void {
        if (!moduleToPatch || typeof moduleToPatch[functionName] !== "function") {
            new BdLogger("Patcher").error(`Cannot patch ${String(functionName)}: invalid module or function`);
            return () => { };
        }

        const original = moduleToPatch[functionName];
        const wrapper = function (this: any, ...args: any[]) {
            const data = { thisObject: this, arguments: args };
            callback(data);
            return original.apply(data.thisObject, data.arguments);
        };

        moduleToPatch[functionName] = wrapper;

        return () => {
            moduleToPatch[functionName] = original;
        };
    }

    after(moduleToPatch: object, functionName: string, callback: Function): () => void {
        if (!moduleToPatch || typeof moduleToPatch[functionName] !== "function") {
            new BdLogger("Patcher").error(`Cannot patch ${String(functionName)}: invalid module or function`);
            return () => { };
        }

        const original = moduleToPatch[functionName];
        const wrapper = function (this: any, ...args: any[]) {
            const result = original.apply(this, args);
            const data = { thisObject: this, arguments: args, returnValue: result };
            callback(data);
            return data.returnValue;
        };

        moduleToPatch[functionName] = wrapper;

        return () => {
            moduleToPatch[functionName] = original;
        };
    }

    instead(moduleToPatch: object, functionName: string, callback: Function): () => void {
        if (!moduleToPatch || typeof moduleToPatch[functionName] !== "function") {
            new BdLogger("Patcher").error(`Cannot patch ${String(functionName)}: invalid module or function`);
            return () => { };
        }

        const original = moduleToPatch[functionName];
        const wrapper = function (this: any, ...args: any[]) {
            const data = {
                thisObject: this,
                arguments: args,
                callOriginal: () => original.apply(this, args),
                returnValue: undefined as any
            };
            callback(data);
            return data.returnValue;
        };

        moduleToPatch[functionName] = wrapper;

        return () => {
            moduleToPatch[functionName] = original;
        };
    }

    unpatchAll(caller: string): void {
        // Patches are tracked internally, this is a simplified implementation
        new BdLogger("Patcher").warn("unpatchAll is not fully implemented in compatibility mode");
    }
}

// BD-compatible Webpack API
const BdWebpack = {
    getModule: (filter: Function, options?: { searchExports?: boolean; }): any => {
        const searchExports = options?.searchExports ?? false;
        const webpackRequire = (window as any).webpackChunkdiscord_app?.push?.([[Symbol()], {}, (r: any) => r]);
        if (!webpackRequire) return null;

        const cache = (webpackRequire as any).c || {};
        for (const id in cache) {
            try {
                const module = cache[id].exports;
                if (!module) continue;

                if (searchExports && module.default) {
                    if (filter(module.default)) return module.default;
                }
                if (filter(module)) {
                    return searchExports ? (module.default || module) : module;
                }
            } catch {
                continue;
            }
        }
        return null;
    },

    getModuleByProps: (...props: string[]): any => {
        return BdWebpack.getModule((m: any) => props.every(p => m?.[p] !== undefined));
    },

    getModuleByDisplayName: (displayName: string): any => {
        return BdWebpack.getModule((m: any) => m?.displayName === displayName);
    },

    getModuleByName: (name: string): any => {
        return BdWebpack.getModule((m: any) => m?.name === name);
    },

    // Filters for module finding
    Filters: {
        byProps: (...props: string[]) => (m: any) => props.every(p => m?.[p] !== undefined),
        byDisplayName: (displayName: string) => (m: any) => m?.displayName === displayName,
        byName: (name: string) => (m: any) => m?.name === name,
        byStrings: (...strings: string[]) => (m: any) => {
            if (!m || typeof m !== 'function') return false;
            const str = m.toString();
            return strings.every(s => str.includes(s));
        },
        bySource: (source: string) => (m: any) => {
            if (!m || typeof m !== 'function') return false;
            try {
                const str = m.toString();
                return str.includes(source);
            } catch {
                return false;
            }
        },
        byPrototypeKeys: (...keys: string[]) => (m: any) => {
            if (!m?.prototype) return false;
            return keys.every(k => m.prototype[k] !== undefined);
        },
        byStoreName: (name: string) => (m: any) => m?.getName?.() === name,
        byRegex: (regex: RegExp) => (m: any) => {
            if (!m || typeof m !== 'function') return false;
            try {
                return regex.test(m.toString());
            } catch {
                return false;
            }
        },
    },

    // Advanced module finding methods
    getModuleBySource: (source: string): any => {
        return BdWebpack.getModule(BdWebpack.Filters.bySource(source));
    },

    getModuleByPrototypeKeys: (...keys: string[]): any => {
        return BdWebpack.getModule(BdWebpack.Filters.byPrototypeKeys(...keys));
    },

    // BD-compatible method names
    getByKeys: (...keys: string[]): any => {
        return BdWebpack.getModule(BdWebpack.Filters.byProps(...keys));
    },

    getModuleByKeys: (...keys: string[]): any => {
        return BdWebpack.getModule(BdWebpack.Filters.byProps(...keys));
    },

    getStore: (name: string): any => {
        // Simplified store getter - look for stores by name
        const webpackRequire = (window as any).webpackChunkdiscord_app?.push?.([[Symbol()], {}, (r: any) => r]);
        if (!webpackRequire) return null;

        const cache = (webpackRequire as any).c || {};
        for (const id in cache) {
            try {
                const module = cache[id].exports;
                if (module && module.getName?.() === name) {
                    return module;
                }
            } catch {
                continue;
            }
        }
        return null;
    },

    waitForModule: (filter: Function, timeout: number = 3000): Promise<any> => {
        return new Promise((resolve, reject) => {
            const module = BdWebpack.getModule(filter);
            if (module) {
                resolve(module);
                return;
            }

            const timeoutId = setTimeout(() => {
                reject(new Error(`Module not found within ${timeout}ms`));
            }, timeout);

            const checkInterval = setInterval(() => {
                const found = BdWebpack.getModule(filter);
                if (found) {
                    clearInterval(checkInterval);
                    clearTimeout(timeoutId);
                    resolve(found);
                }
            }, 100);
        });
    },

    Bulk: async (queries: Array<{ filter: Function; defaultExport?: boolean; }>): Promise<any[]> => {
        return Promise.all(queries.map(q => BdWebpack.getModule(q.filter, { searchExports: q.defaultExport ?? true })));
    }
};

// BD-compatible UI API
const BdUI = {
    alert: (title: string, content: string): void => {
        alert(`${title}\n\n${content}`);
    },

    confirm: (title: string, content: string, callback?: (confirmed: boolean) => void): void => {
        const result = confirm(`${title}\n\n${content}`);
        callback?.(result);
    },

    openModal: (onRequestClose: () => void, content: any): void => {
        // Simplified modal - would need proper integration with Discord's modal system
        console.log("Modal opened", { onRequestClose, content });
    },

    closeModal: (modalKey: any): void => {
        console.log("Modal closed", modalKey);
    }
};

// BD-compatible Utils
const BdUtils = {
    suppressErrors: <T extends Function>(method: T, message: string = ""): T => {
        return (function (this: any, ...args: any[]) {
            try {
                return method.apply(this, args);
            } catch (e) {
                console.error(`[BdUtils] Error${message ? `: ${message}` : ""}`, e);
                return undefined;
            }
        }) as unknown as T;
    },

    formatMissing: (count: number): string => {
        return count === 1 ? "1 missing dependency" : `${count} missing dependencies`;
    },

    getID: (): string => {
        return `bd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },

    className: (...classes: string[]): string => {
        return classes.filter(Boolean).join(" ");
    },

    linkify: (text: string): string => {
        return text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
    }
};

// BD-compatible ContextMenu
const BdContextMenu = {
    open: (event: MouseEvent, items: any[]): void => {
        // Simplified - would need proper Discord context menu integration
        console.log("Context menu opened", { event, items });
    },

    close: (): void => {
        console.log("Context menu closed");
    }
};

// Main BdApi class
export class BdApiClass {
    static version: string = "Testcord BD Compatibility Layer v1.0";
    static Plugins: BdPluginAPI;
    static Themes: BdThemeAPI;
    static Patcher: BdPatcher;
    static Data: BdData;
    static DOM: BdDOM;
    static Logger: BdLogger;
    static Webpack: typeof BdWebpack;
    static UI: typeof BdUI;
    static React: typeof React;
    static ReactDOM: typeof ReactDOM;
    static Utils: typeof BdUtils;
    static ContextMenu: typeof BdContextMenu;
    static Components: Record<string, any>;
    static Flux: typeof FluxDispatcher;
    static Net: { fetch: typeof fetch; };

    private pluginName: string;
    public Patcher: BdPatcher;
    public Data: BdData;
    public DOM: BdDOM;
    public Logger: BdLogger;
    public Webpack: typeof BdWebpack;

    constructor(pluginName?: string) {
        this.pluginName = pluginName || "";
        this.Patcher = new BdPatcher(pluginName);
        this.Data = new BdData(pluginName);
        this.DOM = new BdDOM(pluginName);
        this.Logger = new BdLogger(pluginName);
        this.Webpack = BdWebpack; // Instance reference for plugins
    }

    static noConflict(): typeof BdApiClass {
        return BdApiClass;
    }
}

// Plugin API for BD plugins
class BdPluginAPI {
    private pluginFolder: string = "Betterdiscordplugins";

    get folder(): string {
        return this.pluginFolder;
    }

    isEnabled(pluginId: string): boolean {
        // Check if plugin is enabled in settings
        const settings = localStorage.getItem("Testcord_BDPlugins_enabled");
        if (!settings) return false;
        const enabled: string[] = JSON.parse(settings);
        return enabled.includes(pluginId);
    }

    enable(pluginId: string): void {
        const settings = localStorage.getItem("Testcord_BDPlugins_enabled");
        const enabled: string[] = settings ? JSON.parse(settings) : [];
        if (!enabled.includes(pluginId)) {
            enabled.push(pluginId);
            localStorage.setItem("Testcord_BDPlugins_enabled", JSON.stringify(enabled));
        }
    }

    disable(pluginId: string): void {
        const settings = localStorage.getItem("Testcord_BDPlugins_enabled");
        if (!settings) return;
        const enabled: string[] = JSON.parse(settings);
        const index = enabled.indexOf(pluginId);
        if (index > -1) {
            enabled.splice(index, 1);
            localStorage.setItem("Testcord_BDPlugins_enabled", JSON.stringify(enabled));
        }
    }

    toggle(pluginId: string): void {
        if (this.isEnabled(pluginId)) {
            this.disable(pluginId);
        } else {
            this.enable(pluginId);
        }
    }

    get(pluginId: string): any {
        // Get plugin instance from the global registry
        return (window as any).TestcordBDPlugins?.[pluginId];
    }

    getAll(): any[] {
        return Object.values((window as any).TestcordBDPlugins || {});
    }
}

// Theme API (simplified)
class BdThemeAPI {
    private themeFolder: string = "themes";

    get folder(): string {
        return this.themeFolder;
    }

    isEnabled(themeId: string): boolean {
        const settings = localStorage.getItem("Testcord_BDThemes_enabled");
        if (!settings) return false;
        const enabled: string[] = JSON.parse(settings);
        return enabled.includes(themeId);
    }

    enable(themeId: string): void {
        const settings = localStorage.getItem("Testcord_BDThemes_enabled");
        const enabled: string[] = settings ? JSON.parse(settings) : [];
        if (!enabled.includes(themeId)) {
            enabled.push(themeId);
            localStorage.setItem("Testcord_BDThemes_enabled", JSON.stringify(enabled));
        }
    }

    disable(themeId: string): void {
        const settings = localStorage.getItem("Testcord_BDThemes_enabled");
        if (!settings) return;
        const enabled: string[] = JSON.parse(settings);
        const index = enabled.indexOf(themeId);
        if (index > -1) {
            enabled.splice(index, 1);
            localStorage.setItem("Testcord_BDThemes_enabled", JSON.stringify(enabled));
        }
    }

    toggle(themeId: string): void {
        if (this.isEnabled(themeId)) {
            this.disable(themeId);
        } else {
            this.enable(themeId);
        }
    }

    get(themeId: string): any {
        return (window as any).TestcordBDThemes?.[themeId];
    }

    getAll(): any[] {
        return Object.values((window as any).TestcordBDThemes || {});
    }
}

// Initialize static properties
BdApiClass.Plugins = new BdPluginAPI();
BdApiClass.Themes = new BdThemeAPI();
BdApiClass.Patcher = new BdPatcher();
BdApiClass.Data = new BdData();
BdApiClass.DOM = new BdDOM();
BdApiClass.Logger = new BdLogger();
BdApiClass.Webpack = BdWebpack;
BdApiClass.UI = BdUI;
BdApiClass.React = React;
BdApiClass.ReactDOM = ReactDOM;
BdApiClass.Utils = BdUtils;
BdApiClass.ContextMenu = BdContextMenu;
BdApiClass.Components = {};
BdApiClass.Flux = FluxDispatcher;
BdApiClass.Net = { fetch };

// Export the main class and a factory function
export const BdApi = BdApiClass;

export function createBdApi(pluginName: string): BdApiClass {
    return new BdApiClass(pluginName);
}
