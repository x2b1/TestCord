/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "NoDraftLengthLimit",
    description: "Removes the 4500 character saved draft message truncation",
    authors: [Devs.Sqaaakoi],
    patches: [
        {
            find: "MAX_MESSAGE_LENGTH_PREMIUM+500",
            replacement: {
                match: /=[^=]{0,20}MAX_MESSAGE_LENGTH_PREMIUM\+500/,
                replace: "=Infinity"
            }
        }
    ]
});
