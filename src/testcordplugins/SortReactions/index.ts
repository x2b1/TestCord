/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Copyright (c) 2024 HAHALOSAH. All rights reserved.
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "SortReactions",
    description: "Sorts reactions by count in chat.",
    authors: [Devs.HAHALOSAH],
    patches: [
        {
            find: 'location:"message_reactions"',
            replacement: [
                {
                    match: /{reactions:(\i),/,
                    replace: "{reactions:$1.sort((a,b)=>b.count-a.count),",
                },
            ],
        },
    ],
});
