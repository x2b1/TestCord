/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { User } from "@vencord/discord-types";
import { ChannelStore, IconUtils, UserStore } from "@webpack/common";

import type { PresenceLabData, PresenceLabIdentity, PresenceLabOperator, PresenceLabSession, PresenceLabTarget } from "./types";

interface RawUserIdentity {
    avatar?: string | null;
    username?: string;
    globalName?: string;
    global_name?: string;
}

export interface PresenceLabWeeklyBucket {
    key: string;
    label: string;
    minutes: number;
}

export interface PresenceLabPairStat {
    key: string;
    operatorLabel: string;
    targetLabel: string;
    sessionCount: number;
    totalMinutes: number;
}

export interface PresenceLabOverview {
    totalMinutes: number;
    weeklyMinutes: number;
    averageSessionMinutes: number;
    activeTargets: number;
    trackedTargets: number;
    sessionCount: number;
    recentSessionCount: number;
    lastSessionAt: number | null;
    readinessRatio: number;
    coverageRatio: number;
    intensityRatio: number;
    topPair: PresenceLabPairStat | null;
    weeklyBuckets: PresenceLabWeeklyBucket[];
    pairStats: PresenceLabPairStat[];
}

export function makeLocalId(prefix: string) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getDefaultAvatarUrl(userId: string) {
    return IconUtils.getDefaultAvatarURL(userId);
}

export function buildIdentityFromUser(
    discordUserId: string,
    user: RawUserIdentity,
    fallbackLabel?: string,
): Pick<PresenceLabIdentity, "label" | "username" | "details" | "avatarUrl"> {
    const displayName = user.globalName || user.global_name || user.username || fallbackLabel || discordUserId;
    const { username } = user;
    const avatarHash = user.avatar;
    const avatarUrl = avatarHash
        ? IconUtils.getUserAvatarURL({ id: discordUserId, avatar: avatarHash } as User, true, 80)
        : getDefaultAvatarUrl(discordUserId);

    return {
        label: displayName,
        username,
        details: username && username !== displayName ? `@${username}` : `User ID ${discordUserId}`,
        avatarUrl,
    };
}

export function buildManualIdentity(discordUserId: string, label?: string, notes?: string) {
    return {
        label: label?.trim() || discordUserId,
        username: undefined,
        details: notes?.trim() || `User ID ${discordUserId}`,
        avatarUrl: getDefaultAvatarUrl(discordUserId),
    };
}

export function formatDurationMinutes(minutes: number) {
    if (minutes <= 0) return "0m";
    if (minutes < 60) return `${minutes}m`;

    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function formatDateTime(timestamp: number) {
    return new Intl.DateTimeFormat(undefined, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(timestamp));
}

export function formatRelativeDay(timestamp: number) {
    const date = new Date(timestamp);
    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    if (sameDay) return "Today";

    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

    return new Intl.DateTimeFormat(undefined, {
        day: "2-digit",
        month: "short",
    }).format(date);
}

export function formatInputDateTime(timestamp: number) {
    const date = new Date(timestamp);
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60_000);
    return local.toISOString().slice(0, 16);
}

export function parseInputDateTime(value: string) {
    const parsed = new Date(value);
    const timestamp = parsed.getTime();
    return Number.isFinite(timestamp) ? timestamp : Date.now();
}

export function buildWeeklyBuckets(sessions: PresenceLabSession[]): PresenceLabWeeklyBucket[] {
    const buckets = Array.from({ length: 7 }, (_, index) => {
        const day = new Date();
        day.setHours(0, 0, 0, 0);
        day.setDate(day.getDate() - (6 - index));

        return {
            key: day.toISOString(),
            label: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day),
            minutes: 0,
            dateKey: day.toDateString(),
        };
    });

    const lookup = new Map(buckets.map(bucket => [bucket.dateKey, bucket]));

    for (const session of sessions) {
        const dayKey = new Date(session.startedAt).toDateString();
        const bucket = lookup.get(dayKey);
        if (bucket) bucket.minutes += session.durationMinutes;
    }

    return buckets.map(({ dateKey, ...bucket }) => bucket);
}

