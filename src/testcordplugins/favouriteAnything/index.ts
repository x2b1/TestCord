/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 nin0
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "FavouriteAnything",
    description: "Favourite any image",
    authors: [Devs.nin0dev],
    patches: [
        {
            find: "static isAnimated",
            replacement: {
                match: /static isAnimated\(\i\){/,
                replace: "$& return true;"
            }
        }
    ]
});
