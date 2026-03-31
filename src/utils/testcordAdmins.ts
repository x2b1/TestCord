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
    x2b2: {
        name: "0gfm",
        id: 209389868080562176n
    },
    nnenaza: {
        name: "nnenaza",
        id: 1485706082080002140n
    },
    mixiruri: {
        name: "mixiruri",
        id: 1467863852782850160n
    },
    dxrx99: {
        name: "SirPhantom89",
        id: 1464279455844274188n // this vro got hacked so i need to change there his id to the new acc and also add a new record with his new name js so 2 plugins wont break.
    },
    SirPhantom89: {
        name: "SirPhantom89",
        id: 1464279455844274188n
    }
} satisfies Record<string, TestcordAdmin>);

export const TestcordOwners = Object.freeze({
    x2b: {
        name: "x2b",
        id: 996137713432530976n
    },
    nnenaza: {
        name: "nnenaza",
        id: 1485706082080002140n
    },
    mixiruri: {
        name: "mixiruri",
        id: 1467863852782850160n
    }
} satisfies Record<string, TestcordAdmin>);

export const TestcordDevelopers = Object.freeze({
    x2b: {
        name: "x2b",
        id: 996137713432530976n
    },
    x2b2: {
        name: "0gfm",
        id: 209389868080562176n
    },
    nnenaza: {
        name: "nnenaza",
        id: 1485706082080002140n
    },
    mixiruri: {
        name: "mixiruri",
        id: 1467863852782850160n
    },
    dxrx99: {
        name: "SirPhantom89",
        id: 1464279455844274188n
    },
    SirPhantom89: {
        name: "SirPhantom89",
        id: 1464279455844274188n
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

// btw fuck me for making such stupid mistakes.
