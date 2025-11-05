/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {addChatBarButton, ChatBarButton, ChatBarButtonFactory, removeChatBarButton} from "@api/ChatButtons";
import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Menu, React } from "@webpack/common";

const settings = definePluginSettings({
    showIcon: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Show an icon for toggling the plugin",
    },
    contextMenu: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Add a context menu option to toggle the button",
    },
    isEnabled: {
        type: OptionType.BOOLEAN,
        description: "Toggle functionality",
        default: true,
    }
});

const toggle = () => settings.store.isEnabled = !settings.store.isEnabled;

const ContextMenuPatch: NavContextMenuPatchCallback = (children, props: any) => {
    const { isEnabled, contextMenu } = settings.use(["isEnabled", "contextMenu"]);
    const container = findGroupChildrenByChildId("submit-button", children);
    if (container && contextMenu) {
        const idx = container.findIndex(c => c?.props?.id === "submit-button");
        container.splice(idx + 1, 0,
            <Menu.MenuCheckboxItem
                id="vc-compose-mode"
                label="Compose Mode"
                checked={isEnabled}
                action={toggle}
            />
        );
    }
};

const ComposeModeToggleButton: ChatBarButtonFactory = ({ isMainChat }) => {
    const { isEnabled, showIcon } = settings.use(["isEnabled", "showIcon"]);

    if (!isMainChat || !showIcon) return null;

    return (
        <ChatBarButton
            tooltip={isEnabled ? "Disable Compose Mode" : "Enable Compose Mode"}
            onClick={toggle}
        >
            <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512">
                <path fill="currentColor" d="M528 448H48c-26.51 0-48-21.49-48-48V112c0-26.51 21.49-48 48-48h480c26.51 0 48 21.49 48 48v288c0 26.51-21.49 48-48 48zM128 180v-40c0-6.627-5.373-12-12-12H76c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm96 0v-40c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm96 0v-40c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm96 0v-40c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm96 0v-40c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm-336 96v-40c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm96 0v-40c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm96 0v-40c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm96 0v-40c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm-336 96v-40c0-6.627-5.373-12-12-12H76c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12zm288 0v-40c0-6.627-5.373-12-12-12H172c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h232c6.627 0 12-5.373 12-12zm96 0v-40c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12z" />
                {isEnabled && <path d="M13 432L590 48" stroke="var(--red-500)" strokeWidth="72" strokeLinecap="round" />}
            </svg>
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "ComposeMode",
    authors: [Devs.Sqaaakoi],
    description: "Toggle writing multi-line messages by default",
    dependencies: ["CommandsAPI", "ChatInputButtonAPI"],
    settings,

    patches: [
        {
            find: ".NO_SEND_MESSAGES_PERMISSION_PLACEHOLDER:",
            replacement: {
                match: /(disableEnterToSubmit:)([^,]{0,100},)/g,
                replace: "$1$self.settings.store.isEnabled||$2"
            }
        },
    ],

    contextMenus: {
        "textarea-context": ContextMenuPatch
    },

    start: () => addChatBarButton("ComposeMode", ComposeModeToggleButton),
    stop: () => removeChatBarButton("ComposeMode"),
});
