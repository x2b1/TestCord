/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

export async function lookupDangeCordProfile(_: IpcMainInvokeEvent, apiKey: string, memberId: string) {
    try {
        const vtUrl = `https://dangercord.com/api/v1/user/${memberId}`;
        const res = await fetch(vtUrl, {
            headers: {
                "Authorization": `Bearer ${apiKey}`,
            }
        });

        if (!res.ok) {
            const errorBody = await res.text();
            return { status: res.status, data: errorBody };
        }

        const data = await res.json();
        return { status: 200, data };
    } catch (e) {
        return { status: -1, data: String(e) };
    }
}