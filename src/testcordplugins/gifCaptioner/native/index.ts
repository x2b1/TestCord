/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

export async function fetchMedia(_event: IpcMainInvokeEvent, url: string) {
    try {
        if (!url) return null;

        const response = await fetch(url);
        if (!response.ok) return null;

        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        if (!data.length) return null;

        return {
            data,
            contentType: response.headers.get("content-type") ?? ""
        };
    } catch {
        return null;
    }
}

export function gifCaptionerUniqueIdThingyIdkMan() { }
