/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { UserStore } from "@webpack/common";

// Récupération des stores et actions nécessaires
const VoiceStateStore = findStoreLazy("VoiceStateStore");
const ChannelActions = findByPropsLazy("selectVoiceChannel");

interface VoiceState {
    userId: string;
    channelId?: string;
    oldChannelId?: string;
    guildId?: string;
    deaf: boolean;
    mute: boolean;
    selfDeaf: boolean;
    selfMute: boolean;
    selfStream: boolean;
    selfVideo: boolean;
    sessionId: string;
    suppress: boolean;
    requestToSpeakTimestamp: string | null;
}

// Variables pour détecter les déconnexions volontaires
let isVoluntaryDisconnect = false;
let disconnectTimeout: NodeJS.Timeout | null = null;
let lastChannelId: string | null = null;
let isChannelSwitching = false;
let switchTimeout: NodeJS.Timeout | null = null;
let originalSelectVoiceChannel: any = null;

// Function to mark a disconnection as voluntary
function markVoluntaryDisconnect() {
    isVoluntaryDisconnect = true;
    console.log("[AntiDisconnect] Voluntary disconnection marked");
    // Reset the flag after a longer delay
    if (disconnectTimeout) clearTimeout(disconnectTimeout);
    disconnectTimeout = setTimeout(() => {
        isVoluntaryDisconnect = false;
        console.log("[AntiDisconnect] Voluntary disconnection flag reset");
    }, 3000);
}

// Function to mark a channel switch
function markChannelSwitch() {
    isChannelSwitching = true;
    console.log("[AntiDisconnect] Channel switch in progress");
    if (switchTimeout) clearTimeout(switchTimeout);
    switchTimeout = setTimeout(() => {
        isChannelSwitching = false;
        console.log("[AntiDisconnect] Channel switch flag reset");
    }, 3000);
}

export default definePlugin({
    name: "AntiDisconnect",
    description: "Automatically reconnects to the voice channel in case of forced disconnection",
    authors: [{
        name: "Bash",
        id: 1327483363518582784n
    }],

    // Using the flux system to listen to voice events
    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            // Security check for the current user
            const currentUser = UserStore.getCurrentUser();
            if (!currentUser) {
                console.warn("[AntiDisconnect] Current user not available");
                return;
            }

            const currentUserId = currentUser.id;

            // Processing each voice state change
            for (const state of voiceStates) {
                const { userId, channelId, oldChannelId } = state;

                // We only care about events for the current user
                if (userId !== currentUserId) continue;

                // Store the current channel for next time
                if (channelId) {
                    lastChannelId = channelId;
                }

                // Detection of a disconnection:
                // The user was in a channel (oldChannelId exists)
                // but is no longer in any channel (channelId is null/undefined)
                if (oldChannelId && !channelId) {
                    console.log(`[AntiDisconnect] Disconnection detected from channel ${oldChannelId}`);

                    // Check if it's a voluntary disconnection
                    if (isVoluntaryDisconnect) {
                        console.log("[AntiDisconnect] Voluntary disconnection confirmed, no reconnection");
                        return;
                    }

                    // Check if a channel switch is in progress
                    if (isChannelSwitching) {
                        console.log("[AntiDisconnect] Channel switch in progress, no reconnection");
                        return;
                    }

                    // Wait a bit to see if a new channel is selected (quick change)
                    setTimeout(() => {
                        // Check once more if it's not a voluntary disconnection
                        if (isVoluntaryDisconnect || isChannelSwitching) {
                            console.log("[AntiDisconnect] Voluntary disconnection or channel switch detected during wait");
                            return;
                        }

                        const currentState = VoiceStateStore.getVoiceStateForUser(currentUserId);

                        // If the user is now in another channel, it was a change
                        if (currentState?.channelId) {
                            console.log(`[AntiDisconnect] Channel change detected (${oldChannelId} -> ${currentState.channelId}), no reconnection`);
                            return;
                        }

                        // If we get here, it's really a forced disconnection
                        console.log(`[AntiDisconnect] FORCED disconnection confirmed from channel ${oldChannelId}`);

                        // Attempt reconnection
                        setTimeout(() => {
                            try {
                                console.log(`[AntiDisconnect] Attempting reconnection to channel ${oldChannelId}`);
                                // Use the original function to avoid loops
                                if (originalSelectVoiceChannel) {
                                    originalSelectVoiceChannel.call(ChannelActions, oldChannelId);
                                } else {
                                    ChannelActions.selectVoiceChannel(oldChannelId);
                                }
                            } catch (error) {
                                console.error("[AntiDisconnect] Error during reconnection:", error);
                            }
                        }, 100);

                    }, 200);
                }
            }
        },

        // Listen to voluntary disconnection actions
        VOICE_CHANNEL_SELECT({ channelId }: { channelId: string | null; }) {
            const currentUser = UserStore.getCurrentUser();
            if (!currentUser) return;

            const currentUserId = currentUser.id;
            const currentVoiceState = VoiceStateStore.getVoiceStateForUser(currentUserId);

            if (currentVoiceState?.channelId) {
                if (channelId === null) {
                    // Voluntary disconnection
                    console.log("[AntiDisconnect] Voluntary disconnection action detected via VOICE_CHANNEL_SELECT");
                    markVoluntaryDisconnect();
                } else if (channelId !== currentVoiceState.channelId) {
                    // Channel change
                    console.log(`[AntiDisconnect] Channel change detected via VOICE_CHANNEL_SELECT (${currentVoiceState.channelId} -> ${channelId})`);
                    markChannelSwitch();
                }
            }
        }
    },

    start() {
        console.log("[AntiDisconnect] AntiDisconnect plugin initialized");

        // Check that stores are available
        if (!ChannelActions || !VoiceStateStore || !UserStore) {
            console.error("[AntiDisconnect] Error: Discord stores not available");
            return;
        }

        // Save the original function
        originalSelectVoiceChannel = ChannelActions.selectVoiceChannel;

        // Listen to disconnection button click events
        ChannelActions.selectVoiceChannel = function (channelId: string | null) {
            const currentUser = UserStore.getCurrentUser();
            if (!currentUser) return originalSelectVoiceChannel.call(this, channelId);

            const currentUserId = currentUser.id;
            const currentVoiceState = VoiceStateStore.getVoiceStateForUser(currentUserId);

            if (currentVoiceState?.channelId) {
                if (channelId === null) {
                    // Voluntary disconnection
                    console.log("[AntiDisconnect] Voluntary disconnection intercepted via selectVoiceChannel");
                    markVoluntaryDisconnect();
                } else if (channelId !== currentVoiceState.channelId) {
                    // Channel change
                    console.log(`[AntiDisconnect] Channel change intercepted via selectVoiceChannel (${currentVoiceState.channelId} -> ${channelId})`);
                    markChannelSwitch();
                }
            }

            return originalSelectVoiceChannel.call(this, channelId);
        };
    },

    stop() {
        console.log("[AntiDisconnect] AntiDisconnect plugin stopped");

        // Restore the original function
        if (originalSelectVoiceChannel && ChannelActions) {
            ChannelActions.selectVoiceChannel = originalSelectVoiceChannel;
            originalSelectVoiceChannel = null;
        }

        if (disconnectTimeout) {
            clearTimeout(disconnectTimeout);
            disconnectTimeout = null;
        }
        if (switchTimeout) {
            clearTimeout(switchTimeout);
            switchTimeout = null;
        }
        isVoluntaryDisconnect = false;
        isChannelSwitching = false;
        lastChannelId = null;
    }
});
