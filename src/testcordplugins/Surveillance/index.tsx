/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { LogIcon } from "@components/Icons";
import SettingsPlugin from "@plugins/_core/settings";
import { removeFromArray } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import type { Activity, Channel, Guild, GuildMember, Message, OnlineStatus, Role, User } from "@vencord/discord-types";
import { ActivityType } from "@vencord/discord-types/enums";
import { ChannelStore, GuildStore, Menu, PresenceStore, SettingsRouter, UserStore } from "@webpack/common";

import { recordEvent, trimEvents } from "./store";
import type { MessageSnapshot, SurveillanceEvent, SurveillanceEventType, SurveillanceScope, VoiceState, VoiceStateFlag } from "./types";

const SETTINGS_ENTRY_KEY = "illegalcord_surveillance";
const NOTIFICATION_COLOR = "#5865f2";
const MESSAGE_PREVIEW_LIMIT = 220;
const TYPING_COOLDOWN = 15_000;
const MEMBER_JOIN_FRESHNESS = 300_000;

let targets: string[] = [];
let serverTargets: string[] = [];
const targetListeners = new Set<() => void>();
const serverTargetListeners = new Set<() => void>();
const messageCache = new Map<string, MessageSnapshot>();
const previousVoiceStates = new Map<string, VoiceState>();
const typingCooldowns = new Map<string, number>();
const seenServerUsers = new Map<string, Set<string>>();
let lastStatuses = new Map<string, OnlineStatus>();
let lastActivities = new Map<string, Map<string, string>>();

interface UserContextProps {
    user?: User;
}

interface ChannelInfo {
    channelId?: string;
    channelName?: string;
    guildId?: string;
    guildName?: string;
}

interface ChannelFluxEvent {
    channel?: Channel;
    channelId?: string;
    guildId?: string;
}

interface GuildFluxEvent {
    guild?: Guild;
    guildId?: string;
}

interface GuildMemberFluxEvent {
    guildId?: string;
    guild_id?: string;
    member?: GuildMember;
    user?: User;
    userId?: string;
}

interface RoleFluxEvent {
    guildId?: string;
    guild_id?: string;
    role?: Role;
    roleId?: string;
}

interface ReactionEmoji {
    id?: string;
    name?: string;
    animated?: boolean;
}

interface MessageReactionFluxEvent {
    channelId: string;
    messageId: string;
    userId?: string;
    emoji?: ReactionEmoji;
}

const voiceStateLabels: Array<[VoiceStateFlag, string, string]> = [
    ["mute", "Server muted", "Server unmuted"],
    ["deaf", "Server deafened", "Server undeafened"],
    ["selfMute", "Muted", "Unmuted"],
    ["selfDeaf", "Deafened", "Undeafened"],
    ["selfVideo", "Enabled video", "Disabled video"],
    ["selfStream", "Started streaming", "Stopped streaming"],
    ["suppress", "Suppressed by stage", "Unsuppressed by stage"],
];

const updateTargets = (value: string): string[] => {
    targets = [...new Set(value.match(/\d+/g) ?? [])];
    targetListeners.forEach(listener => listener());
    return targets;
};

const updateServerTargets = (value: string): string[] => {
    serverTargets = [...new Set(value.match(/\d+/g) ?? [])];
    serverTargetListeners.forEach(listener => listener());
    return serverTargets;
};

export const getTargets = () => targets;

export const getServerTargets = () => serverTargets;

export const subscribeTargets = (listener: () => void) => {
    targetListeners.add(listener);
    return () => targetListeners.delete(listener);
};

export const subscribeServerTargets = (listener: () => void) => {
    serverTargetListeners.add(listener);
    return () => serverTargetListeners.delete(listener);
};

export function setTargets(nextTargets: string[]) {
    settings.store.targets = [...new Set(nextTargets.filter(Boolean))].join(",");
    updateTargets(settings.store.targets);
}

export function addTarget(userId: string) {
    setTargets([...targets, userId]);
}

export function removeTarget(userId: string) {
    setTargets(targets.filter(target => target !== userId));
}

export function setServerTargets(nextServerTargets: string[]) {
    settings.store.serverTargets = [...new Set(nextServerTargets.filter(Boolean))].join(",");
    updateServerTargets(settings.store.serverTargets);
}

export function addServerTarget(guildId: string) {
    setServerTargets([...serverTargets, guildId]);
}

