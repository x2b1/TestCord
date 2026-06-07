/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

export interface NativeWebhookResponse {
    status: number;
    data: string;
}

export async function sendWebhook(
    _: IpcMainInvokeEvent,
    webhookUrl: string,
    payload: string,
): Promise<NativeWebhookResponse> {
    try {
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
        });

        return {
            status: response.status,
            data: await response.text(),
        };
    } catch (error) {
        return {
            status: -1,
            data: error instanceof Error ? error.message : String(error),
        };
    }
}
