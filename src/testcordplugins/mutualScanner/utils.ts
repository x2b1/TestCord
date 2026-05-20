/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { fetchUserProfile } from "@utils/discord";
import { sleep } from "@utils/misc";
import type { User } from "@vencord/discord-types";
import { GuildMemberStore, GuildStore, IconUtils, RelationshipStore, UserProfileStore, UserStore } from "@webpack/common";

import { getHydratedGuildMemberIds, type GuildHydrationSnapshot, hydrateGuildMemberCache } from "./memberHydrator";
import type {
    MutualScannerConfig,
    MutualScannerController,
    MutualScannerExecutionResult,
    MutualScannerGuildOption,
    MutualScannerMatch,
    MutualScannerProgress,
    MutualScannerRun,
    MutualScannerRunStats,
} from "./types";

interface RawIdentity {
    avatar?: string | null;
    username?: string;
    globalName?: string;
    global_name?: string;
    bot?: boolean;
}

export type HydrationSnapshotQuality = "complete" | "partial" | "stale" | "cancelled";

export interface MutualScannerRunComparison {
    previousRun: MutualScannerRun | null;
    newMatches: MutualScannerMatch[];
    disappearedMatches: MutualScannerMatch[];
    sameMatches: MutualScannerMatch[];
}

const activeControllers = new Set<MutualScannerController>();

export function makeLocalId(prefix: string) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getDefaultAvatarUrl(userId: string) {
    return IconUtils.getDefaultAvatarURL(userId);
}

export function buildIdentityFromUser(userId: string, user?: RawIdentity | null, fallbackLabel?: string) {
    const displayName = user?.globalName || user?.global_name || user?.username || fallbackLabel || userId;
    const avatarHash = user?.avatar;
    const avatarUrl = avatarHash
        ? IconUtils.getUserAvatarURL({ id: userId, avatar: avatarHash } as User, true, 80)
        : getDefaultAvatarUrl(userId);

    return {
        label: displayName,
        username: user?.username,
        details: user?.username && user.username !== displayName
            ? `@${user.username}`
            : `User ID ${userId}`,
        avatarUrl,
        isBot: Boolean(user?.bot),
    };
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

export function formatDurationMs(durationMs: number) {
    if (durationMs < 1000) return `${durationMs}ms`;

    const totalSeconds = Math.round(durationMs / 1000);
    if (totalSeconds < 60) return `${totalSeconds}s`;

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

export function estimateScanRemainingMs(
    progress: MutualScannerProgress | null,
    startedAt: number | null,
    requestDelayMs: number,
) {
    if (!progress || !startedAt) return null;
    if (progress.phase === "warming" || progress.phase === "collecting") return null;
    if (!progress.totalCandidates || progress.totalCandidates <= 0) return null;

    const remainingCandidates = Math.max(0, progress.totalCandidates - progress.scannedCount);
    if (remainingCandidates === 0) return 0;

    const elapsedMs = Math.max(0, Date.now() - startedAt);
    const observedPerCandidateMs = progress.scannedCount > 0
        ? elapsedMs / progress.scannedCount
        : 0;
    const baselinePerCandidateMs = requestDelayMs > 0 ? requestDelayMs + 250 : 850;
    const estimatedPerCandidateMs = Math.max(baselinePerCandidateMs, observedPerCandidateMs);

    return Math.round(remainingCandidates * estimatedPerCandidateMs);
}

export function buildGuildOptions() {
    return GuildStore.getGuildsArray()
        .map(guild => {
            const iconUrl = guild.icon
                ? IconUtils.getGuildIconURL({ id: guild.id, icon: guild.icon, size: 80, canAnimate: true })
                : undefined;

            return {
                id: guild.id,
                label: guild.name,
                memberCount: GuildMemberStore.getMemberIds(guild.id)?.length ?? GuildMemberStore.getMembers(guild.id)?.length ?? 0,
                iconUrl,
            } satisfies MutualScannerGuildOption;
        })
        .sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id));
}

function getSnapshotLifetimeMs(snapshot: GuildHydrationSnapshot) {
    return Math.max(1, snapshot.expiresAt - snapshot.warmedAt);
}