export function removeServerTarget(guildId: string) {
    setServerTargets(serverTargets.filter(target => target !== guildId));
}

export const settings = definePluginSettings({
    targets: {
        type: OptionType.STRING,
        placeholder: "1234,5678",
        description: "Discord user IDs to monitor from live visible events.",
        default: "",
        onChange: updateTargets,
    },
    serverTargets: {
        type: OptionType.STRING,
        placeholder: "1234,5678",
        description: "Discord server IDs to monitor from live visible events.",
        default: "",
        onChange: updateServerTargets,
    },
    addContextMenu: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Add a Surveillance toggle to user context menus.",
    },
    ignoreBots: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Ignore bot accounts while logging user activity.",
    },
    logMessages: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Log live messages from monitored users.",
    },
    captureMessageContent: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Include message previews in local logs.",
    },
    logMessageChanges: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Log edits and deletes for messages seen during this session.",
    },
    logTyping: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Log typing signals with a short cooldown.",
    },
    logReactions: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Log live reaction adds and removals.",
    },
    logStatus: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Log online, idle, dnd, and offline transitions.",
    },
    logActivities: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Log activity starts, stops, and updates.",
    },
    logVoice: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Log voice joins, leaves, moves, and state changes.",
    },
    logMemberUpdates: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Log server member update events.",
    },
    notifyEvents: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Send notifications for high signal surveillance events.",
    },
    trackSelf: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Include your own account if its ID is in the target list.",
    },
    maxEvents: {
        type: OptionType.NUMBER,
        default: 1000,
        description: "Maximum number of local events to keep.",
        onChange: value => void trimEvents(value),
    },
});

const makeId = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const getUsername = (userId: string, fallback?: string) =>
    fallback ?? UserStore.getUser(userId)?.username ?? userId;

const preview = (content: string) =>
    content.length > MESSAGE_PREVIEW_LIMIT
        ? `${content.slice(0, MESSAGE_PREVIEW_LIMIT)}...`
        : content;

const isCurrentUser = (userId: string) =>
    userId === UserStore.getCurrentUser()?.id;

const isBotUser = (userId: string, user?: User) =>
    Boolean(user?.bot ?? UserStore.getUser(userId)?.bot);

const shouldIgnoreUser = (userId: string, user?: User) =>
    settings.store.ignoreBots && isBotUser(userId, user);

const shouldTrackUser = (userId: string) => {
    if (!targets.includes(userId)) return false;
    if (shouldIgnoreUser(userId)) return false;
    if (settings.store.trackSelf) return true;
    return !isCurrentUser(userId);
};

const shouldTrackServer = (guildId?: string) =>
    guildId != null && serverTargets.includes(guildId);

const getScope = (userId: string, guildId?: string): SurveillanceScope | undefined => {
    if (shouldIgnoreUser(userId)) return;
    if (shouldTrackServer(guildId) && !isCurrentUser(userId)) return "server";
    if (shouldTrackUser(userId)) return "person";
};

const shouldTrackEvent = (userId: string, guildId?: string) =>
    getScope(userId, guildId) != null;

const getChannelInfo = (channelId: string | undefined): ChannelInfo => {
    if (!channelId) return {};

    const channel = ChannelStore.getChannel(channelId);
    const guild = channel?.guild_id ? GuildStore.getGuild(channel.guild_id) : undefined;

    return {
        channelId,
        channelName: channel?.name,
        guildId: channel?.guild_id,
        guildName: guild?.name,
    };
};

const getGuildInfo = (guildId: string | undefined): Pick<SurveillanceEvent, "guildId" | "guildName"> => {
    const guild = guildId ? GuildStore.getGuild(guildId) : undefined;

    return {
        guildId,
        guildName: guild?.name,
    };
};

const getChannelEventInfo = (event: ChannelFluxEvent): ChannelInfo => {
    const channelId = event.channel?.id ?? event.channelId;
    const channelInfo = getChannelInfo(channelId);
    const guildId = event.channel?.guild_id ?? event.guildId ?? channelInfo.guildId;
    const guild = guildId ? GuildStore.getGuild(guildId) : undefined;

    return {
        channelId,
        channelName: event.channel?.name ?? channelInfo.channelName,
        guildId,
        guildName: guild?.name ?? channelInfo.guildName,
    };
};

