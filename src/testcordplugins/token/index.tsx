/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import { definePluginSettings } from "@api/Settings";

const DevsUnknown = { name: "Unknown", id: 0n };
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";

const UserStore = findByPropsLazy("getCurrentUser", "getUser");

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Enable /mytoken command",
        default: true
    },
    showInDMs: {
        type: OptionType.BOOLEAN,
        description: "Allow usage in DMs",
        default: true
    }
});

export default definePlugin({
    name: "Token Display",
    description: "Displays the token of the currently logged-in account with the /mytoken command",
    authors: [DevsUnknown],
    dependencies: ["CommandsAPI"],

    settings,

    start() {
        console.log("[Token Display] Plugin started - /mytoken command available");
    },

    stop() {
        console.log("[Token Display] Plugin stopped");
    },

    commands: [
        {
            name: "mytoken",
            description: "Displays the token of the currently logged-in account",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [],
            execute: async (opts, ctx) => {
                console.log("[Token Display] /mytoken command executed");

                if (!settings.store.enabled) {
                    console.log("[Token Display] Command disabled in settings");
                    sendBotMessage(ctx.channel.id, {
                        content: "❌ This command is disabled in the settings."
                    });
                    return;
                }

                // Check if in DM and if allowed
                if (!ctx.guild && !settings.store.showInDMs) {
                    console.log("[Token Display] Command not allowed in DMs");
                    sendBotMessage(ctx.channel.id, {
                        content: "❌ This command is not allowed in private messages."
                    });
                    return;
                }

                try {
                    console.log("[Token Display] Attempting to retrieve token...");

                    // Retrieve the token
                    const token = getCurrentToken();

                    if (!token) {
                        console.log("[Token Display] No token found");
                        sendBotMessage(ctx.channel.id, {
                            content: "❌ Unable to retrieve token. Make sure you're connected."
                        });
                        return;
                    }

                    console.log("[Token Display] Token retrieved successfully");

                    // Retrieve current user information
                    const currentUser = UserStore.getCurrentUser();
                    const username = currentUser ? `${currentUser.username}#${currentUser.discriminator}` : "Unknown user";

                    sendBotMessage(ctx.channel.id, {
                        content: `🔑 **Account token for ${username}:**\n\`\`\`\n${token}\n\`\`\`\n⚠️ **Warning:** Never share your token with other people!`
                    });
                } catch (error) {
                    console.error("[Token Display] Error retrieving token:", error);
                    sendBotMessage(ctx.channel.id, {
                        content: "❌ An error occurred while retrieving the token."
                    });
                }
            }
        }
    ]
});

function getCurrentToken(): string | null {
    console.log("[Token Display] Starting token retrieval");

    try {
        // Method 1: Try to retrieve token from localStorage (if available)
        if (typeof window !== "undefined" && window.localStorage) {
            console.log("[Token Display] Attempt via localStorage");
            const token = window.localStorage.getItem("token");
            if (token) {
                console.log("[Token Display] Token found in localStorage");
                // Clean the token (remove quotes if present)
                return token.replace(/^"(.*)"$/, "$1");
            }
        }

        // Method 2: Try to retrieve token via webpack modules
        if (typeof window !== "undefined" && window.webpackChunkdiscord_app) {
            console.log("[Token Display] Attempt via webpack modules");
            const modules = window.webpackChunkdiscord_app;
            for (const chunk of modules) {
                if (chunk[1]) {
                    for (const moduleId in chunk[1]) {
                        const module = chunk[1][moduleId];
                        if (module && module.exports) {
                            // Look for getToken methods
                            if (module.exports.getToken && typeof module.exports.getToken === "function") {
                                try {
                                    const token = module.exports.getToken();
                                    if (token && typeof token === "string") {
                                        console.log("[Token Display] Token found via webpack getToken");
                                        return token;
                                    }
                                } catch (e) {
                                    // Ignore errors
                                }
                            }

                            // Look in default exports
                            if (module.exports.default && module.exports.default.getToken) {
                                try {
                                    const token = module.exports.default.getToken();
                                    if (token && typeof token === "string") {
                                        console.log("[Token Display] Token found via webpack default.getToken");
                                        return token;
                                    }
                                } catch (e) {
                                    // Ignore errors
                                }
                            }
                        }
                    }
                }
            }
        }

        // Method 3: Try to retrieve token via Discord API
        try {
            console.log("[Token Display] Attempt via findByPropsLazy");
            // Look in Vencord modules for token retrieval methods
            const { getToken } = findByPropsLazy("getToken");
            if (getToken && typeof getToken === "function") {
                const token = getToken();
                if (token && typeof token === "string") {
                    console.log("[Token Display] Token found via findByPropsLazy");
                    return token;
                }
            }
        } catch (e) {
            console.log("[Token Display] findByPropsLazy failed:", e);
        }

        // Method 4: Try to retrieve token via request headers
        try {
            console.log("[Token Display] Attempt via fetch interception");
            // This method uses a dummy request to retrieve the token from headers
            const originalFetch = window.fetch;
            let capturedToken: string | null = null;

            window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
                const headers = init?.headers as HeadersInit;
                if (headers && typeof headers === "object") {
                    const authHeader = (headers as any).Authorization || (headers as any).authorization;
                    if (authHeader && typeof authHeader === "string") {
                        capturedToken = authHeader;
                    }
                }
                return originalFetch.call(this, input, init);
            };

            // Restore fetch after a short delay
            setTimeout(() => {
                window.fetch = originalFetch;
            }, 100);

            if (capturedToken) {
                console.log("[Token Display] Token found via fetch interception");
                return capturedToken;
            }
        } catch (e) {
            console.log("[Token Display] Fetch interception failed:", e);
        }

        console.log("[Token Display] No method worked");
        return null;
    } catch (error) {
        console.error("[Token Display] Error retrieving token:", error);
        return null;
    }
}