export function getHydrationSnapshotQuality(
    snapshot: GuildHydrationSnapshot,
    targetCount: number | null,
    now = Date.now(),
): HydrationSnapshotQuality {
    if (snapshot.cancelled) {
        return "cancelled";
    }

    const incompleteTarget = targetCount != null && snapshot.finalCount < targetCount;
    if (snapshot.timedOut || snapshot.budgetReached || incompleteTarget) {
        return "partial";
    }

    const remainingMs = snapshot.expiresAt - now;
    const staleThresholdMs = Math.min(12 * 60 * 60 * 1000, Math.round(getSnapshotLifetimeMs(snapshot) * 0.2));
    if (remainingMs <= staleThresholdMs) {
        return "stale";
    }

    return "complete";
}

export function getHydrationSnapshotQualityLabel(quality: HydrationSnapshotQuality) {
    switch (quality) {
        case "cancelled":
            return "Cancelled";
        case "partial":
            return "Partial";
        case "stale":
            return "Stale";
        default:
            return "Complete";
    }
}

export function isHydrationSnapshotWeak(
    snapshot: GuildHydrationSnapshot | null | undefined,
    targetCount: number | null,
    now = Date.now(),
) {
    if (!snapshot) return true;
    return getHydrationSnapshotQuality(snapshot, targetCount, now) !== "complete";
}

function normalizeScopeGuildIds(run: MutualScannerRun) {
    return Array.from(new Set(run.configSnapshot.selectedGuildIds)).sort((left, right) => left.localeCompare(right));
}

export function isComparableMutualScannerRun(left: MutualScannerRun, right: MutualScannerRun) {
    const leftGuildIds = normalizeScopeGuildIds(left);
    const rightGuildIds = normalizeScopeGuildIds(right);

    return leftGuildIds.length === rightGuildIds.length
        && leftGuildIds.every((guildId, index) => guildId === rightGuildIds[index])
        && left.configSnapshot.includeBots === right.configSnapshot.includeBots
        && left.configSnapshot.skipExistingFriends === right.configSnapshot.skipExistingFriends
        && left.configSnapshot.maxMembersPerGuild === right.configSnapshot.maxMembersPerGuild;
}

export function buildMutualScannerRunComparison(
    currentRun: MutualScannerRun,
    previousRun: MutualScannerRun | null,
): MutualScannerRunComparison {
    if (!previousRun) {
        return {
            previousRun: null,
            newMatches: [],
            disappearedMatches: [],
            sameMatches: [],
        };
    }

    const previousMatches = new Map(previousRun.matches.map(match => [match.userId, match]));
    const currentMatches = new Map(currentRun.matches.map(match => [match.userId, match]));
    const newMatches = currentRun.matches.filter(match => !previousMatches.has(match.userId));
    const sameMatches = currentRun.matches.filter(match => previousMatches.has(match.userId));
    const disappearedMatches = previousRun.matches.filter(match => !currentMatches.has(match.userId));

    return {
        previousRun,
        newMatches,
        disappearedMatches,
        sameMatches,
    };
}

function createEmptyStats(config: MutualScannerConfig): MutualScannerRunStats {
    return {
        guildCount: config.selectedGuildIds.length,
        candidateCount: 0,
        scannedCount: 0,
        matchedCount: 0,
        skippedBots: 0,
        skippedExistingFriends: 0,
        profileErrors: 0,
        countOnlyMatches: 0,
    };
}

function emitProgress(
    stats: MutualScannerRunStats,
    totalCandidates: number,
    phase: MutualScannerProgress["phase"],
    currentUserId?: string,
    currentLabel?: string,
    onProgress?: (progress: MutualScannerProgress) => void,
) {
    onProgress?.({
        phase,
        totalCandidates,
        scannedCount: stats.scannedCount,
        matchedCount: stats.matchedCount,
        skippedBots: stats.skippedBots,
        skippedExistingFriends: stats.skippedExistingFriends,
        profileErrors: stats.profileErrors,
        countOnlyMatches: stats.countOnlyMatches,
        currentUserId,
        currentLabel,
    });
}

