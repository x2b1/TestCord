/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { Logger } from "@utils/Logger";
import { sleep } from "@utils/misc";
import { findByPropsLazy } from "@webpack";
import { FluxDispatcher, GuildMemberStore, SnowflakeUtils } from "@webpack/common";

const logger = new Logger("KamidereMemberHydrator");
const GuildActions = findByPropsLazy("requestMembers", "requestMembersById") as {
    requestMembers?: (guildId: string, query?: string, limit?: number, includePresences?: boolean) => void;
    requestMembersById?: (guildId: string, userIds: string[], includePresences?: boolean) => void;
};

const STORAGE_PREFIX = "kamidere-hydration-index:v1:";
const DEFAULT_INDEX_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const WARMUP_QUERY_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789_.-";
const WARMUP_QUERY_FANOUT = [
    "",
    ...WARMUP_QUERY_CHARS,
];
const WARMUP_QUERY_LIMIT = 100;
const WARMUP_QUERY_MAX_DEPTH = 3;
const WARMUP_MAX_STALLED_PASSES = 2;

export interface GuildHydrationBudget {
    maxWaitMs?: number;
    idleWindowMs?: number;
    pollIntervalMs?: number;
    memberBudget?: number;
    ttlMs?: number;
    targetCount?: number | null;
    continueUntilTarget?: boolean;
}

export interface GuildHydrationSnapshot {
    guildId: string;
    ownerId: string | null;
    memberIds: string[];
    initialCount: number;
    finalCount: number;
    delta: number;
    chunksSeen: number;
    warmedAt: number;
    finishedAt: number;
    expiresAt: number;
    timedOut: boolean;
    budgetReached: boolean;
    cancelled: boolean;
}

export interface GuildHydrationProgress {
    guildId: string;
    ownerId: string | null;
    initialCount: number;
    finalCount: number;
    delta: number;
    chunksSeen: number;
    startedAt: number;
    finishedAt: number;
    timedOut: boolean;
    budgetReached: boolean;
    state: "queued" | "running" | "completed" | "cancelled" | "cache";
    pendingJobs: number;
}

export interface GuildHydrationResult extends GuildHydrationSnapshot {
    source: "warmup" | "index" | "cancelled";
    cancelled: boolean;
}

export interface GuildHydrationController {
    cancelled: boolean;
    cancel(): void;
}

export interface GuildHydrationOptions extends GuildHydrationBudget {
    ownerId?: string | null;
    forceRefresh?: boolean;
    controller?: GuildHydrationController;
    onProgress?: (progress: GuildHydrationProgress) => void;
}

interface GuildMembersChunkEvent {
    guildId?: string;
    guild_id?: string;
    guildID?: string;
    nonce?: string;
    members?: unknown[];
    memberIds?: unknown[];
}

interface GuildMembersChunkBatchEvent {
    chunks?: GuildMembersChunkEvent[];
}

const snapshotCache = new Map<string, GuildHydrationSnapshot>();
const inFlightHydrations = new Map<string, Promise<GuildHydrationResult>>();
const activeControllers = new Set<GuildHydrationController>();
const queuedTasks: Array<() => Promise<void>> = [];
let drainingQueue = false;

function getStorageKey(ownerId: string | null, guildId: string) {
    return `${STORAGE_PREFIX}${ownerId ?? "anonymous"}:${guildId}`;
}

function getOwnerStoragePrefix(ownerId: string | null) {
    return `${STORAGE_PREFIX}${ownerId ?? "anonymous"}:`;
}

function getJobKey(ownerId: string | null, guildId: string) {
    return `${ownerId ?? "anonymous"}:${guildId}`;
}

function getMemberIdsFromStore(guildId: string) {
    const directIds = GuildMemberStore.getMemberIds(guildId);
    if (Array.isArray(directIds) && directIds.length > 0) {
        return Array.from(new Set(directIds.filter(Boolean)));
    }

    const members = GuildMemberStore.getMembers(guildId);
    if (!Array.isArray(members) || members.length === 0) {
        return [] as string[];
    }

    return Array.from(new Set(members.map(member => member?.userId).filter(Boolean)));
}

