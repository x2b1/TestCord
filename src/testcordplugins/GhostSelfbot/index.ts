/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { findByPropsLazy } from "@webpack";

const logger = new Logger("GhostSelfbot");

const Native = VencordNative.pluginHelpers.GhostSelfbot as PluginNative<typeof import("./native")>;

const TokenStore = findByPropsLazy("getToken");

export function getCurrentDiscordToken(): string | null {
    try {
        return TokenStore?.getToken?.() ?? null;
    } catch (error) {
        logger.error("Failed to extract Discord token:", error);
        return null;
    }
}

const settings = definePluginSettings({
    autoLaunch: {
        type: OptionType.BOOLEAN,
        description: "Automatically launch Ghost.exe when Discord starts",
        default: false
    },
    launchOnEnable: {
        type: OptionType.BOOLEAN,
        description: "Launch Ghost immediately when the plugin is enabled",
        default: true
    },
    launchMode: {
        type: OptionType.SELECT,
        description: "Choose whether to launch Ghost.exe or the source code",
        default: "exe",
        options: [
            { label: "Ghost.exe (Compiled)", value: "exe", default: true },
            { label: "Source Code (Python)", value: "source" }
        ]
    },
    autoInstallRequirements: {
        type: OptionType.BOOLEAN,
        description: "Automatically install Python requirements (requirements.txt) when launching source code",
        default: true
    },
    autoFillToken: {
        type: OptionType.BOOLEAN,
        description: "Automatically fill your current Discord token into Ghost config",
        default: false
    },
    showTokenWarning: {
        type: OptionType.BOOLEAN,
        description: "Show a warning about token security before launching",
        default: true
    },
    pythonPath: {
        type: OptionType.STRING,
        description: "Path to Python executable (required for source code mode)",
        default: "python",
        placeholder: "python or C:\\Python311\\python.exe"
    },
    nitroWebhookUrl: {
        type: OptionType.STRING,
        description: "Discord webhook URL for Nitro sniper notifications",
        default: "",
        placeholder: "https://discord.com/api/webhooks/..."
    },
    privnoteWebhookUrl: {
        type: OptionType.STRING,
        description: "Discord webhook URL for Privnote sniper notifications",
        default: "",
        placeholder: "https://discord.com/api/webhooks/..."
    },
    autoSetupWebhooks: {
        type: OptionType.BOOLEAN,
        description: "Tell Ghost to automatically create webhook channels on first launch",
        default: false
    }
});

function launchGhostExe(): void {
    try {
        const token = settings.store.autoFillToken ? getCurrentDiscordToken() : null;
        Native.launchGhostExe(
            settings.store.autoFillToken,
            token,
            settings.store.nitroWebhookUrl || "",
            settings.store.privnoteWebhookUrl || "",
            settings.store.autoSetupWebhooks
        );

        showNotification({
            title: "Ghost Selfbot",
            body: "Ghost.exe launched successfully",
            color: "#5865F2"
        });
    } catch (error: any) {
        logger.error("Failed to launch Ghost.exe:", error);
        showNotification({
            title: "Ghost Selfbot",
            body: error.message || "Failed to launch Ghost.exe",
            color: "#ED4245"
        });
    }
}

function launchGhostSource(): void {
    const pythonPath = settings.store.pythonPath || "python";

    try {
        const token = settings.store.autoFillToken ? getCurrentDiscordToken() : null;
        Native.launchGhostSource(
            settings.store.autoFillToken,
            settings.store.autoInstallRequirements,
            pythonPath,
            token,
            settings.store.nitroWebhookUrl || "",
            settings.store.privnoteWebhookUrl || "",
            settings.store.autoSetupWebhooks
        );

        showNotification({
            title: "Ghost Selfbot",
            body: "Ghost source code launched successfully",
            color: "#5865F2"
        });
    } catch (error: any) {
        logger.error("Failed to launch Ghost source:", error);
        showNotification({
            title: "Ghost Selfbot",
            body: error.message || "Failed to launch Ghost source. Check Python path.",
            color: "#ED4245"
        });
    }
}

export default definePlugin({
    name: "GhostSelfbot",
    description: "Launch Ghost Selfbot (exe or source code) with optional auto-token fill from your current Discord session",
    authors: [{ name: "irritably", id: 928787166916640838n }],
    tags: ["Utility", "Customisation"],
    enabledByDefault: false,
    settings,

    commands: [
        {
            name: "ghost",
            description: "Launch Ghost Selfbot",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: async (_args: any[], ctx: any) => {
                if (settings.store.showTokenWarning) {
                    const token = getCurrentDiscordToken();
                    if (token && settings.store.autoFillToken) {
                        sendBotMessage(ctx.channel.id, {
                            content: "⚠️ **Warning:** Your Discord token will be written to Ghost config files. Never share these files with anyone!\n\n👻 Launching Ghost Selfbot..."
                        });
                    }
                }

                if (settings.store.launchMode === "exe") {
                    launchGhostExe();
                } else {
                    launchGhostSource();
                }
            }
        },
        {
            name: "ghost-install",
            description: "Install Ghost Selfbot Python requirements manually",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: async (_args: any[], ctx: any) => {
                const pythonPath = settings.store.pythonPath || "python";

                sendBotMessage(ctx.channel.id, {
                    content: "📦 Installing Ghost Python requirements... This may take a moment."
                });

                if (await (Native as any).installRequirements(pythonPath)) {
                    sendBotMessage(ctx.channel.id, {
                        content: "✅ **Requirements installed successfully!** You can now launch Ghost from source code."
                    });
                } else {
                    sendBotMessage(ctx.channel.id, {
                        content: "❌ **Failed to install requirements.** Check the console for error details."
                    });
                }
            }
        },
        {
            name: "ghost-check",
            description: "Check Ghost Selfbot setup (Python, requirements, files)",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: async (_args: any[], ctx: any) => {
                const pythonPath = settings.store.pythonPath || "python";
                const status = await (Native as any).checkGhostSetup(pythonPath);

                let statusMessage = "🔍 **Ghost Selfbot Setup Check:**\n\n";

                statusMessage += (status as any).ghostExeFound
                    ? "✅ **Ghost.exe:** Found\n"
                    : "❌ **Ghost.exe:** Not found\n";

                statusMessage += (status as any).ghostSourceFound
                    ? "✅ **Source Code:** Found\n"
                    : "❌ **Source Code:** Not found\n";

                statusMessage += (status as any).pythonFound
                    ? `✅ **Python:** Found (${pythonPath})\n`
                    : `❌ **Python:** Not found at \`${pythonPath}\`\n`;

                statusMessage += (status as any).requirementsFound
                    ? "✅ **requirements.txt:** Found\n"
                    : "❌ **requirements.txt:** Not found\n";

                sendBotMessage(ctx.channel.id, { content: statusMessage });
            }
        }
    ],

    start() {
        logger.log("Ghost Selfbot plugin loaded.");
        logger.log("Commands available: /ghost, /ghost-install, /ghost-check");

        if (settings.store.launchOnEnable) {
            logger.log("Launching Ghost Selfbot immediately...");
            if (settings.store.launchMode === "exe") {
                launchGhostExe();
            } else {
                launchGhostSource();
            }
        }

        if (settings.store.autoLaunch) {
            setTimeout(() => {
                logger.log("Auto-launching Ghost Selfbot on startup...");
                if (settings.store.launchMode === "exe") {
                    launchGhostExe();
                } else {
                    launchGhostSource();
                }
            }, 5000);
        }
    },

    stop() {
        logger.log("Ghost Selfbot plugin stopped.");
    }
});