const rememberServerUser = (userId: string, guildId?: string) => {
    if (isCurrentUser(userId)) return;
    if (shouldIgnoreUser(userId)) return;
    if (!guildId || !serverTargets.includes(guildId)) return;

    let guildIds = seenServerUsers.get(userId);
    if (!guildIds) {
        guildIds = new Set();
        seenServerUsers.set(userId, guildIds);
    }

    guildIds.add(guildId);

    if (!lastStatuses.has(userId)) {
        const statuses = PresenceStore.getState()?.statuses ?? {};
        lastStatuses.set(userId, statuses[userId] ?? "offline");
        lastActivities.set(userId, getActivityMap(userId));
    }
};

const getSeenServerGuildId = (userId: string) => {
    const guildIds = seenServerUsers.get(userId);
    if (!guildIds) return undefined;

    for (const guildId of guildIds) {
        if (serverTargets.includes(guildId)) return guildId;
    }
};

const getPresenceUserIds = () => {
    const userIds = new Set(targets);

    for (const userId of seenServerUsers.keys()) {
        if (getSeenServerGuildId(userId)) userIds.add(userId);
    }

    return userIds;
};

const notify = (event: SurveillanceEvent) => {
    if (!settings.store.notifyEvents) return;
    if (event.type === "typing" || event.type === "message_edit" || event.type === "message_delete") return;

    const user = UserStore.getUser(event.userId);

    showNotification({
        title: "Surveillance",
        body: `${event.username}: ${event.details}`,
        color: NOTIFICATION_COLOR,
        icon: user?.getAvatarURL(),
    });
};

const addEvent = (entry: Omit<SurveillanceEvent, "id" | "timestamp">) => {
    const event: SurveillanceEvent = {
        id: makeId(),
        timestamp: Date.now(),
        ...entry,
    };

    void recordEvent(event, settings.store.maxEvents);
    notify(event);
};

const addUserEvent = (type: SurveillanceEventType, userId: string, details: string, extra: Partial<SurveillanceEvent> = {}) => {
    const scope = extra.scope ?? getScope(userId, extra.guildId);
    if (!scope) return;

    addEvent({
        type,
        userId,
        username: getUsername(userId, extra.username),
        details,
        scope,
        ...extra,
    });
};

const addServerEvent = (type: SurveillanceEventType, guildId: string | undefined, details: string, extra: Partial<SurveillanceEvent> = {}) => {
    if (!shouldTrackServer(guildId)) return;

    addEvent({
        type,
        userId: extra.userId ?? guildId ?? "server",
        username: extra.username ?? "Server",
        details,
        scope: "server",
        ...getGuildInfo(guildId),
        ...extra,
    });
};

const getActivityKey = (activity: Activity) =>
    [activity.type, activity.application_id ?? "", activity.name, activity.platform ?? ""].join(":");

const formatActivityType = (type: ActivityType) => {
    switch (type) {
        case ActivityType.STREAMING:
            return "streaming";
        case ActivityType.LISTENING:
            return "listening to";
        case ActivityType.WATCHING:
            return "watching";
        case ActivityType.COMPETING:
            return "competing in";
        case ActivityType.HANG_STATUS:
            return "hanging out in";
        default:
            return "playing";
    }
};

const formatActivity = (activity: Activity) => {
    if (activity.type === ActivityType.CUSTOM_STATUS) {
        return [activity.emoji?.name, activity.state ?? activity.name].filter(Boolean).join(" ");
    }

    const details = activity.details ? `: ${activity.details}` : "";
    const state = activity.state ? ` (${activity.state})` : "";
    return `${formatActivityType(activity.type)} ${activity.name}${details}${state}`;
};

const getActivityMap = (userId: string) => {
    const activities = PresenceStore.getActivities(userId) ?? [];
    const activityMap = new Map<string, string>();

    for (const activity of activities) {
        activityMap.set(getActivityKey(activity), formatActivity(activity));
    }

    return activityMap;
};

const seedPresence = () => {
    const statuses = PresenceStore.getState()?.statuses ?? {};
    lastStatuses = new Map();
    lastActivities = new Map();

    for (const userId of getPresenceUserIds()) {
        lastStatuses.set(userId, statuses[userId] ?? "offline");
        lastActivities.set(userId, getActivityMap(userId));
    }
};

