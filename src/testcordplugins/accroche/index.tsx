/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { showNotification } from "@api/Notifications";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { UserStore, FluxDispatcher, Constants, RestAPI, Menu, React } from "@webpack/common";
import { NavContextMenuPatchCallback } from "@api/ContextMenu";

// Récupération des stores et actions nécessaires
const VoiceStateStore = findStoreLazy("VoiceStateStore");
const ChannelActions = findByPropsLazy("selectVoiceChannel");
const SelectedGuildStore = findStoreLazy("SelectedGuildStore");

interface VoiceState {
    userId: string;
    channelId?: string;
    oldChannelId?: string;
    guildId?: string;
    deaf: boolean;
    mute: boolean;
    selfDeaf: boolean;
    selfMute: boolean;
    selfStream: boolean;
    selfVideo: boolean;
    sessionId: string;
    suppress: boolean;
    requestToSpeakTimestamp: string | null;
}

interface AccrochedUserInfo {
    userId: string;
    username: string;
    lastChannelId: string | null;
    isAccroched: boolean;
}

interface AnchoredUserInfo {
    userId: string;
    username: string;
    lastChannelId: string | null;
    isAnchored: boolean;
}

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Activer le plugin Accroche",
        default: true
    },
    showNotifications: {
        type: OptionType.BOOLEAN,
        description: "Afficher les notifications lors des actions",
        default: true
    },
    verboseLogs: {
        type: OptionType.BOOLEAN,
        description: "Afficher des logs détaillés dans la console",
        default: true
    },
    preventSelfMove: {
        type: OptionType.BOOLEAN,
        description: "Empêcher l'utilisateur accroché de se déplacer manuellement",
        default: true
    },
    autoReconnectDelay: {
        type: OptionType.NUMBER,
        description: "Délai avant de reconnecter l'utilisateur (en millisecondes)",
        default: 1000,
        min: 500,
        max: 5000
    },
    enableAnchor: {
        type: OptionType.BOOLEAN,
        description: "Activer la fonctionnalité d'ancrage (revenir automatiquement dans le salon de la personne ancrée)",
        default: true
    },
    anchorDelay: {
        type: OptionType.NUMBER,
        description: "Délai avant de revenir dans le salon de la personne ancrée (en millisecondes)",
        default: 2000,
        min: 1000,
        max: 10000
    },
    anchorNotifications: {
        type: OptionType.BOOLEAN,
        description: "Afficher les notifications lors des actions d'ancrage",
        default: true
    }
});

// Variables globales
let accrochedUserInfo: AccrochedUserInfo | null = null;
let anchoredUserInfo: AnchoredUserInfo | null = null;
let originalSelectVoiceChannel: any = null;
let isPreventingMove = false;
let anchorMonitoringInterval: NodeJS.Timeout | null = null;

// Fonction de log avec préfixe
function log(message: string, level: "info" | "warn" | "error" = "info") {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[Accroche ${timestamp}]`;

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

// Fonction pour déplacer un utilisateur vers un canal vocal
async function moveUserToVoiceChannel(userId: string, channelId: string): Promise<void> {
    const guildId = SelectedGuildStore.getGuildId();
    if (!guildId) {
        throw new Error("Aucun serveur sélectionné");
    }

    try {
        verboseLog(`🔄 Tentative de déplacement de l'utilisateur ${userId} vers le canal ${channelId}`);

        // Utiliser l'API Discord pour déplacer l'utilisateur
        await RestAPI.patch({
            url: Constants.Endpoints.GUILD_MEMBER(guildId, userId),
            body: {
                channel_id: channelId
            }
        });

        verboseLog(`✅ Utilisateur ${userId} déplacé avec succès vers le canal ${channelId}`);

        if (settings.store.showNotifications) {
            const user = UserStore.getUser(userId);
            showNotification({
                title: "🔗 Accroche - Succès",
                body: `${user?.username || "L'utilisateur"} a été ramené dans votre canal vocal`
            });
        }
    } catch (error) {
        console.error("Accroche: Erreur API Discord:", error);
        throw error;
    }
}

