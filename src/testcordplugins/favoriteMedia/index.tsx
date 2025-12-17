/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { disableStyle, enableStyle } from "@api/Styles";
import { Devs, EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

import style from "./style.css?managed";

export default definePlugin({
    name: "FavoriteMedia",
    description: "Favorite any type of media",
    authors: [Devs.ImLvna, EquicordDevs.x2b],

    patches: [
        {
            find: "/\\.gif($|\\?|#)/i",
            replacement: {
                match: "/\\.gif($|\\?|#)/i",
                replace: "/\\.(gif|png|jpe?g|webp|mp4|mov)($|\\?|#)/i"
            },
        }
    ],

    start() {
        enableStyle(style);
    },
    stop() {
        disableStyle(style);
    }
});



