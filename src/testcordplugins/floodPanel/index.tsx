/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { addHeaderBarButton, removeHeaderBarButton, HeaderBarButton } from "@api/HeaderBar";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

import { FloodPanelButton } from "./components/ChatBarButton";
import { FloodIcon } from "./components/Icons";

let enabled = false;

const settings = definePluginSettings({
    showOnTopBar: {
        type: OptionType.BOOLEAN,
        description: "Show button on the top bar instead of the chat bar",
        default: false,
        restartNeeded: true,
    },
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
    settings,

    chatBarButton: { render: FloodPanelButton } as any,

    start() {
        if (settings.store.showOnTopBar) {
            addHeaderBarButton("FloodPanel", () => (
                <HeaderBarButton
                    icon={FloodIcon}
                    tooltip="Flood Panel"
                    onClick={() => {}}
                />
            ), 5);
        }
    },

    stop() {
        removeHeaderBarButton("FloodPanel");
    },
});
