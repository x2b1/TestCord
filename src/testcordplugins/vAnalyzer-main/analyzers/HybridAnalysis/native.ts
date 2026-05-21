/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createHash } from "crypto";
import { IpcMainInvokeEvent } from "electron";

const BASE_URL = "https://hybrid-analysis.com/api/v2";

export async function hybridAnalysisSearchHash(_: IpcMainInvokeEvent, apiKey: string, hash: string) {
    try {
        const res = await fetch(`${BASE_URL}/search/hash?hash=${encodeURIComponent(hash)}`, {
            headers: {
                "api-key": apiKey,
                "accept": "application/json"
            }
        });

        if (!res.ok) {
            const body = await res.text().catch(() => "");
            return { status: res.status, data: null, error: `HTTP ${res.status}: ${body}` };
        }

        const data = await res.json();
        return { status: 200, data };
    } catch (e) {
        return { status: -1, data: null, error: String(e) };
    }
}

export async function hybridAnalysisHashFile(_: IpcMainInvokeEvent, fileUrl: string) {
    try {
        const fileResponse = await fetch(fileUrl);
        if (!fileResponse.ok) throw new Error(`Failed to fetch file: ${fileUrl}`);

        const buffer = Buffer.from(await fileResponse.arrayBuffer());
        const sha256 = createHash("sha256").update(buffer).digest("hex");
        return { sha256 };
    } catch (e) {
        return { sha256: null, error: String(e) };
    }
}

export async function hybridAnalysisQuickScanUrl(_: IpcMainInvokeEvent, apiKey: string, url: string) {
    try {
        const formData = new FormData();
        formData.append("scan_type", "all");
        formData.append("url", url);

        const res = await fetch(`${BASE_URL}/quick-scan/url`, {
            method: "POST",
            headers: {
                "api-key": apiKey,
                "accept": "application/json"
            },
            body: formData
        });

        if (!res.ok) {
            const body = await res.text().catch(() => "");
            return { status: res.status, data: null, error: `HTTP ${res.status}: ${body}` };
        }

        const data = await res.json();
        return { status: 200, data };
    } catch (e) {
        return { status: -1, data: null, error: String(e) };
    }
}

export async function hybridAnalysisGetScan(_: IpcMainInvokeEvent, apiKey: string, scanId: string) {
    try {
        const res = await fetch(`${BASE_URL}/quick-scan/${scanId}`, {
            headers: {
                "api-key": apiKey,
                "accept": "application/json"
            }
        });

        if (!res.ok) {
            const body = await res.text().catch(() => "");
            return { status: res.status, data: null, error: `HTTP ${res.status}: ${body}` };
        }

        const data = await res.json();
        return { status: 200, data };
    } catch (e) {
        return { status: -1, data: null, error: String(e) };
    }
}

export async function hybridAnalysisQuickScanFile(_: IpcMainInvokeEvent, apiKey: string, fileUrl: string, fileName: string) {
    try {
        const fileResponse = await fetch(fileUrl);
        if (!fileResponse.ok) throw new Error(`Failed to fetch file: ${fileUrl}`);

        const fileBlob = await fileResponse.blob();
        const file = new File([fileBlob], fileName || "uploaded-file", { type: fileBlob.type });

        const formData = new FormData();
        formData.append("scan_type", "all");
        formData.append("file", file);

        const res = await fetch(`${BASE_URL}/quick-scan/file`, {
            method: "POST",
            headers: {
                "api-key": apiKey,
                "accept": "application/json"
            },
            body: formData
        });

        if (!res.ok) {
            const body = await res.text().catch(() => "");
            return { status: res.status, data: null, error: `HTTP ${res.status}: ${body}` };
        }

        const data = await res.json();
        return { status: 200, data };
    } catch (e) {
        return { status: -1, data: null, error: String(e) };
    }
}
