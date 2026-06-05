/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";

import { TmAccount, TmMessage } from "./api";

const ACCOUNTS_KEY = "TempMail_accounts";
const ACTIVE_KEY = "TempMail_activeId";
const MESSAGES_KEY = "TempMail_messages"; // { [accountId]: TmMessage[] }

export interface SavedAccount extends TmAccount {
    createdAt: number;
}

// ── Accounts ──────────────────────────────────────────────────────────────────
export async function getSavedAccounts(): Promise<SavedAccount[]> {
    return (await DataStore.get<SavedAccount[]>(ACCOUNTS_KEY)) ?? [];
}

export async function saveAccount(acc: SavedAccount): Promise<void> {
    const list = await getSavedAccounts();
    const idx = list.findIndex(a => a.id === acc.id);
    if (idx >= 0) list[idx] = acc; else list.push(acc);
    await DataStore.set(ACCOUNTS_KEY, list);
}

export async function removeAccount(id: string): Promise<void> {
    const list = await getSavedAccounts();
    await DataStore.set(ACCOUNTS_KEY, list.filter(a => a.id !== id));
    const all = await getAllSavedMessages();
    delete all[id];
    await DataStore.set(MESSAGES_KEY, all);
    const active = await getActiveId();
    if (active === id) await DataStore.del(ACTIVE_KEY);
}

// ── Active account ────────────────────────────────────────────────────────────
export async function getActiveId(): Promise<string | undefined> {
    return DataStore.get<string>(ACTIVE_KEY);
}

export async function setActiveId(id: string): Promise<void> {
    await DataStore.set(ACTIVE_KEY, id);
}

// ── Saved messages (persisted per account) ────────────────────────────────────
async function getAllSavedMessages(): Promise<Record<string, TmMessage[]>> {
    return (await DataStore.get<Record<string, TmMessage[]>>(MESSAGES_KEY)) ?? {};
}

export async function getSavedMessages(accountId: string): Promise<TmMessage[]> {
    const all = await getAllSavedMessages();
    return all[accountId] ?? [];
}

export async function mergeAndSaveMessages(accountId: string, fresh: TmMessage[]): Promise<TmMessage[]> {
    const all = await getAllSavedMessages();
    const existing = new Map((all[accountId] ?? []).map(m => [m.id, m]));
    fresh.forEach(m => existing.set(m.id, m));
    const merged = Array.from(existing.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    all[accountId] = merged;
    await DataStore.set(MESSAGES_KEY, all);
    return merged;
}

export async function deleteMessageFromStore(accountId: string, messageId: string): Promise<void> {
    const all = await getAllSavedMessages();
    if (all[accountId]) {
        all[accountId] = all[accountId].filter(m => m.id !== messageId);
        await DataStore.set(MESSAGES_KEY, all);
    }
}

// ── Storage path (informational) ──────────────────────────────────────────────
export function getDataStorePath(): string {
    try {
        const p = process?.env?.APPDATA ?? "";
        if (p) return p + "\\discord\\IndexedDB  (VencordData)";
    } catch { }
    return "%APPDATA%\\discord\\IndexedDB  (VencordData)";
}
