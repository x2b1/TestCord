/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption } from "@api/Commands";
import { Devs } from "@utils/constants";
import { openUserProfile } from "@utils/discord";
import definePlugin from "@utils/types";
import { UserStore } from "@webpack/common";

export default definePlugin({
    name: "ProfileCommand",
    description: "Adds a /profile command to open someone's profile",
    authors: [Devs.Sqaaakoi],
    dependencies: ["CommandsAPI"],
    commands: [
        {
            name: "profile",
            description: "Open a user profile",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [{
                name: "user",
                description: "The user profile you want to view. Leave empty to view your own profile",
                required: false,
                type: ApplicationCommandOptionType.USER
            }],
            execute: (args, _ctx) => openUserProfile(findOption(args, "user", UserStore.getCurrentUser().id))
        }
    ]
});
