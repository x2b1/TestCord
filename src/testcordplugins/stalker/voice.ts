/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showNotification } from "@api/Notifications";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { ChannelStore, GuildStore, UserStore } from "@webpack/common";

import { logStalkerEvent, settings, targets } from ".";

interface VoiceActions {
    selectVoiceChannel(channelId: string): void;
}

interface VoiceStateStoreShape {
    addChangeListener(listener: () => void): void;
    removeChangeListener(listener: () => void): void;
    getVoiceStateForUser(userId: string): VoiceStateData | undefined;
}

type VoiceStateFlag = "deaf" | "mute" | "selfDeaf" | "selfMute" | "selfStream" | "selfVideo" | "suppress";

interface VoiceStateData {
    channelId?: string;
    userId: string;
    deaf?: boolean;
    mute?: boolean;
    selfDeaf?: boolean;
    selfMute?: boolean;
    selfStream?: boolean;
    selfVideo?: boolean;
    suppress?: boolean;
}

const VoiceActions = findByPropsLazy("selectVoiceChannel", "selectChannel") as VoiceActions;
const VoiceStateStore = findStoreLazy("VoiceStateStore") as VoiceStateStoreShape;
const NOTIFICATION_COLOR = "#5865f2";
const voiceStateLabels: Array<[VoiceStateFlag, string, string]> = [
    ["mute", "Server muted", "Server unmuted"],
    ["deaf", "Server deafened", "Server undeafened"],
    ["selfMute", "Muted", "Unmuted"],
    ["selfDeaf", "Deafened", "Undeafened"],
    ["selfVideo", "Enabled video", "Disabled video"],
    ["selfStream", "Started streaming", "Stopped streaming"],
    ["suppress", "Suppressed by stage", "Unsuppressed by stage"],
];

let lastVoiceState: Record<string, VoiceStateData> = {};

const getChannelName = (channelId: string | undefined): string => {
    if (!channelId) return "Unknown channel";

    const channel = ChannelStore.getChannel(channelId);
    if (!channel) return "Unknown channel";

    if (channel.isGuildVoice() || channel.isGuildStageVoice()) {
        const guild = GuildStore.getGuild(channel.guild_id);
        return `${channel.name} from ${guild?.name ?? "Unknown server"}`;
    }

    return channel.name ?? "Unknown channel";
};

const getGuildName = (channelId: string | undefined): string | undefined => {
    if (!channelId) return;

    const channel = ChannelStore.getChannel(channelId);
    if (!channel?.guild_id) return;

    return GuildStore.getGuild(channel.guild_id)?.name;
};

const getVoiceStateChanges = (previousState: VoiceStateData, currentState: VoiceStateData): string[] => {
    const changes: string[] = [];

    for (const [key, enabledLabel, disabledLabel] of voiceStateLabels) {
        const wasEnabled = Boolean(previousState[key]);
        const isEnabled = Boolean(currentState[key]);

        if (wasEnabled === isEnabled) continue;
        changes.push(isEnabled ? enabledLabel : disabledLabel);
    }

    return changes;
};

const logVoiceEvent = (userId: string, username: string, action: "voice_join" | "voice_leave" | "voice_update", details: string, channelId: string | undefined) => {
    const channel = channelId ? ChannelStore.getChannel(channelId) : undefined;

    logStalkerEvent({
        timestamp: new Date().toISOString(),
        userId,
        username,
        action,
        details,
        channelName: channel?.name,
        guildName: getGuildName(channelId),
        metadata: {
            channelId: channelId ?? null,
            guildId: channel?.guild_id ?? null
        }
    });
};

export const init = () => {
    const initialState: Record<string, VoiceStateData> = {};
    for (const id of targets) {
        const voiceState = VoiceStateStore.getVoiceStateForUser(id);
        if (voiceState) initialState[id] = voiceState;
    }
    lastVoiceState = initialState;

    VoiceStateStore.addChangeListener(voiceStateChange);
};

export const deinit = () => {
    VoiceStateStore.removeChangeListener(voiceStateChange);
    lastVoiceState = {};
};

export const voiceStateChange = () => {
    const newVoiceState: Record<string, VoiceStateData> = {};

    for (const id of targets) {
        const voiceState = VoiceStateStore.getVoiceStateForUser(id);
        const lastVoiceStateForUser = lastVoiceState[id];

        if (voiceState) newVoiceState[id] = voiceState;

        const joinedVoice = Boolean(voiceState && !lastVoiceStateForUser);
        const leftVoice = Boolean(!voiceState && lastVoiceStateForUser);
        const switchedChannel = Boolean(voiceState && lastVoiceStateForUser && voiceState.channelId !== lastVoiceStateForUser.channelId);

        if (voiceState && (joinedVoice || switchedChannel)) {
            const user = UserStore.getUser(id);
            if (!user) continue;

            const channelName = getChannelName(voiceState.channelId);

            if (settings.store.notifyCallJoin && voiceState.channelId) {
                const { channelId } = voiceState;

                showNotification({
                    title: "Stalker",
                    body: `${user.username} joined VC: ${channelName}\nClick to join them.`,
                    icon: user.getAvatarURL(),
                    color: NOTIFICATION_COLOR,
                    onClick: () => VoiceActions.selectVoiceChannel(channelId),
                });
            }

            logVoiceEvent(
                user.id,
                user.username,
                joinedVoice ? "voice_join" : "voice_update",
                joinedVoice
                    ? `Joined voice channel: ${channelName}.`
                    : `Moved from ${getChannelName(lastVoiceStateForUser.channelId)} to ${channelName}.`,
                voiceState.channelId
            );
        }

        if (leftVoice && lastVoiceStateForUser) {
            const user = UserStore.getUser(id);
            if (!user) continue;

            const channelName = getChannelName(lastVoiceStateForUser.channelId);

            if (settings.store.notifyCallLeave) {
                showNotification({
                    title: "Stalker",
                    body: `${user.username} left VC: ${channelName}`,
                    icon: user.getAvatarURL(),
                    color: NOTIFICATION_COLOR,
                });
            }

            logVoiceEvent(user.id, user.username, "voice_leave", `Left voice channel: ${channelName}.`, lastVoiceStateForUser.channelId);
        }

        if (voiceState && lastVoiceStateForUser && !switchedChannel && settings.store.logVoiceStateChanges) {
            const changes = getVoiceStateChanges(lastVoiceStateForUser, voiceState);
            if (!changes.length) continue;

            const user = UserStore.getUser(id);
            if (!user) continue;

            logVoiceEvent(
                user.id,
                user.username,
                "voice_update",
                `Voice state changed in ${getChannelName(voiceState.channelId)}: ${changes.join(", ")}.`,
                voiceState.channelId
            );
        }
    }

    lastVoiceState = newVoiceState;
};