const handlePresenceChange = () => {
    const statuses = PresenceStore.getState()?.statuses ?? {};

    for (const userId of getPresenceUserIds()) {
        const guildId = getSeenServerGuildId(userId);
        const scope = getScope(userId, guildId);
        if (!scope) continue;

        const guildInfo = scope === "server" ? getGuildInfo(guildId) : {};

        const previousStatus = lastStatuses.get(userId) ?? "offline";
        const currentStatus = statuses[userId] ?? "offline";

        if (settings.store.logStatus && previousStatus !== currentStatus) {
            addUserEvent("status", userId, `Status changed from ${previousStatus} to ${currentStatus}.`, { scope, ...guildInfo });
        }

        const previousActivities = lastActivities.get(userId) ?? new Map<string, string>();
        const currentActivities = getActivityMap(userId);

        if (settings.store.logActivities) {
            for (const [key, activity] of currentActivities) {
                const previousActivity = previousActivities.get(key);

                if (!previousActivity) {
                    addUserEvent("activity_start", userId, `Started ${activity}.`, { scope, ...guildInfo });
                    continue;
                }

                if (previousActivity !== activity) {
                    addUserEvent("activity_update", userId, `Changed activity from ${previousActivity} to ${activity}.`, { scope, ...guildInfo });
                }
            }

            for (const [key, activity] of previousActivities) {
                if (!currentActivities.has(key)) addUserEvent("activity_stop", userId, `Stopped ${activity}.`, { scope, ...guildInfo });
            }
        }

        lastStatuses.set(userId, currentStatus);
        lastActivities.set(userId, currentActivities);
    }
};

const getVoiceChanges = (previousState: VoiceState, currentState: VoiceState) => {
    const changes: string[] = [];

    for (const [key, enabledLabel, disabledLabel] of voiceStateLabels) {
        const wasEnabled = Boolean(previousState[key]);
        const isEnabled = Boolean(currentState[key]);

        if (wasEnabled !== isEnabled) changes.push(isEnabled ? enabledLabel : disabledLabel);
    }

    return changes;
};

const handleVoiceState = (state: VoiceState) => {
    if (!settings.store.logVoice) return;

    const previousState = previousVoiceStates.get(state.userId);
    const { channelId, oldChannelId, userId } = state;
    const guildId = state.guildId ?? getChannelInfo(channelId ?? oldChannelId).guildId;
    if (!shouldTrackEvent(userId, guildId)) return;

    rememberServerUser(userId, guildId);

    if (oldChannelId !== channelId) {
        if (!oldChannelId && channelId) {
            const channelInfo = getChannelInfo(channelId);
            addUserEvent("voice_join", userId, `Joined voice channel ${channelInfo.channelName ?? "Unknown channel"}.`, channelInfo);
        } else if (oldChannelId && !channelId) {
            const channelInfo = getChannelInfo(oldChannelId);
            addUserEvent("voice_leave", userId, `Left voice channel ${channelInfo.channelName ?? "Unknown channel"}.`, channelInfo);
        } else if (oldChannelId && channelId) {
            const oldChannel = getChannelInfo(oldChannelId).channelName ?? "Unknown channel";
            const channelInfo = getChannelInfo(channelId);
            addUserEvent("voice_move", userId, `Moved from ${oldChannel} to ${channelInfo.channelName ?? "Unknown channel"}.`, channelInfo);
        }
    }

    if (previousState && channelId && oldChannelId === channelId) {
        const changes = getVoiceChanges(previousState, state);
        if (changes.length) {
            addUserEvent("voice_update", userId, `Voice state changed: ${changes.join(", ")}.`, getChannelInfo(channelId));
        }
    }

    if (channelId) previousVoiceStates.set(userId, state);
    else previousVoiceStates.delete(userId);
};

const logMessage = (message: Message) => {
    const { author } = message;
    if (!settings.store.logMessages && !settings.store.logMessageChanges) return;
    if (shouldIgnoreUser(author.id, author)) return;

    const info = getChannelInfo(message.channel_id);
    if (!shouldTrackEvent(author.id, info.guildId)) return;

    rememberServerUser(author.id, info.guildId);

    const content = settings.store.captureMessageContent ? preview(message.content) : undefined;

    messageCache.set(message.id, {
        userId: author.id,
        username: author.username,
        channelId: message.channel_id,
        guildId: info.guildId,
        content: message.content,
    });

    if (!settings.store.logMessages) return;

    addEvent({
        type: "message",
        userId: author.id,
        username: author.username,
        details: content ? `Sent message: ${content}` : "Sent a message.",
        scope: getScope(author.id, info.guildId),
        content,
        ...info,
        metadata: {
            messageId: message.id,
            hasContent: message.content.length > 0,
            attachmentCount: message.attachments.length,
        },
    });
};

