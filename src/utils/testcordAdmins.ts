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
    },
    dxrx99: {
        name: "dxrx99",
        id: 1463629522359423152n
    }
} satisfies Record<string, TestcordAdmin>);

export const TestcordOwners = Object.freeze({
    x2b: {
        name: "x2b",
        id: 996137713432530976n
    },
    mixiruriii: {
        name: "mixiruriii",
        id: 1467863852782850160n
    }
} satisfies Record<string, TestcordAdmin>);

export const TestcordDevelopers = Object.freeze({
    x2b: {
        name: "x2b",
        id: 996137713432530976n
    },
    mixiruriii: {
        name: "mixiruriii",
        id: 1467863852782850160n
    },
    dxrx99: {
        name: "dxrx99",
        id: 1463629522359423152n
    }
} satisfies Record<string, TestcordAdmin>);

// Lookup by ID for easy access
export const TestcordAdminsById = Object.freeze(Object.fromEntries(
    Object.entries(TestcordAdmins).map(([_, v]) => [v.id.toString(), v] as const)
)) as Record<string, TestcordAdmin>;

export const TestcordOwnersById = Object.freeze(Object.fromEntries(
    Object.entries(TestcordOwners).map(([_, v]) => [v.id.toString(), v] as const)
)) as Record<string, TestcordAdmin>;

export const TestcordDevelopersById = Object.freeze(Object.fromEntries(
    Object.entries(TestcordDevelopers).map(([_, v]) => [v.id.toString(), v] as const)
)) as Record<string, TestcordAdmin>;

// Check if a user ID is a testcord admin
export function isTestcordAdmin(userId: string): boolean {
    return Object.hasOwn(TestcordAdminsById, userId);
}

// Check if a user ID is a testcord owner
export function isTestcordOwner(userId: string): boolean {
    return Object.hasOwn(TestcordOwnersById, userId);
}

// Check if a user ID is a testcord developer
export function isTestcordDeveloper(userId: string): boolean {
    return Object.hasOwn(TestcordDevelopersById, userId);
}
