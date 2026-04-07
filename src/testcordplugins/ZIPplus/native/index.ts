/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

export async function fetchAttachment(_event: IpcMainInvokeEvent, url: string): Promise<Uint8Array | null> {
    try {
        if (!url) return null;

        const res = await fetch(url);
        if (!res.ok) return null;

        const arrayBuffer = await res.arrayBuffer();
        return new Uint8Array(arrayBuffer);
    } catch {
        return null;
    }
}

export function zipPreviewUniqueIdThingyIdkMan() { }