// Fonction pour accrocher un utilisateur
async function accrocherUtilisateur(userId: string, username: string) {
    verboseLog(`🚀 Début de la fonction accrocherUtilisateur pour ${username} (${userId})`);

    const currentUser = UserStore.getCurrentUser();
    if (!currentUser) {
        log("❌ Utilisateur actuel non disponible", "error");
        return;
    }

    verboseLog(`✅ Utilisateur actuel trouvé: ${currentUser.username} (${currentUser.id})`);

    const currentUserId = currentUser.id;
    if (userId === currentUserId) {
        log("❌ Impossible de s'accrocher à soi-même", "warn");
        if (settings.store.showNotifications) {
            showNotification({
                title: "🔗 Accroche - Erreur",
                body: "Vous ne pouvez pas vous accrocher à vous-même !"
            });
        }
        return;
    }

    // Vérifier si l'utilisateur est déjà accroché
    if (accrochedUserInfo && accrochedUserInfo.userId === userId) {
        log(`⚠️ L'utilisateur ${username} est déjà accroché`, "warn");
        if (settings.store.showNotifications) {
            showNotification({
                title: "🔗 Accroche - Info",
                body: `${username} est déjà accroché à vous`
            });
        }
        return;
    }

    // Obtenir l'état vocal actuel de l'utilisateur avec un délai pour laisser le temps à la connexion RTC de s'établir
    let userVoiceState = VoiceStateStore.getVoiceStateForUser(userId);
    let currentVoiceState = VoiceStateStore.getVoiceStateForUser(currentUserId);

    verboseLog(`🔍 État vocal initial - Utilisateur: ${userVoiceState?.channelId || 'null'}, Vous: ${currentVoiceState?.channelId || 'null'}`);

    // Si l'état vocal n'est pas immédiatement disponible, attendre un peu
    if (!userVoiceState?.channelId || !currentVoiceState?.channelId) {
        verboseLog(`⏳ État vocal non disponible immédiatement, attente de 500ms...`);

        await new Promise(resolve => setTimeout(resolve, 500));

        userVoiceState = VoiceStateStore.getVoiceStateForUser(userId);
        currentVoiceState = VoiceStateStore.getVoiceStateForUser(currentUserId);

        verboseLog(`🔍 État vocal après attente - Utilisateur: ${userVoiceState?.channelId || 'null'}, Vous: ${currentVoiceState?.channelId || 'null'}`);
    }

    if (!userVoiceState?.channelId) {
        log(`❌ L'utilisateur ${username} n'est pas dans un canal vocal`, "warn");
        if (settings.store.showNotifications) {
            showNotification({
                title: "🔗 Accroche - Erreur",
                body: `${username} n'est pas dans un canal vocal`
            });
        }
        return;
    }

    if (!currentVoiceState?.channelId) {
        log(`❌ Vous n'êtes pas dans un canal vocal`, "warn");
        if (settings.store.showNotifications) {
            showNotification({
                title: "🔗 Accroche - Erreur",
                body: "Vous devez être dans un canal vocal pour accrocher quelqu'un"
            });
        }
        return;
    }

    // Accrocher l'utilisateur
    accrochedUserInfo = {
        userId,
        username,
        lastChannelId: userVoiceState.channelId,
        isAccroched: true
    };

    log(`🔗 Utilisateur ${username} (${userId}) accroché avec succès`);
    verboseLog(`📊 Informations d'accroche:
- Utilisateur: ${username} (${userId})
- Canal actuel: ${userVoiceState.channelId}
- Votre canal: ${currentVoiceState.channelId}`);

    if (settings.store.showNotifications) {
        showNotification({
            title: "🔗 Accroche - Activé",
            body: `${username} est maintenant accroché à vous`
        });
    }
}

