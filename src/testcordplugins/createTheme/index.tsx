/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 * 
 * This folder's components are used by src/plugins/_core/settings.tsx.
 * This file exists only to satisfy the equicordplugins auto-discovery bundler.
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "CreateTheme",
    description: "Create Theme UI — registered via settings.tsx",
    authors: [Devs.Ven],
    required: false,
});