function getMemberCount(guildId: string) {
    return getMemberIdsFromStore(guildId).length;
}

function getChunkGuildId(chunk: GuildMembersChunkEvent): string | null {
    return chunk?.guildId ?? chunk?.guild_id ?? chunk?.guildID ?? null;
}

function getChunkNonce(chunk: GuildMembersChunkEvent): string | null {
    return chunk?.nonce ?? null;
}

function getChunkMemberHitCount(chunk: GuildMembersChunkEvent) {
    if (Array.isArray(chunk?.members)) {
        return chunk.members.length;
    }

    if (Array.isArray(chunk?.memberIds)) {
        return chunk.memberIds.length;
    }

    return 0;
}

function createProgress(
    state: GuildHydrationProgress["state"],
    pendingJobs: number,
    ownerId: string | null,
    guildId: string,
    startedAt: number,
    initialCount: number,
    finalCount: number,
    chunksSeen: number,
    timedOut = false,
    budgetReached = false,
): GuildHydrationProgress {
    return {
        guildId,
        ownerId,
        initialCount,
        finalCount,
        delta: finalCount - initialCount,
        chunksSeen,
        startedAt,
        finishedAt: Date.now(),
        timedOut,
        budgetReached,
        state,
        pendingJobs,
    };
}

function makeSnapshotKey(snapshot: GuildHydrationSnapshot) {
    return getJobKey(snapshot.ownerId, snapshot.guildId);
}

async function deleteSnapshot(ownerId: string | null, guildId: string) {
    const storageKey = getStorageKey(ownerId, guildId);
    snapshotCache.delete(getJobKey(ownerId, guildId));
    await DataStore.del(storageKey);
}

function cloneSnapshot(snapshot: GuildHydrationSnapshot): GuildHydrationSnapshot {
    return {
        ...snapshot,
        memberIds: Array.from(new Set(snapshot.memberIds.filter(Boolean))),
        cancelled: Boolean(snapshot.cancelled),
    };
}

function normalizeSnapshotRetention(snapshot: GuildHydrationSnapshot) {
    const normalized = cloneSnapshot(snapshot);
    const retentionBase = normalized.finishedAt || normalized.warmedAt || Date.now();
    const enforcedExpiresAt = retentionBase + DEFAULT_INDEX_TTL_MS;

    if (!Number.isFinite(normalized.expiresAt) || normalized.expiresAt < enforcedExpiresAt) {
        normalized.expiresAt = enforcedExpiresAt;
    }

    return normalized;
}

function isReusableSnapshot(snapshot: GuildHydrationSnapshot) {
    if (snapshot.cancelled || snapshot.timedOut) {
        return false;
    }

    return snapshot.chunksSeen > 0 || snapshot.finalCount > snapshot.initialCount;
}

async function loadSnapshot(ownerId: string | null, guildId: string) {
    if (!ownerId) return null;

    const cacheKey = getJobKey(ownerId, guildId);
    const cached = snapshotCache.get(cacheKey);
    if (cached) {
        if (cached.expiresAt > Date.now()) {
            if (isReusableSnapshot(cached)) {
                return cloneSnapshot(cached);
            }

            snapshotCache.delete(cacheKey);
            void DataStore.del(getStorageKey(ownerId, guildId));
            return null;
        }

        snapshotCache.delete(cacheKey);
        void DataStore.del(getStorageKey(ownerId, guildId));
        return null;
    }

    const stored = await DataStore.get(getStorageKey(ownerId, guildId)) as GuildHydrationSnapshot | undefined;
    if (!stored) return null;

    const normalized = normalizeSnapshotRetention(stored);
    if (normalized.expiresAt <= Date.now()) {
        void deleteSnapshot(ownerId, guildId);
        return null;
    }

    if (!isReusableSnapshot(normalized)) {
        void deleteSnapshot(ownerId, guildId);
        return null;
    }

    snapshotCache.set(cacheKey, normalized);
    if (normalized.expiresAt !== stored.expiresAt) {
        void DataStore.set(getStorageKey(ownerId, guildId), normalized);
    }
    return cloneSnapshot(normalized);
}