// Fonction pour décrocher un utilisateur
function decrocherUtilisateur() {
    if (!accrochedUserInfo) {
        log("⚠️ Aucun utilisateur accroché", "warn");
        return;
    }

    const { username } = accrochedUserInfo;
    accrochedUserInfo = null;

    log(`🔓 Utilisateur ${username} décroché`);

    if (settings.store.showNotifications) {
        showNotification({
            title: "🔗 Accroche - Désactivé",
            body: `${username} n'est plus accroché`
        });
    }
}

// Fonction pour ancrer un utilisateur (le suivre)
async function ancrerUtilisateur(userId: string, username: string) {
    verboseLog(`🚀 Début de la fonction ancrerUtilisateur pour ${username} (${userId})`);

    const currentUser = UserStore.getCurrentUser();
    if (!currentUser) {
        log("❌ Utilisateur actuel non disponible", "error");
        return;
    }

    verboseLog(`✅ Utilisateur actuel trouvé: ${currentUser.username} (${currentUser.id})`);

    const currentUserId = currentUser.id;
    if (userId === currentUserId) {
        log("❌ Impossible de s'ancrer à soi-même", "warn");
        if (settings.store.anchorNotifications) {
            showNotification({
                title: "⚓ Ancrage - Erreur",
                body: "Vous ne pouvez pas vous ancrer à vous-même !"
            });
        }
        return;
    }

    // Vérifier si l'utilisateur est déjà ancré
    if (anchoredUserInfo && anchoredUserInfo.userId === userId) {
        log(`⚠️ L'utilisateur ${username} est déjà ancré`, "warn");
        if (settings.store.anchorNotifications) {
            showNotification({
                title: "⚓ Ancrage - Info",
                body: `${username} est déjà ancré`
            });
        }
        return;
    }

    // Obtenir l'état vocal actuel de l'utilisateur avec un délai pour laisser le temps à la connexion RTC de s'établir
    let userVoiceState = VoiceStateStore.getVoiceStateForUser(userId);
    let currentVoiceState = VoiceStateStore.getVoiceStateForUser(currentUserId);

    verboseLog(`🔍 État vocal initial (ancrage) - Utilisateur: ${userVoiceState?.channelId || 'null'}, Vous: ${currentVoiceState?.channelId || 'null'}`);

    // Si l'état vocal n'est pas immédiatement disponible, attendre un peu
    if (!userVoiceState?.channelId || !currentVoiceState?.channelId) {
        verboseLog(`⏳ État vocal non disponible immédiatement pour l'ancrage, attente de 500ms...`);

        await new Promise(resolve => setTimeout(resolve, 500));

        userVoiceState = VoiceStateStore.getVoiceStateForUser(userId);
        currentVoiceState = VoiceStateStore.getVoiceStateForUser(currentUserId);

        verboseLog(`🔍 État vocal après attente (ancrage) - Utilisateur: ${userVoiceState?.channelId || 'null'}, Vous: ${currentVoiceState?.channelId || 'null'}`);
    }

    if (!userVoiceState?.channelId) {
        log(`❌ L'utilisateur ${username} n'est pas dans un canal vocal`, "warn");
        if (settings.store.anchorNotifications) {
            showNotification({
                title: "⚓ Ancrage - Erreur",
                body: `${username} n'est pas dans un canal vocal`
            });
        }
        return;
    }

    if (!currentVoiceState?.channelId) {
        log(`❌ Vous n'êtes pas dans un canal vocal`, "warn");
        if (settings.store.anchorNotifications) {
            showNotification({
                title: "⚓ Ancrage - Erreur",
                body: "Vous devez être dans un canal vocal pour ancrer quelqu'un"
            });
        }
        return;
    }

    // Ancrer l'utilisateur
    anchoredUserInfo = {
        userId,
        username,
        lastChannelId: userVoiceState.channelId,
        isAnchored: true
    };

    log(`⚓ Utilisateur ${username} (${userId}) ancré avec succès`);
    verboseLog(`📊 Informations d'ancrage:
- Utilisateur: ${username} (${userId})
- Canal actuel: ${userVoiceState.channelId}
- Votre canal: ${currentVoiceState.channelId}`);

    // Démarrer la surveillance périodique
    startAnchorMonitoring();

    if (settings.store.anchorNotifications) {
        showNotification({
            title: "⚓ Ancrage - Activé",
            body: `Vous reviendrez automatiquement dans le salon de ${username} si vous êtes déplacé`
        });
    }
}

