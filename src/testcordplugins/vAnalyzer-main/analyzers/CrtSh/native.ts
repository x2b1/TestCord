/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

export interface CrtShEntry {
    issuer_ca_id: number;
    issuer_name: string;
    common_name: string;
    name_value: string;
    id: number;
    entry_timestamp: string;
    not_before: string;
    not_after: string;
    serial_number: string;
}

export async function queryCrtSh(_: IpcMainInvokeEvent, domain: string): Promise<{ status: number; data: CrtShEntry[] | null; error?: string; }> {
    try {
        const res = await fetch(`https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`, {
            headers: {
                "accept": "application/json",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
            }
        });

        if (!res.ok) {
            return { status: res.status, data: null, error: `HTTP ${res.status}` };
        }

        const data: CrtShEntry[] = await res.json();
        return { status: 200, data };
    } catch (e) {
        return { status: -1, data: null, error: String(e) };
    }
}
