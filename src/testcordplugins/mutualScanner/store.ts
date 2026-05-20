/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { React, UserStore } from "@webpack/common";
import type { DispatchWithoutAction } from "react";

import type { MutualScannerConfig, MutualScannerData, MutualScannerMatch, MutualScannerRun, MutualScannerRunStats } from "./types";

const STORAGE_PREFIX = "kamidere-mutual-scanner:";
const MAX_RUN_HISTORY = 12;
const cache = new Map<string, MutualScannerData>();
const signals = new Set<DispatchWithoutAction>();

const DEFAULT_CONFIG: MutualScannerConfig = {
    selectedGuildIds: [],
    requestDelayMs: 650,
    includeBots: false,
    skipExistingFriends: false,
    maxMembersPerGuild: 0,
    warmMemberCacheBeforeScan: true,
    warmupTimeoutMs: 4000,
    warmupMemberBudget: 0,
};

const EMPTY_STATS: MutualScannerRunStats = {
    guildCount: 0,
    candidateCount: 0,
    scannedCount: 0,
    matchedCount: 0,
    skippedBots: 0,
    skippedExistingFriends: 0,
    profileErrors: 0,
    countOnlyMatches: 0,
};

function emit() {
    signals.forEach(signal => signal());
}

function getStorageKey(userId: string) {
    return `${STORAGE_PREFIX}${userId}`;
}

function cloneConfig(config?: Partial<MutualScannerConfig>): MutualScannerConfig {
    return {
        selectedGuildIds: Array.from(new Set(config?.selectedGuildIds ?? DEFAULT_CONFIG.selectedGuildIds)),
        requestDelayMs: config?.requestDelayMs ?? DEFAULT_CONFIG.requestDelayMs,
        includeBots: config?.includeBots ?? DEFAULT_CONFIG.includeBots,
        skipExistingFriends: config?.skipExistingFriends ?? DEFAULT_CONFIG.skipExistingFriends,
        maxMembersPerGuild: config?.maxMembersPerGuild ?? DEFAULT_CONFIG.maxMembersPerGuild,
        warmMemberCacheBeforeScan: config?.warmMemberCacheBeforeScan ?? DEFAULT_CONFIG.warmMemberCacheBeforeScan,
        warmupTimeoutMs: config?.warmupTimeoutMs ?? DEFAULT_CONFIG.warmupTimeoutMs,
        warmupMemberBudget: config?.warmupMemberBudget ?? DEFAULT_CONFIG.warmupMemberBudget,
    };
}

function normalizeMatch(match: MutualScannerMatch): MutualScannerMatch {
    return {
        ...match,
        guildIds: Array.from(new Set(match.guildIds)),
        guildNames: Array.from(new Set(match.guildNames)).sort((left, right) => left.localeCompare(right)),
        mutualFriendLabels: Array.from(new Set(match.mutualFriendLabels ?? [])).sort((left, right) => left.localeCompare(right)),
        matchSource: match.matchSource ?? "count",
    };
}

function cloneStats(stats?: Partial<MutualScannerRunStats>): MutualScannerRunStats {
    return {
        guildCount: stats?.guildCount ?? EMPTY_STATS.guildCount,
        candidateCount: stats?.candidateCount ?? EMPTY_STATS.candidateCount,
        scannedCount: stats?.scannedCount ?? EMPTY_STATS.scannedCount,
        matchedCount: stats?.matchedCount ?? EMPTY_STATS.matchedCount,
        skippedBots: stats?.skippedBots ?? EMPTY_STATS.skippedBots,
        skippedExistingFriends: stats?.skippedExistingFriends ?? EMPTY_STATS.skippedExistingFriends,
        profileErrors: stats?.profileErrors ?? EMPTY_STATS.profileErrors,
        countOnlyMatches: stats?.countOnlyMatches ?? EMPTY_STATS.countOnlyMatches,
    };
}

function normalizeRun(run: MutualScannerRun): MutualScannerRun {
    return {
        ...run,
        configSnapshot: cloneConfig(run.configSnapshot),
        stats: cloneStats(run.stats),
        matches: [...run.matches].map(normalizeMatch).sort((left, right) =>
            left.label.localeCompare(right.label) || left.userId.localeCompare(right.userId),
        ),
    };
}

function normalizeData(data?: Partial<MutualScannerData> | null): MutualScannerData {
    return {
        config: cloneConfig(data?.config),
        runs: [...(data?.runs ?? [])]
            .map(normalizeRun)
            .sort((left, right) => right.startedAt - left.startedAt)
            .slice(0, MAX_RUN_HISTORY),
    };
}

function getCachedData(userId: string | null) {
    if (!userId) return normalizeData();
    return cache.get(userId) ?? normalizeData();
}

function setCachedData(userId: string | null, data: MutualScannerData) {
    if (!userId) return;
    cache.set(userId, normalizeData(data));
}

export async function getMutualScannerData(userId: string | null) {
    if (!userId) return normalizeData();
    const stored = await DataStore.get(getStorageKey(userId)) as MutualScannerData | undefined;
    const normalized = normalizeData(stored);
    setCachedData(userId, normalized);
    return normalized;
}

export async function updateMutualScannerData(
    userId: string | null,
    updater: (current: MutualScannerData) => MutualScannerData,
) {
    if (!userId) return normalizeData();

    let nextData = getCachedData(userId);

    await DataStore.update(getStorageKey(userId), (existing: MutualScannerData | undefined) => {
        nextData = normalizeData(updater(normalizeData(existing)));
        return nextData;
    });

    setCachedData(userId, nextData);
    emit();
    return nextData;
}

export async function updateMutualScannerConfig(userId: string | null, patch: Partial<MutualScannerConfig>) {
    return updateMutualScannerData(userId, current => ({
        ...current,
        config: cloneConfig({ ...current.config, ...patch }),
    }));
}

export async function addMutualScannerRun(userId: string | null, run: MutualScannerRun) {
    return updateMutualScannerData(userId, current => ({
        ...current,
        runs: [normalizeRun(run), ...current.runs.filter(existing => existing.id !== run.id)].slice(0, MAX_RUN_HISTORY),
    }));
}

export async function removeMutualScannerRun(userId: string | null, runId: string) {
    return updateMutualScannerData(userId, current => ({
        ...current,
        runs: current.runs.filter(run => run.id !== runId),
    }));
}

export async function clearMutualScannerRuns(userId: string | null) {
    return updateMutualScannerData(userId, current => ({
        ...current,
        runs: [],
    }));
}

export function useMutualScannerData(userId: string | null) {
    const [signal, setSignal] = React.useReducer(value => value + 1, 0);
    const [data, setData] = React.useState<MutualScannerData>(() => getCachedData(userId));
    const [pending, setPending] = React.useState(() => !!userId && !cache.has(userId));
    const previousUserIdRef = React.useRef<string | null | undefined>(void 0);

    React.useEffect(() => {
        signals.add(setSignal);
        return () => void signals.delete(setSignal);
    }, []);

    React.useEffect(() => {
        let isAlive = true;
        const userChanged = previousUserIdRef.current !== userId;
        previousUserIdRef.current = userId;

        if (userChanged) {
            setData(getCachedData(userId));
            setPending(!!userId && !cache.has(userId));
        }

        void getMutualScannerData(userId).then(nextData => {
            if (!isAlive) return;
            setData(nextData);
            setPending(false);
        });

        return () => {
            isAlive = false;
        };
    }, [signal, userId]);

    return [data, pending] as const;
}

export function getMutualScannerCurrentUserId() {
    return UserStore.getCurrentUser()?.id ?? null;
}
