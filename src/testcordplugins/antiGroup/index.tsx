/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { showNotification } from "@api/Notifications";
import definePlugin, { OptionType } from "@utils/types";
import { Constants, ChannelStore, RestAPI, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Activer le plugin AntiGroup",
        default: true
    },
    showNotifications: {
        type: OptionType.BOOLEAN,
        description: "Afficher les notifications lors de la sortie automatique",
        default: true
    },
    verboseLogs: {
        type: OptionType.BOOLEAN,
        description: "Afficher des logs détaillés dans la console",
        default: true
    },
    delay: {
        type: OptionType.NUMBER,
        description: "Délai avant de quitter le groupe (en millisecondes)",
        default: 1000,
        min: 100,
        max: 10000
    },
    whitelist: {
        type: OptionType.STRING,
        description: "IDs des utilisateurs autorisés à vous ajouter (séparés par des virgules)",
        default: ""
    },
    autoReply: {
        type: OptionType.BOOLEAN,
        description: "Envoyer un message automatique avant de quitter",
        default: true
    },
    replyMessage: {
        type: OptionType.STRING,
        description: "Message à envoyer avant de quitter",
        default: "Je ne souhaite pas être ajouté à des groupes. Merci de me contacter en privé."
    }
});

// Fonction de log avec préfixe
function log(message: string, level: "info" | "warn" | "error" = "info") {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[AntiGroup ${timestamp}]`;

    switch (level) {
        case "warn":
            console.warn(prefix, message);
            break;
        case "error":
            console.error(prefix, message);
            break;
        default:
            console.log(prefix, message);
    }
}

// Fonction de log verbose (seulement si activé)
function verboseLog(message: string) {
    if (settings.store.verboseLogs) {
        log(message);
    }
}

// Fonction pour quitter un groupe DM
async function leaveGroupDM(channelId: string) {
    try {
        const channel = ChannelStore.getChannel(channelId);
        const channelName = channel?.name || "Groupe sans nom";
        const recipients = channel?.recipients || [];

        log(`🚀 Début de la procédure de sortie du groupe "${channelName}" (ID: ${channelId})`);
        verboseLog(`📊 Informations du groupe:
- Nom: ${channelName}
- ID: ${channelId}
- Type: ${channel?.type}
- Owner: ${channel?.ownerId}
- Nombre de membres: ${recipients.length + 1}`);

        // Envoyer un message automatique si activé
        if (settings.store.autoReply && settings.store.replyMessage.trim()) {
            log(`💬 Envoi du message automatique: "${settings.store.replyMessage}"`);

            try {
                await RestAPI.post({
                    url: Constants.Endpoints.MESSAGES(channelId),
                    body: {
                        content: settings.store.replyMessage
                    }
                });

                log(`✅ Message automatique envoyé avec succès`);
                verboseLog(`⏱️ Attente de 500ms pour que le message soit délivré...`);

                // Attendre un peu avant de quitter pour que le message soit envoyé
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (msgError) {
                log(`❌ Erreur lors de l'envoi du message automatique: ${msgError}`, "error");
            }
        } else {
            verboseLog(`🔇 Message automatique désactivé ou vide`);
        }

        // Quitter le groupe
        log(`🚪 Tentative de sortie du groupe...`);
        await RestAPI.del({
            url: Constants.Endpoints.CHANNEL(channelId)
        });

        log(`✅ Groupe quitté avec succès: "${channelName}"`);

        // Notification de succès
        if (settings.store.showNotifications) {
            showNotification({
                title: "🛡️ AntiGroup - Groupe quitté",
                body: `Vous avez automatiquement quitté le groupe "${channelName}"`,
                icon: undefined
            });
            verboseLog(`🔔 Notification de succès affichée`);
        }

        // Log final avec statistiques
        log(`📈 Statistiques de la sortie:
- Groupe: "${channelName}" (${channelId})
- Message auto envoyé: ${settings.store.autoReply ? "Oui" : "Non"}
- Délai appliqué: ${settings.store.delay}ms
- Notification affichée: ${settings.store.showNotifications ? "Oui" : "Non"}`);

    } catch (error) {
        const channel = ChannelStore.getChannel(channelId);
        const channelName = channel?.name || "Groupe inconnu";

        log(`❌ ERREUR lors de la sortie du groupe "${channelName}" (${channelId}): ${error}`, "error");

        // Log détaillé de l'erreur
        if (settings.store.verboseLogs) {
            console.error("[AntiGroup] Détails de l'erreur:", {
                channelId,
                channelName,
                error,
                stack: error instanceof Error ? error.stack : undefined
            });
        }

        // Notification d'erreur
        if (settings.store.showNotifications) {
            showNotification({
                title: "❌ AntiGroup - Erreur",
                body: `Impossible de quitter automatiquement le groupe "${channelName}"`,
                icon: undefined
            });
            verboseLog(`🔔 Notification d'erreur affichée`);
        }
    }
}