export function buildPairStats(sessions: PresenceLabSession[]) {
    const pairs = new Map<string, PresenceLabPairStat>();

    for (const session of sessions) {
        const key = `${session.operatorId}:${session.targetId}`;
        const existing = pairs.get(key);

        if (existing) {
            existing.sessionCount++;
            existing.totalMinutes += session.durationMinutes;
            continue;
        }

        pairs.set(key, {
            key,
            operatorLabel: session.operatorLabel,
            targetLabel: session.targetLabel,
            sessionCount: 1,
            totalMinutes: session.durationMinutes,
        });
    }

    return Array.from(pairs.values()).sort((left, right) =>
        right.totalMinutes - left.totalMinutes ||
        right.sessionCount - left.sessionCount ||
        left.operatorLabel.localeCompare(right.operatorLabel),
    );
}

export function buildPresenceLabOverview(data: PresenceLabData): PresenceLabOverview {
    const now = Date.now();
    const weekCutoff = now - 7 * 24 * 60 * 60 * 1000;
    const totalMinutes = data.sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
    const weeklySessions = data.sessions.filter(session => session.startedAt >= weekCutoff);
    const weeklyMinutes = weeklySessions.reduce((sum, session) => sum + session.durationMinutes, 0);
    const recentSessionCount = weeklySessions.length;
    const activeTargets = new Set(weeklySessions.map(session => session.targetId)).size;
    const averageSessionMinutes = data.sessions.length ? Math.round(totalMinutes / data.sessions.length) : 0;
    const readinessScore = [
        data.operators.length > 0 ? 1 : 0,
        data.targets.length > 0 ? 1 : 0,
        data.config.entryDelaySeconds > 0 ? 1 : 0,
        data.config.dwellMinutes > 0 ? 1 : 0,
    ].reduce((sum, value) => sum + value, 0);
    const readinessRatio = readinessScore / 4;
    const coverageRatio = data.targets.length ? activeTargets / data.targets.length : 0;
    const intensityRatio = Math.min(1, weeklyMinutes / 240);
    const pairStats = buildPairStats(data.sessions);

    return {
        totalMinutes,
        weeklyMinutes,
        averageSessionMinutes,
        activeTargets,
        trackedTargets: data.targets.length,
        sessionCount: data.sessions.length,
        recentSessionCount,
        lastSessionAt: data.sessions[0]?.startedAt ?? null,
        readinessRatio,
        coverageRatio,
        intensityRatio,
        topPair: pairStats[0] ?? null,
        weeklyBuckets: buildWeeklyBuckets(data.sessions),
        pairStats,
    };
}

export function resolveStoredIdentity(
    discordUserId: string,
    fallbackLabel?: string,
    notes?: string,
) {
    const cachedUser = UserStore.getUser(discordUserId) as RawUserIdentity | undefined;
    return cachedUser
        ? buildIdentityFromUser(discordUserId, cachedUser, fallbackLabel)
        : buildManualIdentity(discordUserId, fallbackLabel, notes);
}

export function getGuildLabel(guildName: string, channelName: string) {
    return guildName ? `${guildName} / ${channelName}` : channelName;
}

export function getSessionGroupKey(timestamp: number) {
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

export function groupSessionsByDay(sessions: PresenceLabSession[]) {
    const groups = new Map<number, PresenceLabSession[]>();

    for (const session of sessions) {
        const key = getSessionGroupKey(session.startedAt);
        const group = groups.get(key);
        if (group) {
            group.push(session);
            continue;
        }

        groups.set(key, [session]);
    }

    return Array.from(groups.entries())
        .sort((left, right) => right[0] - left[0])
        .map(([timestamp, groupedSessions]) => ({
            label: formatRelativeDay(timestamp),
            key: timestamp,
            sessions: groupedSessions.sort((left, right) => right.startedAt - left.startedAt),
        }));
}

export function getOperatorPlaceholderNote(operator: PresenceLabOperator) {
    if (operator.source === "current") return "Current local account";
    if (operator.source === "resolved") return "Resolved from Discord profile";
    return "Manual local operator";
}

export function getTargetPlaceholderNote(target: PresenceLabTarget) {
    return target.trackingEnabled ? "Ready for local testing" : "Paused in the lab";
}

export function resolveChannelName(channelId: string) {
    const channel = ChannelStore.getChannel(channelId);
    return channel?.name ?? channelId;
}
