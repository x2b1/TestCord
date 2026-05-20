/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type PresenceLabIdentitySource = "current" | "resolved" | "manual";
export type PresenceLabSessionOutcome = "manual" | "simulated";

export interface PresenceLabConfig {
    entryDelaySeconds: number;
    jitterMinSeconds: number;
    jitterMaxSeconds: number;
    dwellMinutes: number;
    neutralProfile: boolean;
}

export interface PresenceLabIdentity {
    id: string;
    discordUserId: string;
    label: string;
    username?: string;
    details: string;
    avatarUrl: string;
    notes?: string;
    addedAt: number;
    source: PresenceLabIdentitySource;
}

export interface PresenceLabOperator extends PresenceLabIdentity {
    lastUsedAt?: number;
}

export interface PresenceLabTarget extends PresenceLabIdentity {
    trackingEnabled: boolean;
    lastSeenAt?: number;
}

export interface PresenceLabSession {
    id: string;
    operatorId: string;
    operatorLabel: string;
    operatorAvatarUrl: string;
    targetId: string;
    targetLabel: string;
    targetAvatarUrl: string;
    guildName: string;
    channelName: string;
    startedAt: number;
    durationMinutes: number;
    outcome: PresenceLabSessionOutcome;
    notes?: string;
}

export interface PresenceLabData {
    config: PresenceLabConfig;
    operators: PresenceLabOperator[];
    targets: PresenceLabTarget[];
    sessions: PresenceLabSession[];
}
