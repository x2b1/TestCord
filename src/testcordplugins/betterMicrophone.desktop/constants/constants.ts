/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";

import { types } from "../../philsPluginLibrary";

export const PluginInfo = {
    PLUGIN_NAME: "BetterMicrophone",
    DESCRIPTION: "Allows you to further customize your microphone",
    AUTHOR: {
        ...Devs.phil,
        github: "https://github.com/philhk"
    },
    CONTRIBUTORS: {}
} as const satisfies types.PluginInfo;
