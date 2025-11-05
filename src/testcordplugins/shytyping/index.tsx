/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, MessageStore, SelectedChannelStore, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    currentVC: {
        type: OptionType.BOOLEAN,
        description: "Always show you are typing in your current voice channel",
        default: true
    },
    threshold: {
        type: OptionType.NUMBER,
        description: "Last message must be sent in the current channel within the past [threshold] seconds for the typing indicator to be shown",
        default: 300
    },
    thresholdInDms: {
        type: OptionType.NUMBER,
        description: "Threshold above, for DMs and group chats",
        default: 86400
    }
});

export default definePlugin({
    name: "ShyTyping",
    description: "Prevents you from accidentally revealing that you're lurking in a channel",
    authors: [Devs.Sqaaakoi],
    settings,
    patches: [
        {
            // This patch is intentionally different to the patch used in SilentTyping, so they can be compatible with each other
            find: '"TypingStore"',
            replacement: {
                match: /(TYPING_START_LOCAL:)(\i)/,
                replace: "$1$self.wrap($2)"
            }
        }
    ],

    wrap(startTyping: ({ channelId }: { channelId: string; }) => void) {
        return (e: { channelId: string; }) => {
            return this.shouldStartTyping(e.channelId) && startTyping(e);
        };
    },

    shouldStartTyping(channelId: string): boolean {
        if (settings.store.currentVC && SelectedChannelStore.getVoiceChannelId() === channelId) return true;
        const threshold = Date.now() - (settings.store[ChannelStore.getChannel(channelId).isPrivate() ? "thresholdInDms" : "threshold"] * 1000);
        // discord-types and the MessageStore types are so wrong and cursed
        const lastMessage = (MessageStore as any).getLastEditableMessage(channelId);
        if (lastMessage && lastMessage?.timestamp > threshold) return true;

        return false;
    }
});