// Fonction pour vérifier si un utilisateur est dans la whitelist
function isUserWhitelisted(userId: string): boolean {
    const whitelist = settings.store.whitelist
        .split(",")
        .map(id => id.trim())
        .filter(id => id.length > 0);

    const isWhitelisted = whitelist.includes(userId);
    verboseLog(`🔍 Vérification whitelist pour utilisateur ${userId}: ${isWhitelisted ? "AUTORISÉ" : "NON AUTORISÉ"}`);

    return isWhitelisted;
}

// Fonction pour vérifier si l'utilisateur actuel a été ajouté récemment au groupe
function wasRecentlyAdded(channel: any, currentUserId: string): boolean {
    // Vérifier si c'est un groupe DM (type 3)
    if (channel.type !== 3) {
        verboseLog(`❌ Canal ${channel.id} n'est pas un groupe DM (type: ${channel.type})`);
        return false;
    }

    // Si le canal vient d'être créé et que l'utilisateur n'en est pas l'owner
    const wasAdded = channel.ownerId !== currentUserId;
    verboseLog(`🔍 Vérification ajout récent: ${wasAdded ? "AJOUTÉ PAR QUELQU'UN D'AUTRE" : "CRÉÉ PAR VOUS"} (Owner: ${channel.ownerId})`);

    return wasAdded;
}

export default definePlugin({
    name: "AntiGroup",
    description: "Quitte automatiquement les groupes DM dès qu'on y est ajouté",
    authors: [{
        name: "Bash",
        id: 1327483363518582784n
    }],
    settings,

    flux: {
        // Événement déclenché quand un nouveau canal est créé (incluant les groupes DM)
        CHANNEL_CREATE(event: { channel: any; }) {
            verboseLog(`📺 Événement CHANNEL_CREATE détecté pour canal ${event.channel?.id}`);

            if (!settings.store.enabled) {
                verboseLog(`🔒 Plugin désactivé, ignoré`);
                return;
            }

            const { channel } = event;
            const currentUserId = UserStore.getCurrentUser()?.id;

            if (!channel || !currentUserId) {
                verboseLog(`❌ Données manquantes: channel=${!!channel}, currentUserId=${!!currentUserId}`);
                return;
            }

            verboseLog(`📋 Analyse du canal:
- ID: ${channel.id}
- Type: ${channel.type}
- Nom: ${channel.name || "Sans nom"}
- Owner: ${channel.ownerId}
- Utilisateur actuel: ${currentUserId}`);

            // Vérifier si c'est un groupe DM (type 3)
            if (channel.type !== 3) {
                verboseLog(`⏭️ Ignoré: pas un groupe DM (type ${channel.type})`);
                return;
            }

            // Vérifier si l'utilisateur a été récemment ajouté
            if (!wasRecentlyAdded(channel, currentUserId)) {
                verboseLog(`⏭️ Ignoré: vous êtes le créateur du groupe`);
                return;
            }

            log(`🎯 NOUVEAU GROUPE DM DÉTECTÉ: "${channel.name || 'Sans nom'}" (${channel.id})`);

            // Vérifier si l'owner du groupe est dans la whitelist
            if (channel.ownerId && isUserWhitelisted(channel.ownerId)) {
                log(`✅ Owner ${channel.ownerId} est dans la whitelist, groupe autorisé`);
                return;
            }

            // Vérifier si d'autres membres du groupe sont dans la whitelist
            const whitelistedMember = channel.recipients?.find((recipient: any) =>
                isUserWhitelisted(recipient.id)
            );

            if (whitelistedMember) {
                log(`✅ Membre ${whitelistedMember.id} est dans la whitelist, groupe autorisé`);
                return;
            }

            log(`⚠️ AUCUN MEMBRE AUTORISÉ TROUVÉ - Programmation de la sortie automatique dans ${settings.store.delay}ms`);

            // Notification immédiate de détection
            if (settings.store.showNotifications) {
                showNotification({
                    title: "🚨 AntiGroup - Groupe détecté",
                    body: `Ajouté au groupe "${channel.name || 'Sans nom'}" - Sortie automatique dans ${settings.store.delay / 1000}s`,
                    icon: undefined
                });
            }

            // Attendre le délai configuré avant de quitter
            setTimeout(() => {
                verboseLog(`⏰ Délai écoulé, exécution de la sortie automatique`);
                leaveGroupDM(channel.id);
            }, settings.store.delay);
        }
    },

    start() {
        log(`🚀 Plugin AntiGroup démarré`);
        log(`⚙️ Configuration actuelle:
- Notifications: ${settings.store.showNotifications ? "ON" : "OFF"}
- Logs verbeux: ${settings.store.verboseLogs ? "ON" : "OFF"}
- Message auto: ${settings.store.autoReply ? "ON" : "OFF"}
- Délai: ${settings.store.delay}ms
- Whitelist: ${settings.store.whitelist || "Vide"}`);

        if (settings.store.showNotifications) {
            showNotification({
                title: "🛡️ AntiGroup activé",
                body: "Protection contre les groupes DM non désirés activée",
                icon: undefined
            });
        }
    },

    stop() {
        log(`🛑 Plugin AntiGroup arrêté`);

        if (settings.store.showNotifications) {
            showNotification({
                title: "🛡️ AntiGroup désactivé",
                body: "Protection contre les groupes DM désactivée",
                icon: undefined
            });
        }
    }
});
