/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findByPropsLazy } from "@webpack";

import * as types from "../types";

export const panelClasses: types.PanelClasses = findByPropsLazy("button", "buttonContents", "buttonColor");

// waitFor(filters.byProps("button", "buttonContents", "buttonColor"), result => panelClasses = result);
