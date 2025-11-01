/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";

import * as types from "../types/constants";

export const PluginInfo: types.PluginInfo = {
    PLUGIN_NAME: "PhilsPluginLibrary",
    DESCRIPTION: "A library for Phil's plugins",
    AUTHOR: {
        ...Devs.phil,
        github: "https://github.com/philhk"
    },
} as const;