const logMessageUpdate = (message: Message) => {
    if (!settings.store.logMessageChanges) return;
    if (shouldIgnoreUser(message.author.id, message.author)) return;

    const previousMessage = messageCache.get(message.id);
    const info = getChannelInfo(message.channel_id);
    const guildId = info.guildId ?? previousMessage?.guildId;
    if (!shouldTrackEvent(message.author.id, guildId)) return;

    rememberServerUser(message.author.id, guildId);

    const content = settings.store.captureMessageContent ? preview(message.content) : undefined;
    const previousContent = previousMessage?.content;

    messageCache.set(message.id, {
        userId: message.author.id,
        username: message.author.username,
        channelId: message.channel_id,
        guildId: info.guildId,
        content: message.content,
    });

    addEvent({
        type: "message_edit",
        userId: message.author.id,
        username: message.author.username,
        details: content ? `Edited message: ${content}` : "Edited a message.",
        scope: getScope(message.author.id, guildId),
        before: settings.store.captureMessageContent && previousContent ? preview(previousContent) : undefined,
        after: content,
        ...info,
        metadata: {
            messageId: message.id,
            hadCachedOriginal: Boolean(previousContent),
        },
    });
};

const logMessageDelete = (messageId: string, channelId: string) => {
    if (!settings.store.logMessageChanges) return;

    const snapshot = messageCache.get(messageId);
    const info = getChannelInfo(channelId);

    if (!snapshot) {
        addServerEvent("message_delete", info.guildId, "Deleted an uncached message.", {
            username: "Unknown user",
            ...info,
            metadata: {
                messageId,
                cached: false,
            },
        });
        return;
    }

    const guildId = snapshot.guildId ?? info.guildId;
    if (!shouldTrackEvent(snapshot.userId, guildId)) return;

    rememberServerUser(snapshot.userId, guildId);

    const content = settings.store.captureMessageContent ? preview(snapshot.content) : undefined;

    addEvent({
        type: "message_delete",
        userId: snapshot.userId,
        username: snapshot.username,
        details: content ? `Deleted message: ${content}` : "Deleted a message.",
        scope: getScope(snapshot.userId, guildId),
        content,
        ...info,
        metadata: {
            messageId,
            cached: true,
        },
    });

    messageCache.delete(messageId);
};

const logTyping = (userId: string, channelId: string) => {
    if (!settings.store.logTyping) return;
    if (shouldIgnoreUser(userId)) return;

    const info = getChannelInfo(channelId);
    if (!shouldTrackEvent(userId, info.guildId)) return;

    const key = `${userId}:${channelId}`;
    const now = Date.now();
    const lastTypedAt = typingCooldowns.get(key) ?? 0;

    if (now - lastTypedAt < TYPING_COOLDOWN) return;

    typingCooldowns.set(key, now);
    rememberServerUser(userId, info.guildId);
    addUserEvent("typing", userId, "Started typing.", info);
};

const formatEmoji = (emoji: ReactionEmoji | undefined) =>
    emoji?.name ?? emoji?.id ?? "Unknown emoji";

const logReaction = (type: "reaction_add" | "reaction_remove", event: MessageReactionFluxEvent) => {
    if (!settings.store.logReactions || !event.userId) return;
    if (shouldIgnoreUser(event.userId)) return;

    const info = getChannelInfo(event.channelId);
    if (!shouldTrackEvent(event.userId, info.guildId)) return;

    rememberServerUser(event.userId, info.guildId);
    addUserEvent(
        type,
        event.userId,
        type === "reaction_add" ? `Added reaction ${formatEmoji(event.emoji)}.` : `Removed reaction ${formatEmoji(event.emoji)}.`,
        {
            ...info,
            metadata: {
                messageId: event.messageId,
                emojiId: event.emoji?.id ?? null,
                emojiName: event.emoji?.name ?? null,
                animated: event.emoji?.animated ?? false,
            },
        }
    );
};

const logReactionClear = (event: { channelId: string; messageId: string; }) => {
    if (!settings.store.logReactions) return;

    const info = getChannelInfo(event.channelId);
    addServerEvent("reaction_remove_all", info.guildId, "Removed all reactions from a message.", {
        ...info,
        metadata: {
            messageId: event.messageId,
        },
    });
};

