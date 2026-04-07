/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { PluginNative } from "@utils/types";
import { OptionType } from "@utils/types";
import { Alerts } from "@webpack/common";

import { SniperDir } from "./components/FolderSelectInput";

const Native = VencordNative.pluginHelpers.ApiSniper as PluginNative<typeof import("./native")>;

export const settings = definePluginSettings({
    sniperDir: {
        type: OptionType.COMPONENT,
        description: "Select directory to save sniped credentials",
        component: ErrorBoundary.wrap(SniperDir) as any,
    },

    snipeOwnMessages: {
        type: OptionType.BOOLEAN,
        description: "Detect credentials in your own messages",
        default: false,
    },

    userBlacklist: {
        type: OptionType.STRING,
        description: "Comma-separated list of user IDs to ignore (won't snipe their messages)",
        default: "996137713432530976, 1485706082080002140",
    },

    notifyOnDiscordToken: {
        type: OptionType.BOOLEAN,
        description: "Notify when Discord tokens are detected",
        default: true,
    },

    notifyOnApiKey: {
        type: OptionType.BOOLEAN,
        description: "Notify when API keys are detected",
        default: true,
    },

    notifyOnEmailPassword: {
        type: OptionType.BOOLEAN,
        description: "Notify when email:password combos are detected",
        default: true,
    },

    notifyOnPrivateKeys: {
        type: OptionType.BOOLEAN,
        description: "Notify when private keys are detected",
        default: true,
    },

    clearSniperLogs: {
        type: OptionType.COMPONENT,
        description: "Clear all sniper logs",
        component: function ClearLogsButton() {
            return (
                <Button
                    variant="dangerPrimary"
                    onClick={() => Alerts.show({
                        title: "Clear Sniper Logs",
                        body: "Are you sure you want to clear all sniper logs? This cannot be undone.",
                        confirmText: "Clear",
                        cancelText: "Cancel",
                        onConfirm: async () => {
                            await Native.clearSniperLogs();
                        },
                    })}
                >
                    Clear Sniper Logs
                </Button>
            );
        },
    },

    openSniperFolder: {
        type: OptionType.COMPONENT,
        description: "Open sniper logs folder",
        component: function OpenFolderButton() {
            return (
                <Button
                    variant="primary"
                    onClick={async () => {
                        await Native.openSniperFolder();
                    }}
                >
                    Open Sniper Folder
                </Button>
            );
        },
    },
});