export function createMutualScannerController(): MutualScannerController {
    const controller: MutualScannerController = {
        cancelled: false,
        cancel() {
            controller.cancelled = true;
            activeControllers.delete(controller);
        },
    };

    activeControllers.add(controller);
    return controller;
}

export function cancelAllMutualScannerControllers() {
    for (const controller of Array.from(activeControllers)) {
        controller.cancel();
    }
}

export function toErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === "string" && error.trim()) return error;
    return "Unexpected scanner failure.";
}

async function collectCandidateMemberships(config: MutualScannerConfig, ownerId: string | null) {
    const membershipMap = new Map<string, Set<string>>();
    const currentUserId = UserStore.getCurrentUser()?.id;

    for (const guildId of config.selectedGuildIds) {
        const hydratedIds = await getHydratedGuildMemberIds(ownerId, guildId);
        const liveIds = GuildMemberStore.getMemberIds(guildId) ?? GuildMemberStore.getMembers(guildId)?.map(member => member.userId) ?? [];
        const ids = Array.from(new Set([...hydratedIds, ...liveIds]));
        const limit = config.maxMembersPerGuild > 0 ? Math.min(ids.length, config.maxMembersPerGuild) : ids.length;

        for (let index = 0; index < limit; index++) {
            const userId = ids[index];
            if (!userId || userId === currentUserId) continue;

            const membership = membershipMap.get(userId);
            if (membership) {
                membership.add(guildId);
                continue;
            }

            membershipMap.set(userId, new Set([guildId]));
        }
    }

    return membershipMap;
}

function buildMatch(
    userId: string,
    guildIds: Set<string>,
    mutualFriends: Array<{ user?: RawIdentity | null; key: string; }> | undefined,
    matchSource: "list" | "count",
): MutualScannerMatch {
    const user = UserStore.getUser(userId) as RawIdentity | undefined;
    const identity = buildIdentityFromUser(userId, user);
    const guildNames = Array.from(guildIds)
        .map(guildId => GuildStore.getGuild(guildId)?.name ?? guildId)
        .sort((left, right) => left.localeCompare(right));
    const mutualFriendLabels = Array.isArray(mutualFriends)
        ? mutualFriends
            .map(friend => {
                const cachedUser = (friend.user ?? UserStore.getUser(friend.key)) as RawIdentity | undefined;
                return RelationshipStore.getNickname(friend.key) || buildIdentityFromUser(friend.key, cachedUser).label;
            })
            .filter(Boolean)
        : [];

    return {
        userId,
        label: identity.label,
        username: identity.username,
        details: identity.details,
        avatarUrl: identity.avatarUrl,
        guildIds: Array.from(guildIds),
        guildNames,
        mutualFriendCount: UserProfileStore.getMutualFriendsCount(userId) ?? UserProfileStore.getMutualFriends(userId)?.length ?? 0,
        mutualFriendLabels,
        matchSource,
        matchedAt: Date.now(),
        isExistingFriend: RelationshipStore.isFriend(userId),
        isBot: identity.isBot,
    };
}