async function persistSnapshot(snapshot: GuildHydrationSnapshot) {
    if (!snapshot.ownerId) return;

    const normalized = normalizeSnapshotRetention(snapshot);
    snapshotCache.set(makeSnapshotKey(normalized), normalized);
    await DataStore.set(getStorageKey(normalized.ownerId, normalized.guildId), normalized);
}

async function enqueueHydration<T>(task: () => Promise<T>) {
    return await new Promise<T>((resolve, reject) => {
        queuedTasks.push(async () => {
            try {
                resolve(await task());
            } catch (error) {
                reject(error);
            }
        });

        if (!drainingQueue) {
            void drainHydrationQueue();
        }
    });
}

async function drainHydrationQueue() {
    drainingQueue = true;

    try {
        while (queuedTasks.length > 0) {
            const nextTask = queuedTasks.shift();
            if (!nextTask) continue;
            await nextTask();
        }
    } finally {
        drainingQueue = false;
    }
}

function getPendingJobs() {
    return queuedTasks.length + (drainingQueue ? 1 : 0);
}

export function createGuildHydrationController(): GuildHydrationController {
    const controller: GuildHydrationController = {
        cancelled: false,
        cancel() {
            controller.cancelled = true;
            activeControllers.delete(controller);
        },
    };

    activeControllers.add(controller);
    return controller;
}

export function cancelAllGuildHydrationControllers() {
    for (const controller of Array.from(activeControllers)) {
        controller.cancel();
    }
}

export function requestMembersById(guildId: string, userIds: string[], includePresences = false) {
    if (!userIds.length) return;

    if (typeof GuildActions?.requestMembersById === "function") {
        GuildActions.requestMembersById(guildId, userIds, includePresences);
        return;
    }

    FluxDispatcher.dispatch({
        type: "GUILD_MEMBERS_REQUEST",
        guildIds: [guildId],
        userIds,
        presences: includePresences,
    });
}

export async function getHydratedGuildSnapshot(ownerId: string | null, guildId: string) {
    return await loadSnapshot(ownerId, guildId);
}

export async function listHydratedGuildSnapshots(ownerId: string | null) {
    if (!ownerId) return [] as GuildHydrationSnapshot[];

    const prefix = getOwnerStoragePrefix(ownerId);
    const keys = await DataStore.keys<string>();
    const matchingKeys = keys.filter((key): key is string => typeof key === "string" && key.startsWith(prefix));
    const snapshots = await Promise.all(matchingKeys.map(async key => {
        const snapshot = await DataStore.get(key) as GuildHydrationSnapshot | undefined;
        return snapshot ? cloneSnapshot(snapshot) : null;
    }));

        const validSnapshots: GuildHydrationSnapshot[] = [];
    for (const snapshot of snapshots) {
        if (!snapshot) continue;
        const normalized = normalizeSnapshotRetention(snapshot);
        if (normalized.expiresAt <= Date.now()) {
            await deleteSnapshot(normalized.ownerId, normalized.guildId);
            continue;
        }

        if (!isReusableSnapshot(normalized)) {
            await deleteSnapshot(normalized.ownerId, normalized.guildId);
            continue;
        }

        snapshotCache.set(makeSnapshotKey(normalized), normalized);
        if (normalized.expiresAt !== snapshot.expiresAt) {
            await DataStore.set(getStorageKey(normalized.ownerId, normalized.guildId), normalized);
        }
        validSnapshots.push(normalized);
    }

    return validSnapshots.sort((left, right) => right.warmedAt - left.warmedAt);
}

export async function getHydratedGuildMemberIds(ownerId: string | null, guildId: string) {
    const liveIds = getMemberIdsFromStore(guildId);
    const snapshot = await loadSnapshot(ownerId, guildId);

    if (!snapshot) {
        return liveIds;
    }

    return Array.from(new Set([...snapshot.memberIds, ...liveIds]));
}

