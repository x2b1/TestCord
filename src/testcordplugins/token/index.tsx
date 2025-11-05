/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { ApplicationCommandInputType, ApplicationCommandOptionType, sendBotMessage } from "@api/Commands";

const UserStore = findByPropsLazy("getCurrentUser", "getUser");

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Activer la commande /mytoken",
        default: true
    },
    showInDMs: {
        type: OptionType.BOOLEAN,
        description: "Permettre l'utilisation de la commande dans les DMs",
        default: true
    }
});

export default definePlugin({
    name: "Token Display",
    description: "Affiche le token du compte en cours d'utilisation avec la commande /mytoken",
    authors: [Devs.Unknown],
    dependencies: ["CommandsAPI"],

    settings,

    start() {
        console.log("[Token Display] Plugin démarré - Commande /mytoken disponible");
    },

    stop() {
        console.log("[Token Display] Plugin arrêté");
    },

    commands: [
        {
            name: "mytoken",
            description: "Affiche le token du compte en cours d'utilisation",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [],
            execute: async (opts, ctx) => {
                console.log("[Token Display] Commande /mytoken exécutée");

                if (!settings.store.enabled) {
                    console.log("[Token Display] Commande désactivée dans les paramètres");
                    sendBotMessage(ctx.channel.id, {
                        content: "❌ Cette commande est désactivée dans les paramètres."
                    });
                    return;
                }

                // Vérifier si on est dans un DM et si c'est autorisé
                if (!ctx.guild && !settings.store.showInDMs) {
                    console.log("[Token Display] Commande non autorisée dans les DMs");
                    sendBotMessage(ctx.channel.id, {
                        content: "❌ Cette commande n'est pas autorisée dans les messages privés."
                    });
                    return;
                }

                try {
                    console.log("[Token Display] Tentative de récupération du token...");

                    // Récupérer le token
                    const token = getCurrentToken();

                    if (!token) {
                        console.log("[Token Display] Aucun token trouvé");
                        sendBotMessage(ctx.channel.id, {
                            content: "❌ Impossible de récupérer le token. Assurez-vous d'être connecté."
                        });
                        return;
                    }

                    console.log("[Token Display] Token récupéré avec succès");

                    // Récupérer les informations de l'utilisateur actuel
                    const currentUser = UserStore.getCurrentUser();
                    const username = currentUser ? `${currentUser.username}#${currentUser.discriminator}` : "Utilisateur inconnu";

                    sendBotMessage(ctx.channel.id, {
                        content: `🔑 **Token du compte ${username}:**\n\`\`\`\n${token}\n\`\`\`\n⚠️ **Attention:** Ne partagez jamais votre token avec d'autres personnes !`
                    });
                } catch (error) {
                    console.error("[Token Display] Erreur lors de la récupération du token:", error);
                    sendBotMessage(ctx.channel.id, {
                        content: "❌ Une erreur est survenue lors de la récupération du token."
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

            window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
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
