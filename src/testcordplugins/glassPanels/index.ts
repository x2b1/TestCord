/*
 * MallCord, a vaporwave-inspired Discord client mod
 * Copyright (c) 2026 unfamiliardev
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { disableStyle, enableStyle } from "@api/Styles";
import definePlugin from "@utils/types";

import style from "./style.css?managed";

export default definePlugin({
    name: "GlassPanels",
    description: "Frosted-glass blur on the sidebar and member list.",
    authors: [{ name: "Sharp", id: 0n }],
    start: () => enableStyle(style),
    stop: () => disableStyle(style),
});