// Fonction pour désancrer un utilisateur
function desancrerUtilisateur() {
    if (!anchoredUserInfo) {
        log("⚠️ Aucun utilisateur ancré", "warn");
        return;
    }

    const { username } = anchoredUserInfo;
    anchoredUserInfo = null;

    // Arrêter la surveillance périodique
    stopAnchorMonitoring();

    log(`⚓ Utilisateur ${username} désancré`);

    if (settings.store.anchorNotifications) {
        showNotification({
            title: "⚓ Ancrage - Désactivé",
            body: `Vous n'êtes plus ancré à ${username}`
        });
    }
}

// Fonction pour démarrer la surveillance périodique de l'ancrage
function startAnchorMonitoring() {
    if (anchorMonitoringInterval) {
        clearInterval(anchorMonitoringInterval);
    }

    console.log("🔍🔍🔍 DÉMARRAGE SURVEILLANCE ANCRAGE 🔍🔍🔍");

    anchorMonitoringInterval = setInterval(() => {
        if (!anchoredUserInfo) {
            verboseLog("🔍 Surveillance ancrage: Aucun utilisateur ancré");
            return;
        }

        const currentUser = UserStore.getCurrentUser();
        if (!currentUser) {
            verboseLog("🔍 Surveillance ancrage: Utilisateur actuel non disponible");
            return;
        }

        const currentUserId = currentUser.id;
        const myVoiceState = VoiceStateStore.getVoiceStateForUser(currentUserId);
        const anchoredUserVoiceState = VoiceStateStore.getVoiceStateForUser(anchoredUserInfo.userId);

        if (!myVoiceState?.channelId || !anchoredUserVoiceState?.channelId) {
            verboseLog(`🔍 Surveillance ancrage: Un des utilisateurs n'est pas dans un canal vocal - Vous: ${myVoiceState?.channelId || 'null'}, Ancré: ${anchoredUserVoiceState?.channelId || 'null'}`);
            return;
        }

        // Log périodique pour vérifier l'état
        if (Math.random() < 0.1) { // 10% de chance à chaque vérification
            verboseLog(`🔍 Surveillance ancrage: Vous: ${myVoiceState.channelId}, ${anchoredUserInfo.username}: ${anchoredUserVoiceState.channelId}`);
        }

        // Si on n'est pas dans le même canal que la personne ancrée
        if (myVoiceState.channelId !== anchoredUserVoiceState.channelId) {
            console.log("🚨🚨🚨 SURVEILLANCE ANCRAGE - DÉPLACEMENT DÉTECTÉ 🚨🚨🚨");
            console.log(`Vous: ${myVoiceState.channelId}, Personne ancrée: ${anchoredUserVoiceState.channelId}`);

            log(`⚠️ Surveillance: Vous avez été déplacé, retour automatique vers le salon de ${anchoredUserInfo.username}`);

            // Revenir dans le salon de la personne ancrée
            setTimeout(async () => {
                try {
                    await moveCurrentUserToVoiceChannel(anchoredUserVoiceState.channelId);
                } catch (error) {
                    log(`❌ Erreur lors du retour automatique: ${error}`, "error");
                }
            }, settings.store.anchorDelay);
        }
    }, 1000); // Vérifier toutes les secondes
}

// Fonction pour arrêter la surveillance périodique de l'ancrage
function stopAnchorMonitoring() {
    if (anchorMonitoringInterval) {
        console.log("🛑🛑🛑 ARRÊT SURVEILLANCE ANCRAGE 🛑🛑🛑");
        clearInterval(anchorMonitoringInterval);
        anchorMonitoringInterval = null;
    }
}

