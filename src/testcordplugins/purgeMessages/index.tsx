/*
 * Equicord, a modification for Discord's desktop app
 * Copyright (c) 2022 Equicord and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import "./style.css";

import {
    ApplicationCommandInputType,
    ApplicationCommandOptionType,
    findOption,
    sendBotMessage,
} from "@api/Commands";
import { Devs, EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { Forms, MessageStore, UserStore } from "@webpack/common";

// Find the message actions we need
const MessageActions = findByPropsLazy("deleteMessage", "startEditMessage");

async function deleteMessages(
    amount: number,
    channelId: string,
    delay: number = 1500
): Promise<number> {
    let deleted = 0;
    const userId = UserStore.getCurrentUser().id;

    try {
        // Get messages from the channel using MessageStore
        const messagesData = MessageStore.getMessages(channelId);

        if (!messagesData) {
            console.error(
                "[PurgeMessages] No messages data found in channel:",
                channelId
            );
            return 0;
        }

        // Extract messages - try different approaches based on MessageStore structure
        let allMessages: any[] = [];

        // Try _map approach (like messageBurst plugin)
        if (messagesData._map) {
            allMessages = Object.values(messagesData._map);
        }
        // Try _array approach (like quickReply plugin)
        else if (messagesData._array) {
            allMessages = Array.from(messagesData._array);
        }
        // Try toArray method
        else if (messagesData.toArray) {
            allMessages = messagesData.toArray();
        }
        // Fallback to Object.values
        else if (typeof messagesData === "object") {
            allMessages = Object.values(messagesData).filter(
                (msg: any) => msg && typeof msg === "object" && msg.id
            );
        }

        console.log(
            `[PurgeMessages] Total messages in store: ${allMessages.length}`
        );

        // Filter to only user's messages and sort by timestamp (newest first)
        const userMessages = allMessages
            .filter((msg: any) => msg && msg.author && msg.author.id === userId)
            .sort(
                (a: any, b: any) =>
                    new Date(b.timestamp).getTime() -
                    new Date(a.timestamp).getTime()
            );

        console.log(
            `[PurgeMessages] Found ${userMessages.length} messages from user in channel ${channelId}`
        );

        if (userMessages.length === 0) {
            console.warn("[PurgeMessages] No messages found from current user");
            return 0;
        }

        // Delete messages with delay
        for (let i = 0; i < Math.min(amount, userMessages.length); i++) {
            const message = userMessages[i];

            try {
                console.log(
                    `[PurgeMessages] Deleting message ${i + 1}/${amount}: ${
                        message.id
                    }`
                );
                MessageActions.deleteMessage(channelId, message.id);
                deleted++;

                // Add delay between deletions (except for the last one)
                if (
                    delay > 0 &&
                    i < Math.min(amount, userMessages.length) - 1
                ) {
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            } catch (error) {
                console.error(
                    `[PurgeMessages] Failed to delete message ${message.id}:`,
                    error
                );
            }
        }
    } catch (error) {
        console.error(
            "[PurgeMessages] Error in deleteMessages function:",
            error
        );
    }

    return deleted;
}

export default definePlugin({
    name: "PurgeMessages",
    description:
        "Purge your own messages from any channel with customizable delay",
    authors: [EquicordDevs.bhop, Devs.nyx],

    // Better settings component with more warnings
    settingsAboutComponent: () => (
        <div className="purge-settings">
            <Forms.FormText>
                ⚠️ Use with caution! This plugin may trigger Discord's anti-spam
                systems.
            </Forms.FormText>
            <Forms.FormText>
                🔍 Make sure you have proper permissions in the target channel.
            </Forms.FormText>
            <Forms.FormText>
                ⏱️ Higher delays (2000ms+) are recommended to avoid rate limits.
            </Forms.FormText>
        </div>
    ),

    commands: [
        {
            name: "purge",
            description: "Delete your recent messages from a channel",
            options: [
                {
                    name: "amount",
                    description: "Number of your messages to delete (max 100)",
                    type: ApplicationCommandOptionType.INTEGER,
                    required: true,
                },
                {
                    name: "channel",
                    description:
                        "Channel to purge messages from (default: current channel)",
                    type: ApplicationCommandOptionType.CHANNEL,
                    required: false,
                },
                {
                    name: "delay",
                    description:
                        "Delay between deletions in milliseconds (default: 1500)",
                    type: ApplicationCommandOptionType.INTEGER,
                    required: false,
                },
            ],
            inputType: ApplicationCommandInputType.BUILT_IN,

            execute: async (opts, ctx) => {
                try {
                    const amount = findOption(opts, "amount", 0);
                    const channel = findOption(opts, "channel", ctx.channel);
                    const delay = findOption(opts, "delay", 1500);

                    // Input validation
                    if (amount <= 0 || amount > 100) {
                        sendBotMessage(ctx.channel.id, {
                            content:
                                "❌ Please specify a number between 1 and 100.",
                        });
                        return;
                    }

                    if (delay < 0 || delay > 10000) {
                        sendBotMessage(ctx.channel.id, {
                            content:
                                "❌ Delay must be between 0 and 10000 milliseconds.",
                        });
                        return;
                    }

                    // Send initial confirmation
                    await sendBotMessage(ctx.channel.id, {
                        content: `🔄 Preparing to delete your last ${amount} messages${
                            delay > 0 ? ` with ${delay}ms delay` : ""
                        }...`,
                    });

                    // Execute the purge
                    const deletedCount = await deleteMessages(
                        amount,
                        channel.id,
                        delay
                    );

                    // Send result
                    if (deletedCount === 0) {
                        sendBotMessage(ctx.channel.id, {
                            content:
                                "❌ No messages found to delete. Make sure you have sent messages in this channel.",
                        });
                    } else if (deletedCount < amount) {
                        sendBotMessage(ctx.channel.id, {
                            content: `⚠️ Deleted ${deletedCount} messages (requested ${amount}). You may not have enough messages in this channel.`,
                        });
                    } else {
                        sendBotMessage(ctx.channel.id, {
                            content: `✅ Successfully deleted ${deletedCount} messages!`,
                        });
                    }
                } catch (error) {
                    console.error(
                        "[PurgeMessages] Command execution error:",
                        error
                    );
                    sendBotMessage(ctx.channel.id, {
                        content: `❌ Unexpected error: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`,
                    });
                }
            },
        },
    ],
});
