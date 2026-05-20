/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { GuildMemberCountStore, GuildStore, React, Toasts } from "@webpack/common";

import {
    removeKamidereRuntimeTask,
    upsertKamidereRuntimeTask,
} from "../_kamidereCompat/runtimeActivity";
import {
    createGuildHydrationController,
    hydrateGuildMemberCache,
} from "./memberHydrator";
import { addMutualScannerRun } from "./store";
import type {
    MutualScannerConfig,
    MutualScannerController,
    MutualScannerExecutionResult,
    MutualScannerMatch,
    MutualScannerProgress,
    MutualScannerRun,
} from "./types";
import {
    createMutualScannerController,
    estimateScanRemainingMs,
    executeMutualScan,
    formatDurationMs,
    makeLocalId,
} from "./utils";

const SCAN_TASK_ID = "kamidere-mutual-scanner:scan";
const WARMUP_TASK_ID = "kamidere-mutual-scanner:warmup";

function showToast(message: string, type: typeof Toasts.Type[keyof typeof Toasts.Type]) {
    Toasts.show({
        message,
        type,
        id: Toasts.genId(),
        options: {
            position: Toasts.Position.BOTTOM,
        },
    });
}

function clampNumber(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function getGuildTargetCount(guildId: string) {
    return GuildMemberCountStore.getMemberCount(guildId)
        ?? (GuildStore.getGuild(guildId) as { memberCount?: number; } | undefined)?.memberCount
        ?? null;
}

export interface MutualScannerWarmupProgressState {
    guildId: string;
    guildLabel: string;
    guildIndex: number;
    totalGuilds: number;
    indexedCount: number;
    targetCount: number | null;
    remainingCount: number | null;
    delta: number;
    chunksSeen: number;
    state: "queued" | "running" | "completed" | "cancelled" | "cache" | "failed";
}

export interface MutualScannerRuntimeState {
    scan: {
        sessionId: string | null;
        active: boolean;
        startedAt: number | null;
        scopeLabel: string | null;
        requestDelayMs: number;
        progress: MutualScannerProgress | null;
        result: MutualScannerExecutionResult | null;
        matches: MutualScannerMatch[];
        revision: number;
    };
    warmup: {
        sessionId: string | null;
        active: boolean;
        startedAt: number | null;
        status: string | null;
        progress: MutualScannerWarmupProgressState | null;
        revision: number;
    };
}

const defaultState = (): MutualScannerRuntimeState => ({
    scan: {
        sessionId: null,
        active: false,
        startedAt: null,
        scopeLabel: null,
        requestDelayMs: 0,
        progress: null,
        result: null,
        matches: [],
        revision: 0,
    },
    warmup: {
        sessionId: null,
        active: false,
        startedAt: null,
        status: null,
        progress: null,
        revision: 0,
    },
});

let state = defaultState();
let scanController: MutualScannerController | null = null;
let warmupController: ReturnType<typeof createGuildHydrationController> | null = null;
const listeners = new Set<() => void>();

function notify() {
    listeners.forEach(listener => listener());
}

function getSnapshot() {
    return state;
}

function updateState(updater: (current: MutualScannerRuntimeState) => MutualScannerRuntimeState) {
    state = updater(state);
    notify();
}

function formatScanPhase(
    progress: MutualScannerProgress | null,
    scopeLabel: string | null,
    requestDelayMs: number,
    startedAt: number | null,
) {
    if (!progress) {
        return {
            subtitle: scopeLabel ?? "Preparing scan",
            detail: "Preparing candidates",
            progressCurrent: 0,
            progressTotal: null,
        };
    }

    const remainingMs = estimateScanRemainingMs(progress, startedAt, requestDelayMs);
    const etaDetail = remainingMs != null && progress.phase !== "warming" && progress.phase !== "collecting"
        ? remainingMs === 0
            ? "finishing now"
            : `~${formatDurationMs(remainingMs)} left`
        : null;

    if (progress.phase === "warming") {
        return {
            subtitle: progress.currentLabel ?? "Loading member cache",
            detail: "warming cache",
            progressCurrent: progress.scannedCount,
            progressTotal: progress.totalCandidates || null,
        };
    }

    if (progress.phase === "collecting") {
        return {
            subtitle: progress.currentLabel ?? "Collecting candidates",
            detail: progress.totalCandidates > 0 ? `${progress.totalCandidates} queued` : "collecting",
            progressCurrent: progress.scannedCount,
            progressTotal: progress.totalCandidates || null,
        };
    }

    if (progress.phase === "finishing") {
        return {
            subtitle: "Finalizing run",
            detail: etaDetail ?? `${progress.scannedCount}/${progress.totalCandidates || "?"}`,
            progressCurrent: progress.scannedCount,
            progressTotal: progress.totalCandidates || null,
        };
    }

    return {
        subtitle: progress.currentLabel ?? scopeLabel ?? "Scanning",
        detail: etaDetail ?? `${progress.scannedCount}/${progress.totalCandidates || "?"}`,
        progressCurrent: progress.scannedCount,
        progressTotal: progress.totalCandidates || null,
    };
}

function syncScanTask() {
    if (!state.scan.active) {
        removeKamidereRuntimeTask(SCAN_TASK_ID);
        return;
    }

    const view = formatScanPhase(
        state.scan.progress,
        state.scan.scopeLabel,
        state.scan.requestDelayMs,
        state.scan.startedAt,
    );
    upsertKamidereRuntimeTask({
        id: SCAN_TASK_ID,
        toolId: "mutual-scanner",
        name: "Mutual Scanner",
        status: "running",
        subtitle: view.subtitle,
        detail: view.detail,
        progressCurrent: view.progressCurrent,
        progressTotal: view.progressTotal,
        startedAt: state.scan.startedAt ?? Date.now(),
    });
}

function syncWarmupTask() {
    if (!state.warmup.active) {
        removeKamidereRuntimeTask(WARMUP_TASK_ID);
        return;
    }

    const { progress } = state.warmup;
    upsertKamidereRuntimeTask({
        id: WARMUP_TASK_ID,
        toolId: "manual-cache-warmup",
        name: "Manual Cache Warmup",
        status: "running",
        subtitle: progress?.guildLabel ?? state.warmup.status ?? "Hydrating selected servers",
        detail: progress?.targetCount != null
            ? `${progress.indexedCount}/${progress.targetCount}`
            : progress
                ? `${progress.indexedCount} indexed`
                : "warming",
        progressCurrent: progress?.indexedCount,
        progressTotal: progress?.targetCount ?? null,
        startedAt: state.warmup.startedAt ?? Date.now(),
    });
}

function finishScan(result: MutualScannerExecutionResult) {
    updateState(current => ({
        ...current,
        scan: {
            ...current.scan,
            active: false,
            result,
            progress: null,
            revision: current.scan.revision + 1,
        },
    }));
    removeKamidereRuntimeTask(SCAN_TASK_ID);
}

function finishWarmup() {
    updateState(current => ({
        ...current,
        warmup: {
            ...current.warmup,
            active: false,
            revision: current.warmup.revision + 1,
        },
    }));
    removeKamidereRuntimeTask(WARMUP_TASK_ID);
}

export function subscribeMutualScannerRuntime(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function useMutualScannerRuntimeState() {
    const [signal, forceUpdate] = React.useReducer(value => value + 1, 0);

    React.useEffect(() => subscribeMutualScannerRuntime(forceUpdate), []);

    return React.useMemo(() => getSnapshot(), [signal]);
}

export function cancelMutualScannerRuntime() {
    scanController?.cancel();
    warmupController?.cancel();
    removeKamidereRuntimeTask(SCAN_TASK_ID);
    removeKamidereRuntimeTask(WARMUP_TASK_ID);
}

export function resetMutualScannerRuntime() {
    cancelMutualScannerRuntime();
    scanController = null;
    warmupController = null;
    state = defaultState();
    notify();
}

export function cancelMutualScannerRun() {
    if (!scanController) return;
    scanController.cancel();
    showToast("Mutual scan cancellation requested.", Toasts.Type.MESSAGE);
}

export function cancelMutualScannerWarmup() {
    if (!warmupController) return;
    warmupController.cancel();
    showToast("Manual cache warmup cancellation requested.", Toasts.Type.MESSAGE);
}

export function startMutualScannerRun(ownerId: string | null, config: MutualScannerConfig) {
    if (!ownerId || state.scan.active) return false;
    if (config.selectedGuildIds.length === 0) return false;

    const normalizedConfig = {
        ...config,
        requestDelayMs: clampNumber(Number(config.requestDelayMs) || 0, 0, 5000),
        maxMembersPerGuild: clampNumber(Number(config.maxMembersPerGuild) || 0, 0, 50000),
        warmupMemberBudget: clampNumber(Number(config.warmupMemberBudget) || 0, 0, 100000),
    };
    const startedAt = Date.now();
    const scopeLabel = `${normalizedConfig.selectedGuildIds.length} server${normalizedConfig.selectedGuildIds.length === 1 ? "" : "s"} / any mutual`;
    const controller = createMutualScannerController();
    const sessionId = makeLocalId("mutual-runtime-scan");

    scanController = controller;
    updateState(current => ({
        ...current,
        scan: {
            sessionId,
            active: true,
            startedAt,
            scopeLabel,
            requestDelayMs: normalizedConfig.requestDelayMs,
            progress: {
                phase: "collecting",
                totalCandidates: 0,
                scannedCount: 0,
                matchedCount: 0,
                skippedBots: 0,
                skippedExistingFriends: 0,
                profileErrors: 0,
                countOnlyMatches: 0,
            },
            result: null,
            matches: [],
            revision: current.scan.revision,
        },
    }));
    syncScanTask();

    void (async () => {
        const result = await executeMutualScan(normalizedConfig, {
            ownerId,
            controller,
            onProgress: progress => {
                updateState(current => ({
                    ...current,
                    scan: {
                ...current.scan,
                requestDelayMs: normalizedConfig.requestDelayMs,
                progress: { ...progress },
            },
                }));
                syncScanTask();
            },
            onMatch: match => {
                updateState(current => ({
                    ...current,
                    scan: {
                        ...current.scan,
                        matches: current.scan.matches.some(existing => existing.userId === match.userId)
                            ? current.scan.matches
                            : [...current.scan.matches, match].sort((left, right) => left.label.localeCompare(right.label)),
                    },
                }));
                syncScanTask();
            },
        });

        const run: MutualScannerRun = {
            id: makeLocalId("mutual-run"),
            scopeLabel,
            startedAt,
            finishedAt: result.finishedAt,
            status: result.status,
            configSnapshot: normalizedConfig,
            stats: result.stats,
            matches: result.matches,
            error: result.error,
        };

        await addMutualScannerRun(ownerId, run);

        updateState(current => ({
            ...current,
            scan: {
                ...current.scan,
                matches: result.matches,
            },
        }));

        finishScan(result);
        scanController = null;

        if (result.status === "completed") {
            showToast(`Mutual scan finished with ${result.matches.length} match${result.matches.length === 1 ? "" : "es"}.`, Toasts.Type.SUCCESS);
        } else if (result.status === "cancelled") {
            showToast(`Mutual scan cancelled after ${result.stats.scannedCount} profile${result.stats.scannedCount === 1 ? "" : "s"}.`, Toasts.Type.MESSAGE);
        } else {
            showToast(result.error ?? "Mutual scan failed.", Toasts.Type.FAILURE);
        }
    })();

    return true;
}

export function startMutualScannerWarmup(
    ownerId: string | null,
    config: Pick<MutualScannerConfig, "selectedGuildIds" | "warmupMemberBudget" | "warmupTimeoutMs">,
) {
    if (!ownerId || state.warmup.active) return false;
    if (config.selectedGuildIds.length === 0) return false;

    const controller = createGuildHydrationController();
    const sessionId = makeLocalId("mutual-runtime-warmup");
    const targetGuildIds = [...config.selectedGuildIds];
    const memberBudget = clampNumber(Number(config.warmupMemberBudget) || 0, 0, 100000);
    const startedAt = Date.now();

    warmupController = controller;
    updateState(current => ({
        ...current,
        warmup: {
            sessionId,
            active: true,
            startedAt,
            status: `Queueing ${targetGuildIds.length} selected server${targetGuildIds.length === 1 ? "" : "s"} for cache hydration.`,
            progress: null,
            revision: current.warmup.revision,
        },
    }));
    syncWarmupTask();

    void (async () => {
        try {
            const results: Awaited<ReturnType<typeof hydrateGuildMemberCache>>[] = [];

            for (const [index, guildId] of targetGuildIds.entries()) {
                const targetCount = getGuildTargetCount(guildId);
                const result = await hydrateGuildMemberCache(guildId, {
                    ownerId,
                    forceRefresh: true,
                    maxWaitMs: targetCount != null ? 0 : clampNumber(Number(config.warmupTimeoutMs) || 4000, 500, 20000),
                    memberBudget,
                    targetCount,
                    continueUntilTarget: targetCount != null,
                    controller,
                    onProgress: progress => {
                        const guildLabel = GuildStore.getGuild(progress.guildId)?.name ?? progress.guildId;
                        const remainingCount = targetCount != null ? Math.max(targetCount - progress.finalCount, 0) : null;
                        const nextProgress: MutualScannerWarmupProgressState = {
                            guildId: progress.guildId,
                            guildLabel,
                            guildIndex: index + 1,
                            totalGuilds: targetGuildIds.length,
                            indexedCount: progress.finalCount,
                            targetCount,
                            remainingCount,
                            delta: progress.delta,
                            chunksSeen: progress.chunksSeen,
                            state: progress.state,
                        };

                        updateState(current => ({
                            ...current,
                            warmup: {
                                ...current.warmup,
                                status: targetCount != null
                                    ? `${guildLabel} / ${progress.finalCount}/${targetCount} indexed`
                                    : `${guildLabel} / ${progress.finalCount} indexed`,
                                progress: nextProgress,
                            },
                        }));
                        syncWarmupTask();
                    },
                });

                results.push(result);
                if (controller.cancelled) {
                    break;
                }
            }

            if (controller.cancelled) {
                updateState(current => ({
                    ...current,
                    warmup: {
                        ...current.warmup,
                        status: "Manual cache warmup cancelled.",
                        progress: current.warmup.progress ? { ...current.warmup.progress, state: "cancelled" } : current.warmup.progress,
                    },
                }));
                showToast("Manual cache warmup cancelled.", Toasts.Type.MESSAGE);
                return;
            }

            const completedGuilds = results.filter(result => !result.cancelled).length;
            const hydratedMembers = results.reduce((total, result) => total + Math.max(0, result.delta), 0);
            const meaningfulHydration = results.some(result => result.delta > 0 || result.chunksSeen > 0);
            const lastResult = results.at(-1);

            if (lastResult) {
                const targetCount = getGuildTargetCount(lastResult.guildId);
                updateState(current => ({
                    ...current,
                    warmup: {
                        ...current.warmup,
                        progress: {
                            guildId: lastResult.guildId,
                            guildLabel: GuildStore.getGuild(lastResult.guildId)?.name ?? lastResult.guildId,
                            guildIndex: completedGuilds,
                            totalGuilds: targetGuildIds.length,
                            indexedCount: lastResult.finalCount,
                            targetCount,
                            remainingCount: targetCount != null ? Math.max(targetCount - lastResult.finalCount, 0) : null,
                            delta: lastResult.delta,
                            chunksSeen: lastResult.chunksSeen,
                            state: meaningfulHydration ? "completed" : "failed",
                        },
                        status: meaningfulHydration
                            ? `Hydrated ${hydratedMembers} additional member${hydratedMembers === 1 ? "" : "s"} across ${completedGuilds} server${completedGuilds === 1 ? "" : "s"}.`
                            : "Discord did not return any additional member chunks for the selected servers.",
                    },
                }));
            }

            if (!meaningfulHydration) {
                showToast(
                    "Manual cache warmup finished without receiving any additional member chunks from Discord.",
                    Toasts.Type.FAILURE,
                );
            } else {
                showToast(
                    `Cache warmup finished for ${completedGuilds} server${completedGuilds === 1 ? "" : "s"} with ${hydratedMembers} additional member${hydratedMembers === 1 ? "" : "s"} hydrated.`,
                    Toasts.Type.SUCCESS,
                );
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Manual cache warmup failed.";
            updateState(current => ({
                ...current,
                warmup: {
                    ...current.warmup,
                    status: message,
                    progress: current.warmup.progress ? { ...current.warmup.progress, state: "failed" } : current.warmup.progress,
                },
            }));
            showToast(message, Toasts.Type.FAILURE);
        } finally {
            finishWarmup();
            warmupController = null;
        }
    })();

    return true;
}
