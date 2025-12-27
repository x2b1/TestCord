/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { RestAPI, UserStore } from "@webpack/common";
import { Message } from "discord-types/general";

import selfPlugin from ".";

export default definePlugin({
    name: "Huskbot",
    description: "A bot to husk. THIS IS A SELFBOT AND MIGHT GET YOU BANNED",
    authors: [Devs.nin0dev],
    settings: definePluginSettings({
        channelIDs: {
            type: OptionType.STRING,
            description: "Comma-separated list of channel IDs to watch"
        },
        userIDs: {
            type: OptionType.STRING,
            description: "Comma-separated list of user IDs to ignore"
        },
        maxChars: {
            type: OptionType.NUMBER,
            description: "Maximum chars to check",
            default: 500
        }
    }),
    flux: {
        async MESSAGE_CREATE
            ({ guildId, message }) {

            const msg = message as Message;
            if (UserStore.getCurrentUser().id === msg.author.id || selfPlugin.settings.store.userIDs?.split(",").includes(msg.author.id)) return;
            if (!selfPlugin.settings.store.channelIDs?.split(",").includes(msg.channel_id) || msg.content.length > selfPlugin.settings.store.maxChars) return;

            const res = await fetch("https://huskapi.nin0.dev", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: msg.content
                })
            });
            const content = await res.json();
            if (content.huskable) RestAPI.put({
                url: `/channels/${msg.channel_id}/messages/${msg.id}/reactions/huisk:1226906570055749652/@me`
            });
        },
    }
});
