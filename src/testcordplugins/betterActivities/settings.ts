/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    memberList: {
        type: OptionType.BOOLEAN,
        description: "Show activity icons in the member list",
        default: true,
        restartNeeded: true,
    },
    iconSize: {
        type: OptionType.SLIDER,
        description: "Size of the activity icons",
        markers: [10, 15, 20],
        default: 15,
        stickToMarkers: false,
    },
    specialFirst: {
        type: OptionType.BOOLEAN,
        description: "Show special activities first (Currently Twitch)",
        default: true,
        restartNeeded: false,
    },
    userPopout: {
        type: OptionType.BOOLEAN,
        description: "Show all activities in the profile popout/sidebar",
        default: true,
        restartNeeded: true,
    },
});
