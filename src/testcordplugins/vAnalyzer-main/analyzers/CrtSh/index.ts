/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { PluginNative } from "@utils/types";
import { Toasts } from "@webpack/common";

import { AnalysisValue, extractDomain, safeToast } from "../../utils";

const Native = VencordNative.pluginHelpers.vAnalyzer as PluginNative<typeof import("./native")>;

export async function analyzeWithCrtSh(url: string, silent = false): Promise<AnalysisValue | null> {
    const domain = extractDomain(url);
    if (!silent) safeToast(`Checking certificates for ${domain}...`);

    const result = await Native.queryCrtSh(domain);

    if (result.status !== 200 || !result.data) {
        if (!silent) safeToast(`Certificate lookup failed: ${result.error ?? "unknown error"}`, Toasts.Type.FAILURE);
        return null;
    }

    const certs = result.data;
    const details: AnalysisValue["details"] = [];

    if (certs.length === 0) {
        details.push({ message: `No certificates for ${domain}`, type: "suspicious" });
        details.push({ message: "No CT log history", type: "suspicious" });
        return { details, timestamp: Date.now() };
    }

    const now = new Date();
    const validCerts = certs.filter(c => new Date(c.not_after) > now);

    const sortedByDate = [...certs].sort((a, b) =>
        new Date(a.not_before).getTime() - new Date(b.not_before).getTime()
    );
    const firstSeen = new Date(sortedByDate[0].not_before);
    const domainAgeDays = Math.floor((now.getTime() - firstSeen.getTime()) / (1000 * 60 * 60 * 24));

    const issuers = new Set(certs.map(c => c.issuer_name));

    let ageStr: string;
    if (domainAgeDays < 365) {
        ageStr = `${domainAgeDays}d`;
    } else {
        ageStr = `${Math.floor(domainAgeDays / 365)}y`;
    }

    let ageType: "malicious" | "suspicious" | "safe";
    if (domainAgeDays < 30 || validCerts.length === 0) {
        ageType = "malicious";
    } else if (domainAgeDays < 180) {
        ageType = "suspicious";
    } else {
        ageType = "safe";
    }

    details.push({
        message: `[crt.sh] Certs: ${certs.length} (${validCerts.length} valid). Age: ${ageStr}`,
        type: ageType
    });

    const issuerList = [...issuers];
    let issuerSuffix = "";
    if (issuerList.length > 2) {
        issuerSuffix = "...";
    }
    details.push({
        message: `[crt.sh] Issuers: ${issuerList.slice(0, 2).join(", ")}${issuerSuffix}`,
        type: "neutral"
    });

    if (!silent) safeToast(`${certs.length} cert(s) for ${domain}`, Toasts.Type.SUCCESS);
    return { details, timestamp: Date.now() };
}
