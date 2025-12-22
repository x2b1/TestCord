/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Notice } from "@components/Notice";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { UserStore } from "@webpack/common";

const settings = definePluginSettings({
    os: {
        type: OptionType.SELECT,
        description: "What operating system to spoof as",
        restartNeeded: true,
        options: [
            {
                label: "Linux",
                value: "linux",
                default: true,
            },
            {
                label: "Windows",
                value: "windows",
            },
            {
                label: "macOS",
                value: "macos",
            },
        ]
    }
});

export default definePlugin({
    name: "OSSpoofer",
    description: "Spoof your operating system",
    authors: [EquicordDevs.Drag], // You can change this to your name if needed
    settingsAboutComponent: () => (
        <Notice.Warning>
            We can't guarantee this plugin won't get you warned or banned.
        </Notice.Warning>
    ),
    settings: settings,
    patches: [
        {
            find: "_doIdentify(){",
            replacement: {
                match: /(\[IDENTIFY\].*let.{0,5}=\{.*properties:)(.*),presence/,
                replace: "$1{...$2,...$self.getOS(true)},presence"
            }
        }
    ],
    getOS(bypass) {
        const os = settings.store.os ?? "linux";

        if (bypass) {
            switch (os) {
                case "linux":
                    return { os: "Linux" };
                case "macos":
                    return { os: "Mac OS X 10.15.7" };
                case "windows":
                    return { os: "Windows NT 10.0" };
                default:
                    return {};
            }
        }

        return {};
    }
});
