/*
 * Testcord BetterDiscord Plugin Manager
 * This plugin manages BD plugin settings and provides the global API
 */

import definePlugin from "@utils/types";
import { Logger } from "@utils/Logger";
import { BDPluginManager } from "./PluginManager";
import { bundledPlugins } from "./bundledPlugins";

const logger = new Logger("BetterDiscordPlugins", "#ff7373");

export default definePlugin({
    name: "BetterDiscordPlugins",
    description: "Load BetterDiscord .plugin.js files. Place your plugins in the Betterdiscordplugins folder.",
    authors: [{ name: "Testcord Team", id: 0n }],
    version: "1.0.0",
    required: true,
    tags: ["betterdiscord", "bd", "loader"],
    start: () => {
        logger.info("BetterDiscord Plugin Support started");
        BDPluginManager.loadAllPlugins();
    },
    stop: () => {
        logger.info("BetterDiscord Plugin Support stopped");
        BDPluginManager.getAllPlugins().forEach(p => {
            if (p.enabled) BDPluginManager.stopPlugin(p.id);
        });
    }
});

// Global debug API
if (typeof window !== "undefined") {
    (window as any).TestcordBD = {
        loadPlugin: (name: string, code: string) => BDPluginManager.loadPlugin(name, code),
        startPlugin: (id: string) => BDPluginManager.startPlugin(id),
        stopPlugin: (id: string) => BDPluginManager.stopPlugin(id),
        togglePlugin: (id: string) => BDPluginManager.togglePlugin(id),
        getPlugin: (id: string) => BDPluginManager.getPlugin(id),
        getAllPlugins: () => BDPluginManager.getAllPlugins(),
        reloadAll: () => BDPluginManager.loadAllPlugins(),
        manager: BDPluginManager,
        bundledPlugins
    };
}