// Fonction pour déplacer l'utilisateur actuel vers un canal vocal
async function moveCurrentUserToVoiceChannel(channelId: string): Promise<void> {
    console.log("🚀🚀🚀 DÉPLACEMENT UTILISATEUR ACTUEL VERS CANAL 🚀🚀🚀", channelId);

    const currentUser = UserStore.getCurrentUser();
    if (!currentUser) {
        console.error("❌❌❌ UTILISATEUR ACTUEL NON DISPONIBLE ❌❌❌");
        throw new Error("Utilisateur actuel non disponible");
    }

    try {
        console.log(`🔄 Tentative de déplacement de ${currentUser.username} vers le canal ${channelId}`);
        verboseLog(`🔄 Tentative de déplacement vers le canal ${channelId}`);

        // Utiliser l'API Discord pour se déplacer
        await RestAPI.patch({
            url: Constants.Endpoints.GUILD_MEMBER(SelectedGuildStore.getGuildId(), currentUser.id),
            body: {
                channel_id: channelId
            }
        });

        verboseLog(`✅ Déplacement vers le canal ${channelId} réussi`);

        if (settings.store.anchorNotifications) {
            showNotification({
                title: "⚓ Ancrage - Retour automatique",
                body: `Vous êtes revenu dans le salon de ${anchoredUserInfo?.username}`
            });
        }
    } catch (error) {
        console.error("Ancrage: Erreur API Discord:", error);
        throw error;
    }
}

// Menu contextuel pour les utilisateurs
const UserContextMenuPatch: NavContextMenuPatchCallback = (children, { user }: { user: any; }) => {
    console.log("🔍🔍🔍 MENU CONTEXTUEL ACCROCHE APPELÉ 🔍🔍🔍", user?.username || 'utilisateur inconnu');
    verboseLog(`🔍 Menu contextuel appelé pour ${user?.username || 'utilisateur inconnu'}`);

    if (!settings.store.enabled || !user) {
        console.log("❌❌❌ PLUGIN DÉSACTIVÉ OU UTILISATEUR MANQUANT ❌❌❌", { enabled: settings.store.enabled, user: !!user });
        verboseLog(`❌ Plugin désactivé ou utilisateur manquant - enabled: ${settings.store.enabled}, user: ${!!user}`);
        return;
    }

    const currentUser = UserStore.getCurrentUser();
    if (!currentUser || user.id === currentUser.id) {
        verboseLog(`❌ Utilisateur actuel manquant ou même utilisateur - currentUser: ${!!currentUser}, sameUser: ${user.id === currentUser?.id}`);
        return;
    }

    verboseLog(`✅ Menu contextuel ajouté pour ${user.username}`);

    const isCurrentlyAccroched = accrochedUserInfo?.userId === user.id;
    const isCurrentlyAnchored = anchoredUserInfo?.userId === user.id;

    children.push(
        React.createElement(Menu.MenuSeparator, {}),
        React.createElement(Menu.MenuItem, {
            id: "accroche-user",
            label: isCurrentlyAccroched ? `🔓 Décrocher ${user.username}` : `🔗 Accrocher ${user.username}`,
            action: async () => {
                if (isCurrentlyAccroched) {
                    decrocherUtilisateur();
                } else {
                    await accrocherUtilisateur(user.id, user.username);
                }
            }
        })
    );

    // Ajouter l'option d'ancrage si activée
    if (settings.store.enableAnchor) {
        children.push(
            React.createElement(Menu.MenuItem, {
                id: "anchor-user",
                label: isCurrentlyAnchored ? `⚓ Désancrer ${user.username}` : `⚓ Ancrer ${user.username}`,
                action: async () => {
                    if (isCurrentlyAnchored) {
                        desancrerUtilisateur();
                    } else {
                        await ancrerUtilisateur(user.id, user.username);
                    }
                }
            })
        );
    }
};