export async function clearHydratedGuildSnapshot(ownerId: string | null, guildId: string) {
    if (!ownerId) return;
    await deleteSnapshot(ownerId, guildId);
}

export async function clearHydratedGuildSnapshots(ownerId: string | null, guildIds?: string[]) {
    if (!ownerId) return;

    const targetGuildIds = guildIds?.length ? guildIds : (await listHydratedGuildSnapshots(ownerId)).map(snapshot => snapshot.guildId);
    await Promise.all(targetGuildIds.map(guildId => deleteSnapshot(ownerId, guildId)));
}

export async function hydrateGuildMemberCache(guildId: string, options: GuildHydrationOptions = {}) {
    const ownerId = options.ownerId ?? null;
    const cacheKey = getJobKey(ownerId, guildId);
    const existing = inFlightHydrations.get(cacheKey);
    if (existing) return existing;

    const promise = enqueueHydration(async () => {
        const { controller } = options;
        const startedAt = Date.now();
        const initialCount = getMemberCount(guildId);
        const maxWaitMs = options.maxWaitMs ?? 4000;
        const idleWindowMs = options.idleWindowMs ?? 1200;
        const pollIntervalMs = options.pollIntervalMs ?? 200;
        const ttlMs = options.ttlMs ?? DEFAULT_INDEX_TTL_MS;
        const targetCount = options.targetCount ?? null;
        const continueUntilTarget = options.continueUntilTarget === true && targetCount != null;
        const memberBudget = Math.max(0, options.memberBudget ?? 0);
        const freshSnapshot = options.forceRefresh ? null : await loadSnapshot(ownerId, guildId);
        let lastProgressAt = startedAt;
        let lastRequestAt = startedAt;
        let lastCount = initialCount;
        let chunksSeen = 0;
        let timedOut = false;
        let budgetReached = false;
        const queryQueue = [...WARMUP_QUERY_FANOUT];
        const queuedQueries = new Set(queryQueue);
        let stalledPasses = 0;
        let passBaselineCount = initialCount;
        let passBaselineChunks = 0;
        const activeProbes = new Map<string, {
            query: string;
            hits: number;
            sentAt: number;
            lastEventAt: number;
            expanded: boolean;
        }>();

        const buildSnapshot = (finishedAt = Date.now(), expiresAt = finishedAt + ttlMs) => {
            const finalCount = getMemberCount(guildId);

            return {
                guildId,
                ownerId,
                memberIds: getMemberIdsFromStore(guildId),
                initialCount,
                finalCount,
                delta: finalCount - initialCount,
                chunksSeen,
                warmedAt: startedAt,
                finishedAt,
                expiresAt,
                timedOut,
                budgetReached,
                cancelled: false,
            } satisfies GuildHydrationSnapshot;
        };

        if (freshSnapshot) {
            options.onProgress?.(createProgress(
                "cache",
                getPendingJobs(),
                ownerId,
                guildId,
                startedAt,
                freshSnapshot.initialCount,
                freshSnapshot.finalCount,
                freshSnapshot.chunksSeen,
                freshSnapshot.timedOut,
                freshSnapshot.budgetReached,
            ));

            return {
                ...freshSnapshot,
                source: "index",
                cancelled: false,
            } satisfies GuildHydrationResult;
        }

        if (controller?.cancelled) {
            const snapshot = buildSnapshot();
            await persistSnapshot(snapshot);
            activeControllers.delete(controller);
            options.onProgress?.(createProgress(
                "cancelled",
                getPendingJobs(),
                ownerId,
                guildId,
                startedAt,
                snapshot.initialCount,
                snapshot.finalCount,
                snapshot.chunksSeen,
                snapshot.timedOut,
                snapshot.budgetReached,
            ));
            return {
                ...snapshot,
                source: "cancelled",
                cancelled: true,
            } satisfies GuildHydrationResult;
        }

        const emitProgress = (state: GuildHydrationProgress["state"]) => {
            options.onProgress?.(createProgress(
                state,
                getPendingJobs(),
                ownerId,
                guildId,
                startedAt,
                initialCount,
                lastCount,
                chunksSeen,
                timedOut,
                budgetReached,
            ));
        };

        const enqueueProbeChildren = (query: string) => {
            if (!query || query.length >= WARMUP_QUERY_MAX_DEPTH) return;

            for (const char of WARMUP_QUERY_CHARS) {
                const nextQuery = `${query}${char}`;
                if (queuedQueries.has(nextQuery)) continue;
                queuedQueries.add(nextQuery);
                queryQueue.push(nextQuery);
            }
        };

        const dispatchWarmupRequest = (query = "", limit = query ? WARMUP_QUERY_LIMIT : 0) => {
            const requestTs = Date.now();
            const nonce = SnowflakeUtils.fromTimestamp(requestTs);
            lastRequestAt = requestTs;

            try {
                activeProbes.set(nonce, {
                    query,
                    hits: 0,
                    sentAt: requestTs,
                    lastEventAt: requestTs,
                    expanded: false,
                });

                if (!query && typeof GuildActions?.requestMembers === "function") {
                    GuildActions.requestMembers(guildId, query, limit, false);
                    return;
                }

                FluxDispatcher.dispatch({
                    type: "GUILD_MEMBERS_REQUEST",
                    guildId,
                    guildIds: [guildId],
                    query,
                    limit,
                    presences: false,
                    includePresences: false,
                    nonce,
                });
            } catch (error) {
                activeProbes.delete(nonce);
                logger.error(`Failed to dispatch warmup request for guild ${guildId}`, error);
            }
        };

        const dispatchNextWarmupProbe = () => {
            if (activeProbes.size > 0) {
                return false;
            }

            const query = queryQueue.shift();
            if (query == null) {
                return false;
            }

            dispatchWarmupRequest(query);
            return true;
        };

        const getFallbackProbe = () => {
            if (activeProbes.size !== 1) return null;
            return Array.from(activeProbes.values())[0] ?? null;
        };

        const updateProbeProgress = (event: GuildMembersChunkEvent, now: number) => {
            const nonce = getChunkNonce(event);
            const directProbe = nonce ? activeProbes.get(nonce) : null;
            const probe = directProbe ?? getFallbackProbe();
            if (!probe) return;

            probe.hits += getChunkMemberHitCount(event);
            probe.lastEventAt = now;

            if (!probe.expanded && probe.query && probe.hits >= WARMUP_QUERY_LIMIT) {
                enqueueProbeChildren(probe.query);
                probe.expanded = true;
            }
        };

        const trimFinishedProbes = (now: number) => {
            for (const [nonce, probe] of activeProbes) {
                if (now - probe.lastEventAt < idleWindowMs) continue;

                if (!probe.expanded && probe.query && probe.hits >= WARMUP_QUERY_LIMIT) {
                    enqueueProbeChildren(probe.query);
                    probe.expanded = true;
                }

                activeProbes.delete(nonce);
            }
        };

        const resetProbeQueue = () => {
            queryQueue.length = 0;
            queuedQueries.clear();

            for (const query of WARMUP_QUERY_FANOUT) {
                queryQueue.push(query);
                queuedQueries.add(query);
            }

            passBaselineCount = lastCount;
            passBaselineChunks = chunksSeen;
        };

        const updateCount = () => {
            const nextCount = getMemberCount(guildId);
            if (nextCount > lastCount) {
                lastCount = nextCount;
            }

            if (memberBudget > 0 && lastCount - initialCount >= memberBudget) {
                budgetReached = true;
            }
        };

        const onChunk = (event: GuildMembersChunkEvent) => {
            const chunkGuildId = getChunkGuildId(event);
            if (chunkGuildId && chunkGuildId !== guildId) return;

            updateProbeProgress(event, Date.now());

            chunksSeen++;
            lastProgressAt = Date.now();
            updateCount();
            emitProgress("running");
        };

        const onChunkBatch = (event: GuildMembersChunkBatchEvent) => {
            const chunks = Array.isArray(event?.chunks) ? event.chunks : [];
            const relevantChunks = chunks.filter(chunk => {
                const chunkGuildId = getChunkGuildId(chunk);
                return chunkGuildId == null || chunkGuildId === guildId;
            });
            if (!relevantChunks.length) return;

            const now = Date.now();
            for (const chunk of relevantChunks) {
                updateProbeProgress(chunk, now);
            }

            chunksSeen += relevantChunks.length;
            lastProgressAt = now;
            updateCount();
            emitProgress("running");
        };

        FluxDispatcher.subscribe("GUILD_MEMBERS_CHUNK", onChunk);
        FluxDispatcher.subscribe("GUILD_MEMBERS_CHUNK_BATCH", onChunkBatch);

        try {
            emitProgress("queued");
            dispatchNextWarmupProbe();

            emitProgress("running");

            while (true) {
                if (controller?.cancelled) {
                    const snapshot = { ...buildSnapshot(), cancelled: true };
                    await persistSnapshot(snapshot);
                    activeControllers.delete(controller);
                    emitProgress("cancelled");

                    return {
                        ...snapshot,
                        source: "cancelled",
                        cancelled: true,
                    } satisfies GuildHydrationResult;
                }

                await sleep(pollIntervalMs);

                const now = Date.now();
                trimFinishedProbes(now);
                const beforeUpdate = lastCount;
                updateCount();
                if (lastCount > beforeUpdate) {
                    lastProgressAt = now;
                    emitProgress("running");
                }

                if (budgetReached) {
                    break;
                }

                if (continueUntilTarget && targetCount != null && lastCount >= targetCount) {
                    break;
                }

                if (queryQueue.length > 0 && activeProbes.size === 0 && now - lastRequestAt >= 140) {
                    dispatchNextWarmupProbe();
                }

                if (maxWaitMs > 0 && now - startedAt >= maxWaitMs) {
                    timedOut = true;
                    break;
                }

                if (continueUntilTarget && targetCount != null && lastCount < targetCount && queryQueue.length === 0 && activeProbes.size === 0) {
                    const madeProgressThisPass = lastCount > passBaselineCount || chunksSeen > passBaselineChunks;
                    if (!madeProgressThisPass) {
                        stalledPasses += 1;
                        if (stalledPasses >= WARMUP_MAX_STALLED_PASSES) {
                            timedOut = true;
                            break;
                        }
                    } else {
                        stalledPasses = 0;
                    }

                    resetProbeQueue();
                    lastProgressAt = now;
                    continue;
                }

                if (queryQueue.length === 0 && activeProbes.size === 0 && (chunksSeen > 0 || lastCount > initialCount) && now - lastProgressAt >= idleWindowMs) {
                    break;
                }

                if (queryQueue.length === 0 && activeProbes.size === 0 && now - lastRequestAt >= idleWindowMs) {
                    break;
                }
            }
        } finally {
            FluxDispatcher.unsubscribe("GUILD_MEMBERS_CHUNK", onChunk);
            FluxDispatcher.unsubscribe("GUILD_MEMBERS_CHUNK_BATCH", onChunkBatch);
        }

        const finishedAt = Date.now();
        const snapshot = buildSnapshot(finishedAt);

        await persistSnapshot(snapshot);
        emitProgress("completed");

        if (controller) {
            activeControllers.delete(controller);
        }

        return {
            ...snapshot,
            source: "warmup",
            cancelled: false,
        } satisfies GuildHydrationResult;
    });

    inFlightHydrations.set(cacheKey, promise);

    try {
        return await promise;
    } finally {
        inFlightHydrations.delete(cacheKey);
    }
}

export async function hydrateGuildsSequentially(guildIds: string[], options: GuildHydrationOptions = {}) {
    const results: GuildHydrationResult[] = [];

    for (const guildId of guildIds) {
        results.push(await hydrateGuildMemberCache(guildId, options));

        if (options.controller?.cancelled) {
            break;
        }
    }

    return results;
}
