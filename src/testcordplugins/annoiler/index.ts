/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findOption, RequiredMessageOption } from "@api/Commands";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

function annoil(input) {
    input = (input).split("").map(char => {
        return `||${char}||`;
    }).join("");
    return input;
}

export default definePlugin({
    name: "Spoiler",
    description: "Makes you send messages with spoilers around every single character. Originally made by Kyza for Powercord, Usage: /annoil",
    authors: [Devs.vbajs, Devs.kyza, Devs.luckycanucky],
    dependencies: ["CommandsAPI"],
    commands: [
        {
            name: "annoil",
            description: "Makes you send messages with spoilers around every single character.",
            options: [RequiredMessageOption],
            execute: opts => ({
                content: annoil(findOption(opts, "message", ""))
            }),
        },
    ],
});
