/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface TestcordAdmin {
    name: string;
    id: bigint;
}

export const TestcordAdmins = Object.freeze({
    x2b: {
        name: "x2b",
        id: 996137713432530976n
    },
    mixiruriii: {
        name: "mixiruriii",
        id: 1467863852782850160n
    }
} satisfies Record<string, TestcordAdmin>);

// Lookup by ID for easy access
export const TestcordAdminsById = Object.freeze(Object.fromEntries(
    Object.entries(TestcordAdmins).map(([_, v]) => [v.id.toString(), v] as const)
)) as Record<string, TestcordAdmin>;

// Check if a user ID is a testcord admin
export function isTestcordAdmin(userId: string): boolean {
    return Object.hasOwn(TestcordAdminsById, userId);
}