export default definePlugin({
    name: "Accroche",
    description: "Accroche un utilisateur pour l'empêcher de changer de canal vocal ou s'ancrer à un utilisateur pour revenir automatiquement dans son salon",
    authors: [{
        name: "Bash",
        id: 1327483363518582784n
    }],
    settings,

    contextMenus: {
        "user-context": UserContextMenuPatch
    },

    flux: {
        async VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            if (!settings.store.enabled) return;

            const currentUser = UserStore.getCurrentUser();
            if (!currentUser) return;

            const currentUserId = currentUser.id;
            const currentVoiceState = VoiceStateStore.getVoiceStateForUser(currentUserId);

            // Si l'utilisateur actuel n'est pas dans un canal vocal, ne rien faire
            if (!currentVoiceState?.channelId) {
                verboseLog("🔇 Vous n'êtes pas dans un canal vocal, accroche/ancrage suspendu");
                return;
            }

            // Logique d'ancrage (revenir automatiquement dans le salon de la personne ancrée)
            if (anchoredUserInfo) {
                console.log("🔍🔍🔍 ANCRAGE ACTIF - Vérification des changements de canal 🔍🔍🔍");
                verboseLog(`⚓ Ancrage actif pour ${anchoredUserInfo.username} (${anchoredUserInfo.userId})`);

                for (const voiceState of voiceStates) {
                    const { userId, channelId, oldChannelId } = voiceState;

                    // Détecter quand VOUS êtes déplacé (utilisateur actuel)
                    if (userId === currentUserId && channelId !== currentVoiceState.channelId) {
                        console.log("🚨🚨🚨 DÉPLACEMENT DÉTECTÉ - ANCRAGE EN COURS 🚨🚨🚨");
                        console.log(`Vous: ${currentUserId}, Ancien canal: ${currentVoiceState.channelId}, Nouveau canal: ${channelId}`);
                        verboseLog(`🔄 Vous avez été déplacé: ${currentVoiceState.channelId} -> ${channelId}`);

                        // Vérifier si la personne à qui vous êtes ancré est toujours dans un canal vocal
                        const anchoredUserVoiceState = VoiceStateStore.getVoiceStateForUser(anchoredUserInfo!.userId);

                        if (!anchoredUserVoiceState?.channelId) {
                            log(`🚪 ${anchoredUserInfo!.username} a quitté le canal vocal, ancrage suspendu`);
                            if (settings.store.anchorNotifications) {
                                showNotification({
                                    title: "⚓ Ancrage - Suspendu",
                                    body: `${anchoredUserInfo!.username} a quitté le canal vocal`
                                });
                            }
                            continue;
                        }

                        // Si vous n'êtes pas dans le même canal que la personne ancrée
                        if (channelId !== anchoredUserVoiceState.channelId) {
                            log(`⚠️ Vous avez été déplacé, retour automatique vers le salon de ${anchoredUserInfo!.username}`);

                            // Attendre un délai avant de revenir dans le salon de la personne ancrée
                            setTimeout(async () => {
                                try {
                                    // Vérifier que l'utilisateur est toujours ancré
                                    const currentAnchoredState = VoiceStateStore.getVoiceStateForUser(anchoredUserInfo!.userId);
                                    const myCurrentState = VoiceStateStore.getVoiceStateForUser(currentUserId);

                                    if (!anchoredUserInfo || !currentAnchoredState?.channelId) {
                                        verboseLog("🔍 Utilisateur plus ancré ou personne ancrée plus dans un canal vocal");
                                        return;
                                    }

                                    if (myCurrentState?.channelId === currentAnchoredState.channelId) {
                                        verboseLog("✅ Vous êtes déjà dans le bon canal");
                                        return;
                                    }

                                    // Revenir dans le salon de la personne ancrée
                                    await moveCurrentUserToVoiceChannel(currentAnchoredState.channelId);

                                } catch (error) {
                                    log(`❌ Erreur lors du retour vers ${anchoredUserInfo!.username}: ${error}`, "error");

                                    if (settings.store.anchorNotifications) {
                                        showNotification({
                                            title: "⚓ Ancrage - Erreur",
                                            body: `Impossible de revenir dans le salon de ${anchoredUserInfo!.username}`
                                        });
                                    }
                                }
                            }, settings.store.anchorDelay);
                        }
                    }
                }
            }

            // Logique d'accroche (empêcher un utilisateur de bouger)
            if (!accrochedUserInfo) return;

            for (const voiceState of voiceStates) {
                const { userId, channelId, oldChannelId } = voiceState;

                // Détecter quand l'utilisateur accroché change de canal vocal
                if (userId === accrochedUserInfo!.userId && channelId !== accrochedUserInfo!.lastChannelId) {
                    verboseLog(`🔄 Changement de canal détecté pour ${accrochedUserInfo!.username}: ${oldChannelId} -> ${channelId}`);

                    // Mettre à jour le dernier canal connu
                    accrochedUserInfo!.lastChannelId = channelId || null;

                    // Si l'utilisateur accroché a quitté le canal vocal
                    if (!channelId) {
                        log(`🚪 ${accrochedUserInfo!.username} a quitté le canal vocal`);
                        if (settings.store.showNotifications) {
                            showNotification({
                                title: "🔗 Accroche - Info",
                                body: `${accrochedUserInfo!.username} a quitté le canal vocal`
                            });
                        }
                        continue;
                    }

                    // Si l'utilisateur accroché est dans un canal différent du vôtre
                    if (channelId !== currentVoiceState.channelId) {
                        log(`⚠️ ${accrochedUserInfo!.username} a changé de canal, tentative de ramener dans votre canal`);

                        // Attendre un délai avant de ramener l'utilisateur
                        setTimeout(async () => {
                            try {
                                // Vérifier que l'utilisateur est toujours accroché et dans un canal différent
                                const currentAccrochedState = VoiceStateStore.getVoiceStateForUser(accrochedUserInfo!.userId);
                                const myCurrentState = VoiceStateStore.getVoiceStateForUser(currentUserId);

                                if (!accrochedUserInfo || !myCurrentState?.channelId) {
                                    verboseLog("🔍 Utilisateur plus accroché ou vous n'êtes plus dans un canal vocal");
                                    return;
                                }

                                if (currentAccrochedState?.channelId === myCurrentState.channelId) {
                                    verboseLog("✅ L'utilisateur est déjà dans votre canal");
                                    return;
                                }

                                // Ramener l'utilisateur dans votre canal
                                await moveUserToVoiceChannel(accrochedUserInfo!.userId, myCurrentState.channelId);

                            } catch (error) {
                                log(`❌ Erreur lors du déplacement de ${accrochedUserInfo!.username}: ${error}`, "error");

                                if (settings.store.showNotifications) {
                                    showNotification({
                                        title: "🔗 Accroche - Erreur",
                                        body: `Impossible de ramener ${accrochedUserInfo!.username} dans votre canal`
                                    });
                                }
                            }
                        }, settings.store.autoReconnectDelay);
                    }
                }

                // Détecter quand l'utilisateur actuel change de canal vocal
                if (userId === currentUserId && channelId !== currentVoiceState.channelId) {
                    verboseLog(`🔄 Vous avez changé de canal: ${currentVoiceState.channelId} -> ${channelId}`);

                    // Si on a un utilisateur accroché et qu'on rejoint un nouveau canal
                    if (channelId && accrochedUserInfo) {
                        const accrochedUserVoiceState = VoiceStateStore.getVoiceStateForUser(accrochedUserInfo.userId);

                        // Si l'utilisateur accroché est dans un canal vocal différent
                        if (accrochedUserVoiceState?.channelId && accrochedUserVoiceState.channelId !== channelId) {
                            log(`🔄 Vous avez changé de canal, déplacement de ${accrochedUserInfo!.username} vers votre nouveau canal`);

                            setTimeout(async () => {
                                try {
                                    await moveUserToVoiceChannel(accrochedUserInfo!.userId, channelId);
                                } catch (error) {
                                    log(`❌ Erreur lors du déplacement de ${accrochedUserInfo!.username}: ${error}`, "error");
                                }
                            }, settings.store.autoReconnectDelay);
                        }
                    }
                }
            }
        }
    },

    start() {
        console.log("🚀🚀🚀 PLUGIN ACCROCHE DÉMARRÉ 🚀🚀🚀");
        log("🚀 Plugin Accroche démarré");
        log(`⚙️ Configuration actuelle:
- Notifications: ${settings.store.showNotifications ? "ON" : "OFF"}
- Logs verbeux: ${settings.store.verboseLogs ? "ON" : "OFF"}
- Empêcher déplacement manuel: ${settings.store.preventSelfMove ? "ON" : "OFF"}
- Délai de reconnexion: ${settings.store.autoReconnectDelay}ms
- Ancrage activé: ${settings.store.enableAnchor ? "ON" : "OFF"}
- Délai d'ancrage: ${settings.store.anchorDelay}ms
- Notifications d'ancrage: ${settings.store.anchorNotifications ? "ON" : "OFF"}`);

        // Vérifier que les stores sont disponibles
        console.log("🔍 Vérification des stores:");
        console.log("- VoiceStateStore:", !!VoiceStateStore);
        console.log("- ChannelActions:", !!ChannelActions);
        console.log("- UserStore:", !!UserStore);
        console.log("- PermissionStore: non importé (normal)");

        // Démarrer la surveillance périodique pour l'ancrage
        if (settings.store.enableAnchor) {
            console.log("🔍🔍🔍 DÉMARRAGE SURVEILLANCE ANCRAGE AU START 🔍🔍🔍");
            startAnchorMonitoring();
        }

        // Sauvegarder la fonction originale si on veut empêcher les déplacements manuels
        if (settings.store.preventSelfMove && ChannelActions) {
            originalSelectVoiceChannel = ChannelActions.selectVoiceChannel;

            // Intercepter les tentatives de changement de canal de l'utilisateur accroché
            ChannelActions.selectVoiceChannel = function (channelId: string | null) {
                if (accrochedUserInfo && !isPreventingMove) {
                    const currentUser = UserStore.getCurrentUser();
                    if (currentUser && accrochedUserInfo.userId === currentUser.id) {
                        log(`🚫 Tentative de déplacement manuel bloquée pour ${accrochedUserInfo.username}`);

                        if (settings.store.showNotifications) {
                            showNotification({
                                title: "🔗 Accroche - Bloqué",
                                body: "Vous ne pouvez pas changer de canal vocal car vous êtes accroché"
                            });
                        }
                        return;
                    }
                }

                return originalSelectVoiceChannel.call(this, channelId);
            };
        }

        if (settings.store.showNotifications) {
            showNotification({
                title: "🔗 Accroche activé",
                body: "Plugin d'accroche et d'ancrage d'utilisateurs activé - Vous reviendrez automatiquement dans le salon de la personne ancrée si vous êtes déplacé"
            });
        }
    },

    stop() {
        log("🛑 Plugin Accroche arrêté");

        // Arrêter la surveillance périodique
        stopAnchorMonitoring();

        // Restaurer la fonction originale
        if (originalSelectVoiceChannel && ChannelActions) {
            ChannelActions.selectVoiceChannel = originalSelectVoiceChannel;
            originalSelectVoiceChannel = null;
        }

        // Décrocher l'utilisateur s'il y en a un
        if (accrochedUserInfo) {
            decrocherUtilisateur();
        }

        // Désancrer l'utilisateur s'il y en a un
        if (anchoredUserInfo) {
            desancrerUtilisateur();
        }

        if (settings.store.showNotifications) {
            showNotification({
                title: "🔗 Accroche désactivé",
                body: "Plugin d'accroche et d'ancrage d'utilisateurs désactivé"
            });
        }
    }
});
