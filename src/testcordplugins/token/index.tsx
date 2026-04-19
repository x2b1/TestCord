/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import { definePluginSettings } from "@api/Settings";
import { TestcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";

const UserStore = findByPropsLazy("getCurrentUser", "getUser");

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "activates the command /mytoken",
        default: true
    },
    showInDMs: {
        type: OptionType.BOOLEAN,
        description: "does the token show in dms or not",
        default: true
    }
});

export default definePlugin({
    name: "Token Display",
    description: "shows ur token with the command: /mytoken",
    tags: ["Privacy", "Developers"],
    authors: [TestcordDevs.x2b],
    dependencies: ["CommandsAPI"],

    settings,

    start() {
        console.log("mytoken plugin started");
    },

    stop() {
        console.log("mytoken plugin disabled");
    },

    commands: [
        {
            name: "mytoken",
            description: "shows ur token (do not share with anyone)",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [],
            execute: async (opts, ctx) => {
                console.log("executed the /mytoken command");

                if (!settings.store.enabled) {
                    console.log("token display deactivated");
                    sendBotMessage(ctx.channel.id, {
                        content: "the command is deactivated lil vro"
                    });
                    return;
                }

                // Vérifier si on est dans un DM et si c'est autorisé
                if (!ctx.guild && !settings.store.showInDMs) {
                    console.log("command is not turned on in dms");
                    sendBotMessage(ctx.channel.id, {
                        content: "cant send ts in a dm lil vro."
                    });
                    return;
                }

                try {
                    console.log("tryna get ur token");

                    // Récupérer le token
                    const token = getCurrentToken();

                    if (!token) {
                        console.log("cant get no token");
                        sendBotMessage(ctx.channel.id, {
                            content: "impossible to get da token vro"
                        });
                        return;
                    }

                    console.log("success, got ur token");

                    // Récupérer les informations de l'utilisateur actuel
                    const currentUser = UserStore.getCurrentUser();
                    const username = currentUser ? `${currentUser.username}#${currentUser.discriminator}` : "utilities i think, idk french";

                    sendBotMessage(ctx.channel.id, {
                        content: `🔑 **Token of: ${username}:**\n\`\`\`\n${token}\n\`\`\`\n⚠️ **Attention:** this token can be used to access ${username}'s account!`
                    });
                } catch (error) {
                    console.error("error:", error);
                    sendBotMessage(ctx.channel.id, {
                        content: "error when gettin token i think."
                    });
                }
            }
        }
    ]
});

function getCurrentToken(): string | null {
    console.log("[Token Display] Début de la récupération du token");

    try {
        // Méthode 1: Essayer de récupérer le token depuis le localStorage (si disponible)
        if (typeof window !== "undefined" && window.localStorage) {
            console.log("[Token Display] Tentative via localStorage");
            const token = window.localStorage.getItem("token");
            if (token) {
                console.log("[Token Display] Token trouvé dans localStorage");
                // Nettoyer le token (enlever les guillemets si présents)
                return token.replace(/^"(.*)"$/, "$1");
            }
        }

        // Méthode 2: Essayer de récupérer le token via les modules webpack
        if (typeof window !== "undefined" && window.webpackChunkdiscord_app) {
            console.log("[Token Display] Tentative via webpack modules");
            const modules = window.webpackChunkdiscord_app;
            for (const chunk of modules) {
                if (chunk[1]) {
                    for (const moduleId in chunk[1]) {
                        const module = chunk[1][moduleId];
                        if (module && module.exports) {
                            // Chercher des méthodes getToken
                            if (module.exports.getToken && typeof module.exports.getToken === "function") {
                                try {
                                    const token = module.exports.getToken();
                                    if (token && typeof token === "string") {
                                        console.log("[Token Display] Token trouvé via webpack getToken");
                                        return token;
                                    }
                                } catch (e) {
                                    // Ignorer les erreurs
                                }
                            }

                            // Chercher dans les exports par défaut
                            if (module.exports.default && module.exports.default.getToken) {
                                try {
                                    const token = module.exports.default.getToken();
                                    if (token && typeof token === "string") {
                                        console.log("[Token Display] Token trouvé via webpack default.getToken");
                                        return token;
                                    }
                                } catch (e) {
                                    // Ignorer les erreurs
                                }
                            }
                        }
                    }
                }
            }
        }

        // Méthode 3: Essayer de récupérer le token via l'API Discord
        try {
            console.log("[Token Display] Tentative via findByPropsLazy");
            // Chercher dans les modules Vencord pour des méthodes de récupération de token
            const { getToken } = findByPropsLazy("getToken");
            if (getToken && typeof getToken === "function") {
                const token = getToken();
                if (token && typeof token === "string") {
                    console.log("[Token Display] Token trouvé via findByPropsLazy");
                    return token;
                }
            }
        } catch (e) {
            console.log("[Token Display] findByPropsLazy échoué:", e);
        }

        // Méthode 4: Essayer de récupérer le token via les headers de requête
        try {
            console.log("[Token Display] Tentative via interception fetch");
            // Cette méthode utilise une requête factice pour récupérer le token depuis les headers
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

            // Restaurer fetch après un court délai
            setTimeout(() => {
                window.fetch = originalFetch;
            }, 100);

            if (capturedToken) {
                console.log("[Token Display] Token trouvé via interception fetch");
                return capturedToken;
            }
        } catch (e) {
            console.log("[Token Display] Interception fetch échouée:", e);
        }

        console.log("[Token Display] Aucune méthode n'a fonctionné");
        return null;
    } catch (error) {
        console.error("[Token Display] Erreur lors de la récupération du token:", error);
        return null;
    }
}
