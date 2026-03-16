/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, sendBotMessage } from "@api/Commands";
import { addMessagePopoverButton as addButton, removeMessagePopoverButton as removeButton } from "@api/MessagePopover";
import { definePluginSettings } from "@api/Settings";
import { TestcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { ChannelStore, Constants, RestAPI, UserStore } from "@webpack/common";
const MessageActions = findByPropsLazy("deleteMessage", "_sendMessage");
const settings = definePluginSettings({
    accentColor: {
        type: OptionType.STRING,
        description: "Accent color for the delete icon (hex code).",
        default: "#ed4245"
    },
    replacementMessage: {
        type: OptionType.STRING,
        description: "Text to replace deleted message with (hides it from message loggers).",
        default: "ₓ"
    },
    deleteDelay: {
        type: OptionType.NUMBER,
        description: "Delay in ms between delete and replacement send (for anti-logging).",
        default: 50
    },
    purgeInterval: {
        type: OptionType.NUMBER,
        description: "Delay in ms between each message deletion during /silentpurgeenhanced.",
        default: 500
    },
    maxPurgeCount: {
        type: OptionType.NUMBER,
        description: "Maximum number of messages to delete in /silentpurgeenhanced.",
        default: 100,
        min: 1,
        max: 999999
    }
});
const getAccentColor = () => settings.store.accentColor || "#ed4245";
const TrashIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={getAccentColor()}>
        <path d="M15 3.999V2H9V3.999H3V5.999H21V3.999H15Z" />
        <path d="M5 6.99902V18.999C5 20.101 5.897 20.999 7 20.999H17C18.103 20.999 19 20.101 19 18.999V6.99902H5ZM11 17H9V11H11V17ZM15 17H13V11H15V17Z" />
    </svg>
);
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
async function antiLogDelete(channelId: string, messageId: string): Promise<boolean> {
    try {
        const { replacementMessage, deleteDelay } = settings.store;
        await MessageActions.deleteMessage(channelId, messageId);
        await sleep(deleteDelay);
        await MessageActions._sendMessage(channelId, {
            content: replacementMessage,
            tts: false,
            invalidEmojis: [],
            validNonShortcutEmojis: []
        }, { nonce: messageId });
        return true;
    } catch (error) {
        console.error("[AntilogPremium] Error:", error);
        return false;
    }
}
export default definePlugin({
    name: "AntilogPremium",
    description: "Delete messages while hiding them from message loggers. Combines best anti-logging methods.",
    authors: [TestcordDevs.x2b],
    dependencies: ["MessagePopoverAPI", "CommandsAPI"],
    settings,
    commands: [
        {
            name: "silentpurgeenhanced",
            description: "Silently delete your recent messages in this channel (hides from message loggers)",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [{
                name: "count",
                description: "Number of messages to delete (1-100)",
                type: ApplicationCommandOptionType.INTEGER,
                required: true,
            }],
            execute: (opts, ctx) => {
                const count = opts.find(o => o.name === "count")?.value as unknown as number;
                const maxCount = settings.store.maxPurgeCount || 100;
                const actualCount = Math.min(count, maxCount);
                if (!actualCount || actualCount < 1) return;
                const channelId = ctx.channel.id;
                const currentUserId = UserStore.getCurrentUser().id;
                (async () => {
                    try {
                        const userMessages: any[] = [];
                        let lastMessageId: string | undefined;
                        while (userMessages.length < actualCount) {
                            const response = await RestAPI.get({
                                url: Constants.Endpoints.MESSAGES(channelId),
                                query: { limit: 100, ...(lastMessageId && { before: lastMessageId }) }
                            });
                            const messages = response.body;
                            if (!messages?.length) break;
                            for (const msg of messages) {
                                if (msg.author?.id === currentUserId) {
                                    userMessages.push(msg);
                                    if (userMessages.length >= actualCount) break;
                                }
                            }
                            lastMessageId = messages[messages.length - 1].id;
                            if (messages.length < 100) break;
                            await sleep(100);
                        }
                        if (!userMessages.length) {
                            sendBotMessage(channelId, { content: "No messages found to delete." });
                            return;
                        }
                        const purgeInterval = settings.store.purgeInterval || 500;
                        let successCount = 0;
                        for (let i = 0; i < userMessages.length; i++) {
                            if (await antiLogDelete(channelId, userMessages[i].id)) successCount++;
                            if (i < userMessages.length - 1) await sleep(purgeInterval);
                        }
                        sendBotMessage(channelId, { content: `Successfully silently deleted ${successCount} message(s).` });
                    } catch (error) {
                        console.error("[AntilogPremium] Error during silent purge:", error);
                    }
                })();
            }
        }
    ],
    start() {
        addButton("AntilogPremium", msg => {
            if (msg.author.id !== UserStore.getCurrentUser().id || msg.deleted) return null;
            return {
                label: "AntiLog Delete",
                icon: TrashIcon,
                message: msg,
                channel: ChannelStore.getChannel(msg.channel_id),
                onClick: () => antiLogDelete(msg.channel_id, msg.id),
                dangerous: true
            };
        }, TrashIcon);
    },
    stop() {
        removeButton("AntilogPremium");
    }
});
