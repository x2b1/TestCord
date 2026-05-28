/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { TestcordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { MessageActions } from "@webpack/common";

const CORS_PROXY = "https://cors.keiran0.workers.dev?url=";

interface ApiSource {
    name: string;
    endpoint: string;
    parse: (data: any) => string | null;
}

// Ordered by priority — first that succeeds wins.
const API_LIST: ApiSource[] = [
    {
        name: "PurrBot",
        endpoint: CORS_PROXY + encodeURIComponent("https://api.purrbot.site/v2/img/nsfw/yuri/gif"),
        // PurrBot returns: { error: false, link: "https://...", time: ... }
        parse: data => (data && data.error === false && typeof data.link === "string") ? data.link : null
    },
    {
        name: "Nekos",
        endpoint: CORS_PROXY + encodeURIComponent("https://nekosapi.com/api/v3/images/random?tags=yuri&limit=1"),
        // nekosapi v3 returns: { items: [{ url: "...", ... }] }
        parse: data => {
            if (Array.isArray(data?.items) && data.items[0]?.url) return data.items[0].url;
            if (Array.isArray(data) && data[0]?.url) return data[0].url;
            if (typeof data?.url === "string") return data.url;
            return null;
        }
    },
    {
        name: "Waifu.pics",
        endpoint: CORS_PROXY + encodeURIComponent("https://api.waifu.pics/nsfw/yuri"),
        // waifu.pics returns: { url: "https://..." }
        parse: data => (typeof data?.url === "string") ? data.url : null
    }
];

async function fetchYuri(): Promise<{ url: string; source: string; } | null> {
    for (const api of API_LIST) {
        try {
            const res = await fetch(api.endpoint, {
                headers: { Accept: "application/json" }
            });
            if (!res.ok) {
                console.warn(`[Yuri] ${api.name} returned HTTP ${res.status}`);
                continue;
            }
            const data = await res.json();
            const url = api.parse(data);
            if (url) return { url, source: api.name };
            console.warn(`[Yuri] ${api.name} returned no usable URL`);
        } catch (e) {
            console.error(`[Yuri] ${api.name} failed:`, e);
        }
    }
    return null;
}

export default definePlugin({
    name: "Yuri",
    description: "Sends a random yuri picture via /yuri. Tries PurrBot → Nekos → Waifu.pics with automatic fallback.",
    authors: [TestcordDevs.x2b],
    commands: [
        {
            name: "yuri",
            description: "Send a random yuri picture in chat",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "mode",
                    description: "send (posts in chat) or preview (only you see it). Defaults to send.",
                    type: ApplicationCommandOptionType.STRING,
                    required: false,
                    choices: [
                        { name: "send", value: "send", label: "send" },
                        { name: "preview", value: "preview", label: "preview" }
                    ]
                }
            ],
            execute: async (args, ctx) => {
                const mode = (findOption(args, "mode", "send") as string).toLowerCase();

                const result = await fetchYuri();
                if (!result) {
                    sendBotMessage(ctx.channel.id, {
                        content: "❌ Couldn't fetch a yuri picture — all APIs failed. Try again in a moment."
                    });
                    return;
                }

                if (mode === "preview") {
                    sendBotMessage(ctx.channel.id, {
                        content: `${result.url}\n-# Source: ${result.source}`
                    });
                    return;
                }

                try {
                    await MessageActions.sendMessage(ctx.channel.id, {
                        content: result.url,
                        invalidEmojis: [],
                        validNonShortcutEmojis: []
                    }, undefined, {
                        nonce: (Date.now() * 4194304).toString()
                    });
                } catch (e) {
                    console.error("[Yuri] Failed to send message:", e);
                    sendBotMessage(ctx.channel.id, {
                        content: `⚠️ Couldn't post to chat, here's the link (from ${result.source}):\n${result.url}`
                    });
                }
            }
        }
    ]
});
