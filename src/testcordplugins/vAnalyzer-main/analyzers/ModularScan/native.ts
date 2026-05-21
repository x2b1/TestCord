/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

export interface ModularScanModule {
    name: string;
    type: "file" | "url";
    method: string;
    url: string;
    headers: Record<string, string>;
    bodyType: "multipart" | "json" | "none";
    fileField: string;
    extraFields: Record<string, string>;
    jsonTemplate: string;
    autoScan: boolean;
    filter: { type: "none" | "contains" | "regex"; pattern: string; };
}

function replacePlaceholders(template: string, vars: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
        result = result.replaceAll(`{{${key}}}`, value);
    }
    return result;
}

export async function executeModularScan(
    _: IpcMainInvokeEvent,
    module: ModularScanModule,
    fileUrl: string,
    fileName: string
) {
    try {
        const vars: Record<string, string> = {
            fileUrl,
            fileName,
            url: fileUrl,
        };

        const targetUrl = replacePlaceholders(module.url, vars);

        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(module.headers)) {
            headers[replacePlaceholders(k, vars)] = replacePlaceholders(v, vars);
        }

        let body: any = undefined;

        if (module.bodyType === "multipart") {
            const formData = new FormData();

            if (module.type === "file" && module.fileField) {
                const fileResponse = await fetch(fileUrl);
                if (!fileResponse.ok) throw new Error(`Failed to fetch file: ${fileUrl}`);
                const fileBlob = await fileResponse.blob();
                const file = new File([fileBlob], fileName || "file", { type: fileBlob.type });
                formData.append(module.fileField, file);
            }

            for (const [k, v] of Object.entries(module.extraFields)) {
                formData.append(replacePlaceholders(k, vars), replacePlaceholders(v, vars));
            }

            body = formData;
        } else if (module.bodyType === "json") {
            body = replacePlaceholders(module.jsonTemplate, vars);
            if (!headers["content-type"] && !headers["Content-Type"]) {
                headers["content-type"] = "application/json";
            }
        }

        const res = await fetch(targetUrl, {
            method: module.method,
            headers: module.bodyType === "multipart"
                ? Object.fromEntries(Object.entries(headers).filter(([k]) => k.toLowerCase() !== "content-type"))
                : headers,
            body
        });

        const responseText = await res.text();

        let responseJson = null;
        try { responseJson = JSON.parse(responseText); } catch { }

        return {
            status: res.status,
            ok: res.ok,
            body: responseText,
            json: responseJson
        };
    } catch (e) {
        return { status: -1, ok: false, body: String(e), json: null };
    }
}
