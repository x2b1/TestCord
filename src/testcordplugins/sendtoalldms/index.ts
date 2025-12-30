/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, findOption, RequiredMessageOption } from "@api/Commands";
import { definePluginSettings } from "@api/Settings";
import { TestcordDevs } from "@utils/constants";
import { sendMessage } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";
import { CommandArgument, CommandContext } from "@vencord/discord-types";
import { ChannelActionCreators, ChannelStore, RelationshipStore } from "@webpack/common";

export default definePlugin({
    name: "SendToAllDMs",
    description: "Adds a command to send a message to all friends' DMs with blacklist/whitelist settings",
    authors: [TestcordDevs.x2b], // Placeholder, adjust as needed
    settings: definePluginSettings({
        useWhitelist: {
            type: OptionType.BOOLEAN,
            description: "If true, use whitelist mode (only send to listed IDs). If false, use blacklist mode (exclude listed IDs).",
            default: false
        },
        userIds: {
            type: OptionType.STRING,
            description: "Comma-separated list of user IDs for blacklist/whitelist",
            default: ""
        }
    }),
    commands: [
        {
            name: "sendtoalldms",
            description: "Send a message to all friends' DMs",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [RequiredMessageOption],
            execute: async (opts: CommandArgument[], ctx: CommandContext) => {
                const message = findOption(opts, "message", "");
                if (!message) return;

                let friends = RelationshipStore.getFriendIDs();

                const { useWhitelist, userIds } = (Vencord.Plugins.plugins.SendToAllDMs as any).settings.store;
                const idList = userIds.split(",").map(id => id.trim()).filter(id => id);

                if (useWhitelist) {
                    friends = friends.filter(id => idList.includes(id));
                } else {
                    friends = friends.filter(id => !idList.includes(id));
                }

                for (const userId of friends) {
                    try {
                        ChannelActionCreators.openPrivateChannel(userId);
                        const channelId = ChannelStore.getDMFromUserId(userId);
                        if (channelId) {
                            await sendMessage(channelId, { content: message });
                        }
                    } catch (e) {
                        console.error(`Failed to send message to ${userId}:`, e);
                    }
                }
            }
        }
    ]
});

const selfPlugin = Vencord.Plugins.plugins.SendToAllDMs;
