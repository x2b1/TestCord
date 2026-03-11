/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    enableCustomBadges: {
        type: OptionType.BOOLEAN,
        description: "Enable custom testcord badges from tbadges GitHub repository",
        default: true,
    }
});

export default definePlugin({
    name: "TestcordHelper",
    description: "Helper plugin for Testcord features, including custom badge management.",
    authors: [{ name: "x2b", id: 996137713432530976n }],
    required: true,
    settings,

    // This plugin just provides settings and helper functions.
    // The actual badge loading is handled by BadgeAPI which loads from tbadges repo.
    start() {
        // Badges are loaded automatically by BadgeAPI
    },

    stop() {
        // Cleanup if needed
    }
});
