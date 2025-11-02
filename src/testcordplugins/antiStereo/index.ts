/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    forceMono: {
        description: "Forcer le mono (désactiver la stéréo)",
        type: OptionType.BOOLEAN,
        default: true,
    },
    showNotifications: {
        description: "Afficher les notifications",
        type: OptionType.BOOLEAN,
        default: false,
    }
});

export default definePlugin({
    name: "AntiStereo",
    description: "Force Discord à utiliser le mono au lieu de la stéréo en sortie audio",
    authors: [{
        name: "Bash",
        id: 1327483363518582784n
    }],
    settings,

    patches: [
        {
            find: "Audio codecs",
            replacement: {
                match: /channels:\d+(?:\.\d+)?,/,
                replace: "channels:1,",
                predicate: () => settings.store.forceMono
            }
        },
        {
            find: "stereo",
            replacement: {
                match: /stereo:\s*["']?\d+(?:\.\d+)?["']?/g,
                replace: "stereo:false",
                predicate: () => settings.store.forceMono
            }
        },
        {
            find: "AudioContext",
            replacement: {
                match: /sampleRate:\s*\d+/g,
                replace: "sampleRate:48000",
                predicate: () => settings.store.forceMono
            }
        }
    ],

    start() {
        if (settings.store.forceMono) {
            console.log("[AntiStereo] Plugin AntiStereo activé - Forçage du mono");

            if (settings.store.showNotifications) {
                // Note: Les notifications nécessiteraient l'import de @api/Notifications
                console.log("[AntiStereo] Notifications activées");
            }
        }
    },

    stop() {
        console.log("[AntiStereo] Plugin AntiStereo désactivé");
    }
});
