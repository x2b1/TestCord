/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings, Settings } from "@api/Settings";
import { Devs, TestcordDevs } from "@utils/constants";
import definePlugin, { OptionType, PluginNative } from "@utils/types";

export const Native = VencordNative.pluginHelpers.SentFromMyUname as PluginNative<typeof import("./native")>;

async function getWhateverShouldBeSentFromMy() {
    if ((IS_DISCORD_DESKTOP || IS_VESKTOP) && Settings.plugins.SentFromMyUname.signatureToUse === "uname") {
        try {
            return await Native.getUname();
        }
        catch {
            return navigator.userAgent;
        }
    }
    else return navigator.userAgent;
}

export default definePlugin({
    name: "SentFromMyUname",
    description: "Add your uname/useragent to every single message you send",
    authors: [Devs.nin0dev, TestcordDevs.x2b],
    settings: definePluginSettings({
        signatureToUse: {
            description: "What to show after 'Sent from my'",
            type: OptionType.SELECT,
            options: [{
                label: "Attempt to use uname, useragent if can't use uname",
                value: "uname"
            }, {
                label: "Always use useragent",
                value: "useragent"
            }],
            default: "uname"
        },
        channelWhitelist: {
            description: "If set, only use plugin in this comma-separated channel whitelist",
            type: OptionType.STRING
        }
    }),
    onBeforeMessageSend: async (c, msg) => {
        if (Settings.plugins.SentFromMyUname.channelWhitelist && !Settings.plugins.SentFromMyUname.channelWhitelist.includes(c)) return;
        if (msg.content.startsWith("nouname ")) { msg.content = msg.content.replace("nouname ", ""); return; }
        msg.content += `\n\nSent from my ${await getWhateverShouldBeSentFromMy()}`;
    }
});




