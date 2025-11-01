/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";

import { types } from "../../philsPluginLibrary";

export const PluginInfo = {
    PLUGIN_NAME: "BetterScreenshare",
    DESCRIPTION: "Allows you to further customize your screen sharing",
    AUTHOR: {
        ...Devs.phil,
        github: "https://github.com/philhk"
    },
    CONTRIBUTORS: {
        walrus: {
            github: "https://github.com/philhk",
            id: 305317288775778306n,
            name: "walrus"
        },
        Loukious: {
            github: "https://github.com/loukious",
            id: 211461918127292416n,
            name: "Loukious"
        }
    },
    README: "https://github.com/RobinRMC/VencordPlus/tree/main/src/plusplugins/betterScreenshare.desktop"
} as const satisfies types.PluginInfo;