export async function executeMutualScan(
    config: MutualScannerConfig,
    options?: {
        ownerId?: string | null;
        controller?: MutualScannerController;
        onProgress?: (progress: MutualScannerProgress) => void;
        onMatch?: (match: MutualScannerMatch) => void;
    },
): Promise<MutualScannerExecutionResult> {
    const stats = createEmptyStats(config);
    const matches: MutualScannerMatch[] = [];
    const controller = options?.controller;
    const ownerId = options?.ownerId ?? UserStore.getCurrentUser()?.id ?? null;
    if (config.warmMemberCacheBeforeScan && config.selectedGuildIds.length > 0) {
        for (let index = 0; index < config.selectedGuildIds.length; index++) {
            const guildId = config.selectedGuildIds[index];
            const guildName = GuildStore.getGuild(guildId)?.name ?? guildId;

            emitProgress(stats, 0, "warming", guildId, `${guildName} (${index + 1}/${config.selectedGuildIds.length})`, options?.onProgress);

            const hydration = await hydrateGuildMemberCache(guildId, {
                ownerId,
                controller,
                maxWaitMs: config.warmupTimeoutMs,
                memberBudget: config.warmupMemberBudget,
                onProgress: progress => {
                    const suffix = progress.state === "cache"
                        ? "cached index"
                        : `+${progress.delta}`;
                    emitProgress(stats, 0, "warming", guildId, `${guildName} ${suffix}`, options?.onProgress);
                },
            });

            if (hydration.cancelled) {
                if (controller) activeControllers.delete(controller);
                return {
                    status: "cancelled",
                    finishedAt: Date.now(),
                    stats: {
                        ...stats,
                        matchedCount: matches.length,
                    },
                    matches,
                };
            }

            if (controller?.cancelled) {
                if (controller) activeControllers.delete(controller);
                return {
                    status: "cancelled",
                    finishedAt: Date.now(),
                    stats: {
                        ...stats,
                        matchedCount: matches.length,
                    },
                    matches,
                };
            }
        }
    }

    const candidates = Array.from((await collectCandidateMemberships(config, ownerId)).entries());

    stats.candidateCount = candidates.length;
    emitProgress(stats, candidates.length, "collecting", undefined, undefined, options?.onProgress);

    try {
        for (const [candidateId, guildIds] of candidates) {
            if (controller?.cancelled) {
                if (controller) activeControllers.delete(controller);
                return {
                    status: "cancelled",
                    finishedAt: Date.now(),
                    stats: {
                        ...stats,
                        matchedCount: matches.length,
                    },
                    matches,
                };
            }

            if (config.skipExistingFriends && RelationshipStore.isFriend(candidateId)) {
                stats.skippedExistingFriends++;
                emitProgress(stats, candidates.length, "scanning", candidateId, buildIdentityFromUser(candidateId, UserStore.getUser(candidateId) as RawIdentity | undefined).label, options?.onProgress);
                continue;
            }

            const previewIdentity = buildIdentityFromUser(candidateId, UserStore.getUser(candidateId) as RawIdentity | undefined);
            emitProgress(stats, candidates.length, "scanning", candidateId, previewIdentity.label, options?.onProgress);

            try {
                await fetchUserProfile(candidateId, {
                    guild_id: Array.from(guildIds)[0],
                    with_mutual_guilds: true,
                    with_mutual_friends_count: true,
                }, false);
            } catch {
                stats.profileErrors++;
                stats.scannedCount++;

                if (config.requestDelayMs > 0) {
                    await sleep(config.requestDelayMs);
                }

                continue;
            }

            const resolvedUser = UserStore.getUser(candidateId) as RawIdentity | undefined;
            if (!config.includeBots && resolvedUser?.bot) {
                stats.skippedBots++;
                stats.scannedCount++;

                if (config.requestDelayMs > 0) {
                    await sleep(config.requestDelayMs);
                }

                continue;
            }

            const mutualFriends = UserProfileStore.getMutualFriends(candidateId);
            const mutualFriendCount = UserProfileStore.getMutualFriendsCount(candidateId);

            const hasAnyMutual = Array.isArray(mutualFriends)
                ? mutualFriends.length > 0
                : (mutualFriendCount ?? 0) > 0;

            if (hasAnyMutual) {
                const matchSource = Array.isArray(mutualFriends) ? "list" : "count";
                if (matchSource === "count") {
                    stats.countOnlyMatches++;
                }

                const match = buildMatch(candidateId, guildIds, mutualFriends, matchSource);
                matches.push(match);
                stats.matchedCount = matches.length;
                options?.onMatch?.(match);
            }

            stats.scannedCount++;
            emitProgress(stats, candidates.length, "scanning", candidateId, previewIdentity.label, options?.onProgress);

            if (config.requestDelayMs > 0) {
                await sleep(config.requestDelayMs);
            }
        }

        if (controller) activeControllers.delete(controller);
        emitProgress(stats, candidates.length, "finishing", undefined, undefined, options?.onProgress);

        return {
            status: "completed",
            finishedAt: Date.now(),
            stats: {
                ...stats,
                matchedCount: matches.length,
            },
            matches,
        };
    } catch (error) {
        if (controller) activeControllers.delete(controller);
        return {
            status: "failed",
            finishedAt: Date.now(),
            stats: {
                ...stats,
                matchedCount: matches.length,
            },
            matches,
            error: toErrorMessage(error),
        };
    }
}
