/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { settings as stalkerSettings } from "./index";

/**
 * Shared whitelist management for Stalker and StalkerV2
 * Both plugins use the same targets list from the original Stalker plugin
 */

export function getTargets(): string[] {
    if (!stalkerSettings.store.targets) return [];
    return stalkerSettings.store.targets.split(",").map(s => s.trim()).filter(Boolean);
}

export function addTarget(userId: string): void {
    const current = getTargets();
    if (!current.includes(userId)) {
        current.push(userId);
        stalkerSettings.store.targets = current.join(", ");
    }
}

export function removeTarget(userId: string): void {
    const current = getTargets();
    stalkerSettings.store.targets = current.filter(id => id !== userId).join(", ");
}

export function isTarget(userId: string): boolean {
    return getTargets().includes(userId);
}

export function setTargets(userIds: string[]): void {
    stalkerSettings.store.targets = userIds.join(", ");
}
// doesnt work so dont touch it lil bro
