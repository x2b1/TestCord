/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface MutualScannerConfig {
    selectedGuildIds: string[];
    requestDelayMs: number;
    includeBots: boolean;
    skipExistingFriends: boolean;
    maxMembersPerGuild: number;
    warmMemberCacheBeforeScan: boolean;
    warmupTimeoutMs: number;
    warmupMemberBudget: number;
}

export interface MutualScannerMatch {
    userId: string;
    label: string;
    username?: string;
    details: string;
    avatarUrl: string;
    guildIds: string[];
    guildNames: string[];
    mutualFriendCount: number;
    mutualFriendLabels: string[];
    matchSource: "list" | "count";
    matchedAt: number;
    isExistingFriend: boolean;
    isBot: boolean;
}

export interface MutualScannerRunStats {
    guildCount: number;
    candidateCount: number;
    scannedCount: number;
    matchedCount: number;
    skippedBots: number;
    skippedExistingFriends: number;
    profileErrors: number;
    countOnlyMatches: number;
}

export type MutualScannerRunStatus = "completed" | "cancelled" | "failed";

export interface MutualScannerRun {
    id: string;
    scopeLabel: string;
    startedAt: number;
    finishedAt: number;
    status: MutualScannerRunStatus;
    configSnapshot: MutualScannerConfig;
    stats: MutualScannerRunStats;
    matches: MutualScannerMatch[];
    error?: string;
}

export interface MutualScannerData {
    config: MutualScannerConfig;
    runs: MutualScannerRun[];
}

export interface MutualScannerFriendOption {
    id: string;
    label: string;
    details: string;
    avatarUrl: string;
}

export interface MutualScannerGuildOption {
    id: string;
    label: string;
    memberCount: number;
    iconUrl?: string;
}

export interface MutualScannerProgress {
    phase: "warming" | "collecting" | "scanning" | "finishing";
    totalCandidates: number;
    scannedCount: number;
    matchedCount: number;
    skippedBots: number;
    skippedExistingFriends: number;
    profileErrors: number;
    countOnlyMatches: number;
    currentUserId?: string;
    currentLabel?: string;
}

export interface MutualScannerController {
    cancelled: boolean;
    cancel(): void;
}

export interface MutualScannerExecutionResult {
    status: MutualScannerRunStatus;
    finishedAt: number;
    stats: MutualScannerRunStats;
    matches: MutualScannerMatch[];
    error?: string;
}
