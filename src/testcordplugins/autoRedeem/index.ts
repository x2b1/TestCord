/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { LogIcon } from "@components/Icons";
import SettingsPlugin from "@plugins/_core/settings";
import { TestcordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import { removeFromArray } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { Message } from "@vencord/discord-types";
import { RestAPI, showToast, Toasts, UserStore } from "@webpack/common";

import { addLog, type RedeemType } from "./store";

const logger = new Logger("AutoRedeem");

const GIFT_REGEX = /discord(?:\.gift|\.com\/gifts|app\.com\/gifts)\/([a-zA-Z0-9]+)/g;
const SETTINGS_KEY = "autoredeem_logs";

interface IMessageCreate {
    type: "MESSAGE_CREATE";
    optimistic: boolean;
    channelId: string;
    message: Message;
}

function classifyGift(data: any): RedeemType {
    const name: string = (data?.subscription_plan?.name ?? data?.store_listing?.sku?.name ?? "").toLowerCase();
    if (name.includes("nitro") || name.includes("boost")) return "nitro";
    if (name.includes("decoration") || name.includes("avatar") || name.includes("profile")) return "decoration";
    return "other";
}

const settings = definePluginSettings({
    ignoreSelf: {
        type: OptionType.BOOLEAN,
        description: "Ignore gifts sent by yourself",
        default: false,
    },
    ignoreBots: {
        type: OptionType.BOOLEAN,
        description: "Ignore gifts sent by bots",
        default: true,
    },
});

export default definePlugin({
    name: "AutoRedeem",
    description: "Automatically redeems any Discord gift link (Nitro, decorations, etc.) sent in any channel.",
    authors: [TestcordDevs.x2b],
    settings,

    start() {
        if (!SettingsPlugin.customEntries.some(e => e.key === SETTINGS_KEY)) {
            SettingsPlugin.customEntries.push({
                key: SETTINGS_KEY,
                title: "AutoRedeem Logs",
                Component: require("./components/LogTab").default,
                Icon: LogIcon,
            });
        }
    },

    stop() {
        removeFromArray(SettingsPlugin.customEntries, e => e.key === SETTINGS_KEY);
    },

    flux: {
        async MESSAGE_CREATE({ optimistic, type, message }: IMessageCreate) {
            if (optimistic || type !== "MESSAGE_CREATE") return;
            if (message.state === "SENDING") return;
            if (settings.store.ignoreBots && message.author?.bot) return;
            if (settings.store.ignoreSelf && message.author?.id === UserStore.getCurrentUser()?.id) return;

            const codes = [...message.content.matchAll(GIFT_REGEX)].map(m => m[1]);
            for (const code of codes) {
                try {
                    const { body } = await RestAPI.post({
                        url: `/entitlements/gift-codes/${code}/redeem`,
                        body: { channel_id: null },
                    });
                    const giftType = classifyGift(body);
                    await addLog({ code, status: "success", type: giftType });
                    showToast(`Redeemed gift: ${code}`, Toasts.Type.SUCCESS);
                    logger.info(`Redeemed gift code: ${code}`);
                } catch (e: any) {
                    const msg = e?.body?.message ?? "Unknown error";
                    await addLog({ code, status: "failed", type: "other", error: msg });
                    showToast(`Failed to redeem ${code}: ${msg}`, Toasts.Type.FAILURE);
                    logger.warn(`Failed to redeem ${code}:`, msg);
                }
            }
        },
    },
});
