/*
 * Nightcord, a Discord client mod
 * Copyright (c) 2025 Nightcord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { moment, useEffect, useReducer } from "@webpack/common";

// ─── Settings ────────────────────────────────────────────────────────────────

const settings = definePluginSettings({
    format: {
        type: OptionType.SELECT,
        description: "Seconds format displayed on every message timestamp",
        default: "HH:mm:ss",
        options: [
            { label: "15:34:21  (24h)", value: "HH:mm:ss", default: true },
            { label: "3:34:21 PM  (12h)", value: "h:mm:ss A" },
        ],
    },
    showInTooltip: {
        type: OptionType.BOOLEAN,
        description: "Show seconds in the hover tooltip",
        default: true,
    },
    showInCompact: {
        type: OptionType.BOOLEAN,
        description: "Show seconds in compact mode",
        default: true,
    },
});

// ─── Tick hook — forces a re-render every second ─────────────────────────────

function useSecondTick() {
    const [, tick] = useReducer((n: number) => n + 1, 0);
    useEffect(() => {
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);
}

// ─── Renderers called by the patches ─────────────────────────────────────────

function renderTimestamp(date: Date, type: "cozy" | "compact" | "tooltip"): string {
    // Hook must be called unconditionally — React requires this
    useSecondTick();

    const fmt = settings.store.format ?? "HH:mm:ss";

    switch (type) {
        case "cozy":
            // Cozy mode: replace the default "Today at HH:mm" with seconds
            return moment(date).format(fmt);
        case "compact":
            // Compact mode (grouped message line): show seconds if enabled
            return settings.store.showInCompact
                ? moment(date).format(fmt)
                : moment(date).format("LT");
        case "tooltip":
            // Tooltip on hover: full date + seconds
            return settings.store.showInTooltip
                ? moment(date).format(`dddd, MMMM D, YYYY [at] ${fmt}`)
                : moment(date).format("LLLL");
    }
}

// ─── Plugin ──────────────────────────────────────────────────────────────────

export default definePlugin({
    name: "RealtimeTimestamps",
    description: "Replaces Discord timestamps (e.g. 15:31) with live seconds (e.g. 15:34:21), updated every second.",
    tags: ["Appearance", "Chat", "Utility"],
    authors: [{ name: "Nightcord", id: 253979869n }],
    enabledByDefault: true,
    settings,

    renderTimestamp,

    patches: [
        // ─── Main Timestamp component (cozy + compact messages + hover tooltip) ─
        {
            find: "#{intl::MESSAGE_EDITED_TIMESTAMP_A11Y_LABEL}",
            replacement: [
                {
                    // Compact mode: the useMemo that formats with "LT"
                    match: /(\i\.useMemo\(.{0,50}"LT".{0,30}\]\))/,
                    replace: "$self.renderTimestamp(arguments[0].timestamp,'compact')",
                },
                {
                    // Cozy mode: the useMemo that calls the calendar/relative formatter
                    match: /(\i\.useMemo\(.{0,10}\i\.\i\)\(.{0,10}\]\))/,
                    replace: "$self.renderTimestamp(arguments[0].timestamp,'cozy')",
                },
                {
                    // Tooltip shown when hovering a message timestamp
                    match: /(__unsupportedReactNodeAsText:).{0,25}"LLLL"\)/,
                    replace: "$1$self.renderTimestamp(arguments[0].timestamp,'tooltip')",
                },
            ],
        },

        // ─── Timestamp markdown <t:unix:t> — hover tooltip ────────────────────
        {
            find: /.full,.{0,15}children:/,
            replacement: {
                match: /(__unsupportedReactNodeAsText:)\i\.full/,
                replace: "$1$self.renderTimestamp(new Date(arguments[0].node.timestamp*1000),'tooltip')",
            },
        },
    ],
});
