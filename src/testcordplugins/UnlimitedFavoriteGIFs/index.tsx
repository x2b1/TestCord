/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { showToast, Toasts } from "@webpack/common";

const LOCAL_FAVS_KEY = "UnlimitedFavoriteGIFs_localFavs";

function log(...args: any[]) { console.log("[UnlimitedFavoriteGIFs]", ...args); }
function warn(...args: any[]) { console.warn("[UnlimitedFavoriteGIFs]", ...args); }

async function getLocalFavs(): Promise<any[]> {
    return (await DataStore.get(LOCAL_FAVS_KEY)) ?? [];
}

async function saveLocalFavs(list: any[]): Promise<void> {
    await DataStore.set(LOCAL_FAVS_KEY, list);
}

function gifKey(gif: any): string {
    if (typeof gif === "string") return gif;
    return gif?.url ?? gif?.src ?? JSON.stringify(gif);
}

const settings = definePluginSettings({
    exportFavs: {
        type: OptionType.COMPONENT,
        description: "Export local favorites to clipboard as JSON",
        component: () => {
            const { Button } = require("@webpack/common");
            return (
                <Button onClick={async () => {
                    const favs = await getLocalFavs();
                    if (!favs.length) {
                        showToast("No local favorites to export.", Toasts.Type.FAILURE);
                        return;
                    }
                    navigator.clipboard.writeText(JSON.stringify(favs, null, 2));
                    showToast(`Copied ${favs.length} favorites to clipboard.`, Toasts.Type.SUCCESS);
                }}>
                    Export Local Favorites (JSON)
                </Button>
            );
        }
    },
    clearLocalFavs: {
        type: OptionType.COMPONENT,
        description: "Clear all locally saved favorites",
        component: () => {
            const { Button } = require("@webpack/common");
            return (
                <Button color={Button.Colors.RED} onClick={async () => {
                    await saveLocalFavs([]);
                    showToast("Local favorites cleared.", Toasts.Type.SUCCESS);
                }}>
                    Clear Local Favorites
                </Button>
            );
        }
    }
});

export default definePlugin({
    name: "UnlimitedFavoriteGIFs",
    description: "Bypasses the native GIF favorites size limit by patching FrecencyUserSettings.",
    authors: [{ name: "www.miau.com", id: 1485706082080002140n }],
    settings,

    patches: [
        {
            // Module 497685 — function wg/K — the real limit check:
            // if(o.uz.toBinary(t).length > 762880) { show error toast; return false; }
            // We find the module by a unique string inside that function and kill the condition.
            find: "toBinary(t).length>762880",
            replacement: {
                match: /\.toBinary\(t\)\.length>762880/,
                replace: ".toBinary(t).length>Number.MAX_SAFE_INTEGER",
            }
        },
        {
            // Fallback: some Discord versions use a variable instead of the literal
            find: "toBinary(t).length>",
            replacement: {
                match: /\.toBinary\(t\)\.length>\d+/,
                replace: ".toBinary(t).length>Number.MAX_SAFE_INTEGER",
            }
        },
    ],

    async start() {
        log("Plugin started.");
        log(`Local favs in DataStore: ${(await getLocalFavs()).length}`);
    },

    stop() {
        log("Plugin stopped.");
    }
});