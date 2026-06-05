/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const BASE = "https://api.mail.tm";

export interface TmAccount {
    id: string;
    address: string;
    token: string;
}

export interface TmMessage {
    id: string;
    from: { address: string; name: string; };
    subject: string;
    intro: string;
    createdAt: string;
    seen: boolean;
}

export interface TmMessageFull extends TmMessage {
    html: string[];
    text: string;
}

export interface TmDomain {
    id: string;
    domain: string;
    isActive: boolean;
}

// ── Domain helpers ────────────────────────────────────────────────────────────
export async function getDomains(): Promise<TmDomain[]> {
    const r = await fetch(`${BASE}/domains?page=1`);
    const data = await r.json();
    return data["hydra:member"] ?? [];
}

// ── Account ───────────────────────────────────────────────────────────────────
export async function createAccount(address: string, password: string): Promise<{ id: string; address: string; }> {
    const r = await fetch(`${BASE}/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, password }),
    });
    if (!r.ok) throw new Error(`Failed to create account: ${r.status}`);
    return r.json();
}

export async function getToken(address: string, password: string): Promise<string> {
    const r = await fetch(`${BASE}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, password }),
    });
    if (!r.ok) throw new Error(`Failed to get token: ${r.status}`);
    const data = await r.json();
    return data.token;
}

export async function deleteAccount(id: string, token: string): Promise<void> {
    await fetch(`${BASE}/accounts/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    });
}

// ── Messages ──────────────────────────────────────────────────────────────────
export async function getMessages(token: string, page = 1): Promise<TmMessage[]> {
    const r = await fetch(`${BASE}/messages?page=${page}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error(`Failed to fetch messages: ${r.status}`);
    const data = await r.json();
    return data["hydra:member"] ?? [];
}

export async function getMessage(id: string, token: string): Promise<TmMessageFull> {
    const r = await fetch(`${BASE}/messages/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error(`Failed to fetch message: ${r.status}`);
    return r.json();
}

export async function deleteMessage(id: string, token: string): Promise<void> {
    await fetch(`${BASE}/messages/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    });
}

// ── Utility ───────────────────────────────────────────────────────────────────
export function randomString(len = 10): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