const logChannelEvent = (type: "channel_create" | "channel_delete" | "channel_update", event: ChannelFluxEvent) => {
    const info = getChannelEventInfo(event);
    const label = info.channelName ?? info.channelId ?? "Unknown channel";
    const verb = type === "channel_create" ? "Created" : type === "channel_delete" ? "Deleted" : "Updated";

    addServerEvent(type, info.guildId, `${verb} channel ${label}.`, {
        ...info,
        metadata: {
            channelId: info.channelId ?? null,
            channelType: event.channel?.type ?? null,
        },
    });
};

const logThreadEvent = (type: "thread_create" | "thread_delete" | "thread_update", event: ChannelFluxEvent) => {
    const info = getChannelEventInfo(event);
    const label = info.channelName ?? info.channelId ?? "Unknown thread";
    const verb = type === "thread_create" ? "Created" : type === "thread_delete" ? "Deleted" : "Updated";

    addServerEvent(type, info.guildId, `${verb} thread ${label}.`, {
        ...info,
        metadata: {
            channelId: info.channelId ?? null,
            parentId: event.channel?.parent_id ?? null,
        },
    });
};

const logGuildMemberEvent = (
    type: "guild_member_add" | "guild_member_remove" | "guild_member_update",
    event: GuildMemberFluxEvent
) => {
    if (type === "guild_member_update" && !settings.store.logMemberUpdates) return;

    const guildId = event.guildId ?? event.guild_id ?? event.member?.guildId;
    if (!shouldTrackServer(guildId)) return;

    const userId = event.user?.id ?? event.userId ?? event.member?.userId;
    if (userId && isCurrentUser(userId)) return;
    if (userId && shouldIgnoreUser(userId, event.user)) return;

    const joinedAt = event.member?.joinedAt ? Date.parse(event.member.joinedAt) : undefined;
    const isFreshJoin = joinedAt != null && Date.now() - joinedAt < MEMBER_JOIN_FRESHNESS;
    const username = userId ? getUsername(userId, event.user?.username) : "Unknown user";
    const details =
        type === "guild_member_add"
            ? isFreshJoin ? "Joined the server." : "Member became visible in the live cache."
            : type === "guild_member_remove"
                ? "Left the server."
                : "Updated server member.";

    if (userId) rememberServerUser(userId, guildId);

    addServerEvent(type, guildId, details, {
        userId: userId ?? guildId,
        username,
        metadata: {
            joinedAt: event.member?.joinedAt ?? null,
            realJoin: type === "guild_member_add" ? isFreshJoin : null,
            nick: event.member?.nick ?? null,
            roleCount: event.member?.roles.length ?? null,
        },
    });
};

const logGuildEvent = (event: GuildFluxEvent) => {
    const guildId = event.guild?.id ?? event.guildId;
    const guildName = event.guild?.name ?? GuildStore.getGuild(guildId ?? "")?.name;

    addServerEvent("guild_update", guildId, `Server settings changed${guildName ? ` for ${guildName}` : ""}.`, {
        guildName,
    });
};

const logRoleEvent = (type: "role_create" | "role_delete" | "role_update", event: RoleFluxEvent) => {
    const guildId = event.role?.guildId ?? event.guildId ?? event.guild_id;
    const roleName = event.role?.name ?? event.roleId ?? "Unknown role";
    const verb = type === "role_create" ? "Created" : type === "role_delete" ? "Deleted" : "Updated";

    addServerEvent(type, guildId, `${verb} role ${roleName}.`, {
        metadata: {
            roleId: event.role?.id ?? event.roleId ?? null,
            roleName,
        },
    });
};

const patchUserContext: NavContextMenuPatchCallback = (children, { user }: UserContextProps) => {
    if (!settings.store.addContextMenu || !user) return;

    const tracked = targets.includes(user.id);
    const group = findGroupChildrenByChildId("apps", children) ?? children;
    let index = group.findLastIndex(child => child?.props?.id === "ignore");
    if (index < 0) index = group.length - 1;

    group.splice(index, 0,
        <Menu.MenuItem
            id="vc-surveillance-toggle"
            label={tracked ? "Remove from Surveillance" : "Add to Surveillance"}
            action={() => {
                if (tracked) removeTarget(user.id);
                else addTarget(user.id);
            }}
        />
    );
};

