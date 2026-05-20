/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export type SendTrailPurgeTarget = "all" | "dms" | "servers";

function normalizeCommaList(value: string) {
    return Array.from(new Set(
        value
            .split(",")
            .map(part => part.trim())
            .filter(Boolean),
    )).join(",");
}

export function parseProtectedDmChannels(value: string) {
    return new Set(
        value
            .split(",")
            .map(part => part.trim())
            .filter(Boolean),
    );
}

export function parseProtectedDmUserIds(value: string) {
    return new Set(
        value
            .split(",")
            .map(part => part.trim())
            .filter(Boolean),
    );
}

export const settings = definePluginSettings({
    purgeTarget: {
        type: OptionType.SELECT,
        description: "Choose what Send Trail is allowed to purge.",
        default: "all" as SendTrailPurgeTarget,
        options: [
            { label: "Everything", value: "all", default: true },
            { label: "Direct Messages only", value: "dms" },
            { label: "Servers only", value: "servers" },
        ],
    },
    protectAllDms: {
        type: OptionType.BOOLEAN,
        description: "Never purge direct messages, even if they are selected.",
        default: false,
    },
    protectedDmChannels: {
        type: OptionType.STRING,
        description: "Protected direct-message channel ids.",
        default: "",
        hidden: true,
        onChange: normalizeCommaList,
    },
    protectedDmUserIds: {
        type: OptionType.STRING,
        description: "Protected direct-message user ids.",
        default: "",
        hidden: true,
        onChange: normalizeCommaList,
    },
});
