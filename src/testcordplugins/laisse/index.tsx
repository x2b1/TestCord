/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { User, VoiceState } from "@vencord/discord-types";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { Constants, Menu, React, RestAPI, SelectedGuildStore, VoiceStateStore } from "@webpack/common";

type TLeashedUserInfo = {
    userId: string;
    lastChannelId: string | null;
} | null;

interface UserContextProps {
    channel: any;
    user: User;
    guildId?: string;
}

let leashedUserInfo: TLeashedUserInfo = null;
let myLastChannelId: string | null = null;

const ChannelActions = findByPropsLazy("selectChannel", "selectVoiceChannel");
const UserStore = findStoreLazy("UserStore");
const SelectedChannelStore = findStoreLazy("SelectedChannelStore");

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Enable the laisse plugin"
    },
    onlyWhenInVoice: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Only move the user when you are in a voice channel"
    },
    showNotifications: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show notifications during moves"
    }
});

// Function to move a user to a voice channel
async function moveUserToVoiceChannel(userId: string, channelId: string): Promise<void> {
    const guildId = SelectedGuildStore.getGuildId();
    if (!guildId) {
        throw new Error("No server selected");
    }

    try {
        // Use Discord API to move the user
        await RestAPI.patch({
            url: Constants.Endpoints.GUILD_MEMBER(guildId, userId),
            body: {
                channel_id: channelId
            }
        });

        if (settings.store.showNotifications) {
            const user = UserStore.getUser(userId);
            showNotification({
                title: "laisse - Success",
                body: `${user?.username || "The user"} has been moved to your voice channel`
            });
        }
    } catch (error) {
        console.error("laisse: Discord API error:", error);
        throw error;
    }
}

const UserContextMenuPatch: NavContextMenuPatchCallback = (children, { channel, user }: UserContextProps) => {
    if (UserStore.getCurrentUser().id === user.id) return;

    const [checked, setChecked] = React.useState(leashedUserInfo?.userId === user.id);

    children.push(
        <Menu.MenuSeparator />,
        <Menu.MenuCheckboxItem
            id="laisse-leash-user"
            label="laisse - Hook the user"
            checked={checked}
            action={() => {
                if (leashedUserInfo?.userId === user.id) {
                    leashedUserInfo = null;
                    setChecked(false);
                    showNotification({
                        title: "laisse",
                        body: `User ${user.username} is no longer hooked`
                    });
                    return;
                }

                leashedUserInfo = {
                    userId: user.id,
                    lastChannelId: null
                };
                setChecked(true);
                showNotification({
                    title: "laisse",
                    body: `User ${user.username} is now hooked to you`
                });
            }}
        />
    );
};

export default definePlugin({
    name: "Leash",
    description: "Hook a user to you by automatically moving them to the voice channel you join",
    authors: [{ name: "Bash", id: 1327483363518582784n }],
    settings,
    contextMenus: {
        "user-context": UserContextMenuPatch
    },
    flux: {
        async VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            if (!leashedUserInfo || !settings.store.enabled) return;

            const myId = UserStore.getCurrentUser().id;
            const myCurrentChannelId = SelectedChannelStore.getVoiceChannelId();

            // Check if we should only act when in voice
            if (settings.store.onlyWhenInVoice && !myCurrentChannelId) return;

            for (const voiceState of voiceStates) {
                // Detect when the current user changes voice channel
                if (voiceState.userId === myId && voiceState.channelId !== myLastChannelId) {
                    myLastChannelId = voiceState.channelId;

                    // If we have a hooked user and join a voice channel
                    if (voiceState.channelId && leashedUserInfo.userId) {
                        const leashedUserVoiceState = VoiceStateStore.getVoiceStateForUser(leashedUserInfo.userId);

                        // If the hooked user is in a different voice channel
                        if (leashedUserVoiceState && leashedUserVoiceState.channelId !== voiceState.channelId) {
                            try {
                                // Try to move the hooked user to our channel
                                // Note: This feature requires moderation permissions
                                const user = UserStore.getUser(leashedUserInfo.userId);

                                if (settings.store.showNotifications) {
                                    showNotification({
                                        title: "laisse",
                                        body: `Attempting to move ${user?.username || "the user"} to your voice channel`
                                    });
                                }

                                // Use Discord API to move the user
                                await moveUserToVoiceChannel(leashedUserInfo.userId, voiceState.channelId);

                            } catch (error) {
                                console.error("laisse: Error during move:", error);
                                if (settings.store.showNotifications) {
                                    showNotification({
                                        title: "laisse - Error",
                                        body: "Unable to move the user (insufficient permissions)"
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    start() {
        myLastChannelId = SelectedChannelStore.getVoiceChannelId();
    },
    stop() {
        leashedUserInfo = null;
        myLastChannelId = null;
    }
});
