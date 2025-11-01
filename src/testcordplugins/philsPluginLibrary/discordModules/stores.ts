/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { waitForStore } from "webpack/common/internal";

import * as types from "../types";

export let MediaEngineStore: types.MediaEngineStore;

waitForStore("MediaEngineStore", store => MediaEngineStore = store);
