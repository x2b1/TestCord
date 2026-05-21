/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { PluginNative } from "@utils/types";
import { Toasts } from "@webpack/common";

import { AnalysisValue, extractDomain, safeToast } from "../../utils";

const Native = VencordNative.pluginHelpers.vAnalyzer as PluginNative<typeof import("./native")>;

export async function analyzeWithCertPL(url: string, silent = false): Promise<AnalysisValue | null> {
    const domain = extractDomain(url);
    if (!silent) safeToast(`Checking ${domain} against CERT.PL blocklist...`);

    const result = await Native.queryCertPL(domain);

    if (result.error) {
        if (!silent) safeToast(`CERT.PL lookup failed: ${result.error}`, Toasts.Type.FAILURE);
        return null;
    }

    const details: AnalysisValue["details"] = [];

    if (result.found) {
        details.push({ message: `[CertPL] [SCAM] ${domain} found in blocklist`, type: "malicious" });
    } else {
        details.push({ message: `[CertPL] ${domain} not in blocklist`, type: "safe" });
    }

    if (!silent) {
        if (result.found) {
            safeToast(`WARNING: ${domain} is on CERT.PL blocklist!`, Toasts.Type.FAILURE);
        } else {
            safeToast(`${domain} not found in CERT.PL blocklist`, Toasts.Type.SUCCESS);
        }
    }

    return { details, timestamp: Date.now() };
}
