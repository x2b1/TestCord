/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

import { FloodPanelButton } from "./components/ChatBarButton";

let enabled = false;

const settings = definePluginSettings({
    defaultDelay: {
        type: OptionType.NUMBER,
        description: "Default delay between messages (ms).",
        default: 500
    },
    defaultShuffle: {
        type: OptionType.BOOLEAN,
        description: "Randomize message order by default.",
        default: true
    }
});

export { settings };

export default definePlugin({
    name: "FloodPanel",
    description: "Send a flood of messages rapidly in any channel. Load a custom .txt file or use the built-in phrases. Accessible from the chat bar.",
    authors: [EquicordDevs.nobody],
    enabledByDefault: true,
    settings,

    chatBarButton: {
        render: FloodPanelButton
    },
});