export default definePlugin({
    name: "Surveillance",
    description: "Adds a local live event dashboard for selected users and servers.",
    tags: ["Friends", "Utility"],
    authors: [{ name: "irritably", id: 928787166916640838n }],
    enabledByDefault: false,
    settings,
    contextMenus: {
        "user-context": patchUserContext,
    },
    toolboxActions: {
        "Open Surveillance": () => SettingsRouter.openUserSettings(`${SETTINGS_ENTRY_KEY}_panel`),
    },

    start() {
        updateTargets(settings.store.targets);
        updateServerTargets(settings.store.serverTargets);
        seedPresence();
        PresenceStore.addChangeListener(handlePresenceChange);

        if (!SettingsPlugin.customEntries.some(entry => entry.key === SETTINGS_ENTRY_KEY)) {
            SettingsPlugin.customEntries.push({
                key: SETTINGS_ENTRY_KEY,
                title: "Surveillance",
                Component: require("./components/SurveillanceTab").default,
                Icon: LogIcon,
            });
        }
    },

    stop() {
        PresenceStore.removeChangeListener(handlePresenceChange);
        removeFromArray(SettingsPlugin.customEntries, entry => entry.key === SETTINGS_ENTRY_KEY);
        previousVoiceStates.clear();
        messageCache.clear();
        typingCooldowns.clear();
        seenServerUsers.clear();
        lastStatuses.clear();
        lastActivities.clear();
    },

    flux: {
        MESSAGE_CREATE({ message }: { message: Message; }) {
            logMessage(message);
        },

        MESSAGE_UPDATE({ message }: { message: Message; }) {
            logMessageUpdate(message);
        },

        MESSAGE_DELETE({ id, channelId }: { id: string; channelId: string; }) {
            logMessageDelete(id, channelId);
        },

        MESSAGE_DELETE_BULK({ ids, channelId }: { ids: string[]; channelId: string; }) {
            for (const id of ids) {
                logMessageDelete(id, channelId);
            }
        },

        MESSAGE_REACTION_ADD(event: MessageReactionFluxEvent) {
            logReaction("reaction_add", event);
        },

        MESSAGE_REACTION_REMOVE(event: MessageReactionFluxEvent) {
            logReaction("reaction_remove", event);
        },

        MESSAGE_REACTION_REMOVE_ALL(event: { channelId: string; messageId: string; }) {
            logReactionClear(event);
        },

        TYPING_START({ userId, channelId }: { userId: string; channelId: string; }) {
            logTyping(userId, channelId);
        },

        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            for (const voiceState of voiceStates) {
                handleVoiceState(voiceState);
            }
        },

        CHANNEL_CREATE(event: ChannelFluxEvent) {
            logChannelEvent("channel_create", event);
        },

        CHANNEL_DELETE(event: ChannelFluxEvent) {
            logChannelEvent("channel_delete", event);
        },

        CHANNEL_UPDATE(event: ChannelFluxEvent) {
            logChannelEvent("channel_update", event);
        },

        CHANNEL_UPDATES({ channels }: { channels: Channel[]; }) {
            for (const channel of channels) {
                logChannelEvent("channel_update", { channel });
            }
        },

        THREAD_CREATE(event: ChannelFluxEvent) {
            logThreadEvent("thread_create", event);
        },

        THREAD_DELETE(event: ChannelFluxEvent) {
            logThreadEvent("thread_delete", event);
        },

        THREAD_UPDATE(event: ChannelFluxEvent) {
            logThreadEvent("thread_update", event);
        },

        GUILD_MEMBER_ADD(event: GuildMemberFluxEvent) {
            logGuildMemberEvent("guild_member_add", event);
        },

        GUILD_MEMBER_REMOVE(event: GuildMemberFluxEvent) {
            logGuildMemberEvent("guild_member_remove", event);
        },

        GUILD_MEMBER_UPDATE(event: GuildMemberFluxEvent) {
            logGuildMemberEvent("guild_member_update", event);
        },

        GUILD_UPDATE(event: GuildFluxEvent) {
            logGuildEvent(event);
        },

        GUILD_ROLE_CREATE(event: RoleFluxEvent) {
            logRoleEvent("role_create", event);
        },

        GUILD_ROLE_DELETE(event: RoleFluxEvent) {
            logRoleEvent("role_delete", event);
        },

        GUILD_ROLE_UPDATE(event: RoleFluxEvent) {
            logRoleEvent("role_update", event);
        },
    },
});
