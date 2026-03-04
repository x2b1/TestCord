/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { definePluginSettings } from "@api/Settings";
import { classNameFactory } from "@api/Styles";
import { TestcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

import { LivePluginEditor } from "./components/Editor";

const STORAGE_KEY = "testcord-live-plugins";

export interface LivePlugin {
    id: string;
    name: string;
    code: string;
    enabled: boolean;
    description?: string;
}

export const classFactory = classNameFactory("vc-live-plugin-editor-");

export const defaultPluginCode = `// Welcome to Live Plugin Editor!
// Write your plugin code here using definePlugin

definePlugin({
    name: "MyPlugin",
    description: "My awesome plugin",
    authors: [{ name: "You", id: 0n }],
    start() {
        console.log("Plugin started!");
    },
    stop() {
        console.log("Plugin stopped!");
    }
});
`;

export const settings = definePluginSettings({
    plugins: {
        type: OptionType.COMPONENT,
        component: LivePluginEditor,
        description: "Manage your live plugins",
    }
});

export function generateId(): string {
    return Math.random().toString(36).substring(2, 15);
}

export function getStoredPlugins(): LivePlugin[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

export function savePlugins(plugins: LivePlugin[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plugins));
}

export function createPlugin(name: string, code: string = defaultPluginCode): LivePlugin {
    return {
        id: generateId(),
        name,
        code,
        enabled: true,
        description: ""
    };
}

// Expose for hot-reloading
export const livePlugins: Map<string, { plugin: LivePlugin; instance: any; }> = new Map();

export function loadLivePlugin(plugin: LivePlugin): boolean {
    try {
        // Stop existing instance if any
        if (livePlugins.has(plugin.id)) {
            const existing = livePlugins.get(plugin.id);
            if (existing?.instance?.stop) {
                existing.instance.stop();
            }
        }

        if (!plugin.enabled) {
            livePlugins.delete(plugin.id);
            return true;
        }

        // Create a sandboxed function to evaluate the plugin code
        const wrappedCode = `
            (function(definePlugin, VencordNative, module, exports, require) {
                ${plugin.code}
            })
        `;

        const factory = new Function("definePlugin", "VencordNative", "module", "exports", "require", `
            return (${wrappedCode})(definePlugin, VencordNative, module, exports, require);
        `);

        // Create module context
        const moduleObj = { exports: {} };
        const requireObj = (path: string) => {
            if (path.startsWith("@")) {
                return () => ({});
            }
            return () => ({});
        };

        const pluginFactory = factory(
            (def: any) => def,
            VencordNative,
            moduleObj,
            moduleObj.exports,
            requireObj
        );

        if (pluginFactory && typeof pluginFactory === "function") {
            const instance = pluginFactory();
            livePlugins.set(plugin.id, { plugin, instance });

            if (instance.start) {
                instance.start();
            }
            return true;
        }
    } catch (e) {
        console.error("[LivePluginEditor] Failed to load plugin:", e);
    }
    return false;
}

export function unloadPlugin(pluginId: string): boolean {
    const entry = livePlugins.get(pluginId);
    if (entry?.instance?.stop) {
        try {
            entry.instance.stop();
        } catch (e) {
            console.error("[LivePluginEditor] Error stopping plugin:", e);
        }
    }
    return livePlugins.delete(pluginId);
}

export function reloadPlugin(plugin: LivePlugin): boolean {
    unloadPlugin(plugin.id);
    return loadLivePlugin(plugin);
}

export default definePlugin({
    name: "LivePluginEditor",
    description: "An in-app IDE to create, test, and hot-reload simple TestCord plugins without rebuilding the entire client",
    authors: [TestcordDevs.x2b],
    settings,
    start() {
        const plugins = getStoredPlugins();
        plugins.forEach(plugin => {
            if (plugin.enabled) {
                loadLivePlugin(plugin);
            }
        });
    },
    stop() {
        livePlugins.forEach((_, id) => {
            unloadPlugin(id);
        });
    }
});
