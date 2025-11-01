/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { PluginAuthor } from "@utils/types";

export type Author = PluginAuthor & { github?: string; };
export type Contributor = Author;

export interface PluginInfo {
    [key: string]: any;
    PLUGIN_NAME: string,
    DESCRIPTION: string,
    AUTHOR: PluginAuthor & { github?: string; },
    CONTRIBUTORS?: Record<string, PluginAuthor & { github?: string; }>,
    README?: string;
}
