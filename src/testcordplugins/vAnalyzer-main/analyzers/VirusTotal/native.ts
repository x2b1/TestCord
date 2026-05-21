/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createHash } from "crypto";
import { IpcMainInvokeEvent } from "electron";

function generateAntiAbuseHeader(): string {
    const inner = Buffer.from("dont be evil").toString("base64");
    const timestamp = Date.now() / 1000;
    return Buffer.from(`15520747703-${inner}-${timestamp}`).toString("base64");
}

export async function lookupVirusTotalFile(_: IpcMainInvokeEvent, fileUrl: string) {
    try {
        const fileResponse = await fetch(fileUrl);
        if (!fileResponse.ok) throw new Error(`Failed to fetch file: ${fileUrl}`);

        const buffer = Buffer.from(await fileResponse.arrayBuffer());
        const sha256 = createHash("sha256").update(buffer).digest("hex");

        const vtUrl = `https://www.virustotal.com/ui/files/${sha256}`;
        const res = await fetch(vtUrl, {
            headers: {
                "accept": "application/json",
                "accept-ianguage": "en-US,en;q=0.9",
                "accept-language": "en-US,en;q=0.9",
                "content-type": "application/json",
                "x-tool": "vt-ui-main",
                "x-app-version": "v1x554x2",
                "x-vt-anti-abuse-header": generateAntiAbuseHeader(),
                "referer": "https://www.virustotal.com/",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"
            }
        });

        if (!res.ok) {
            const errorBody = await res.text();
            return { status: res.status, data: null, sha256, errorBody };
        }

        const data = await res.json();
        return { status: 200, data, sha256 };
    } catch (e) {
        return { status: -1, data: String(e), sha256: null };
    }
}

export async function makeVirusTotalRequest(_: IpcMainInvokeEvent, apiKey: string, fileUrl: string) {
    try {
        const fileResponse = await fetch(fileUrl);
        if (!fileResponse.ok) throw new Error(`Failed to fetch file: ${fileUrl}`);

        const fileBlob = await fileResponse.blob();
        const file = new File([fileBlob], "uploaded-file", { type: fileBlob.type });

        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("https://www.virustotal.com/api/v3/files", {
            method: "POST",
            headers: { "x-apikey": apiKey },
            body: formData
        });

        const data = await res.json();
        return { status: res.status, data, analysisId: data?.data?.id };
    } catch (e) {
        return { status: -1, data: String(e) };
    }
}

export async function getVirusTotalFileReport(_: IpcMainInvokeEvent, apiKey: string, fileId: string) {
    try {
        const decodedString = Buffer.from(fileId, "base64").toString("utf-8");
        const md5 = decodedString.split(":")[0];

        const res = await fetch(`https://www.virustotal.com/api/v3/files/${md5}`, {
            headers: { "x-apikey": apiKey }
        });

        if (!res.ok) throw new Error(`Failed to fetch file report: ${res.statusText}`);

        const data = await res.json();
        return { status: res.status, data };
    } catch (e) {
        return { status: -1, data: String(e) };
    }
}
