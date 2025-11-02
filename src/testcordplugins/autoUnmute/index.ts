import definePlugin from "@utils/types";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { UserStore, PermissionStore, PermissionsBits, ChannelStore } from "@webpack/common";
import { RestAPI, Constants } from "@webpack/common";
import { SelectedGuildStore } from "@webpack/common";

// Récupération des stores et actions nécessaires
const VoiceStateStore = findStoreLazy("VoiceStateStore");
const VoiceActions = findByPropsLazy("toggleSelfMute");

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

// Fonction pour démute un utilisateur via l'API Discord
async function unmuteUserViaAPI(userId: string, guildId: string): Promise<void> {
    try {
        console.log(`[AutoUnmute] Tentative de démute via API pour l'utilisateur ${userId} dans le serveur ${guildId}`);

        await RestAPI.patch({
            url: Constants.Endpoints.GUILD_MEMBER(guildId, userId),
            body: {
                mute: false
            }
        });

        console.log(`[AutoUnmute] Démute via API réussi pour l'utilisateur ${userId}`);
    } catch (error) {
        console.error(`[AutoUnmute] Erreur lors du démute via API:`, error);
        throw error;
    }
}

// Fonction pour désourdine un utilisateur via l'API Discord
async function undeafenUserViaAPI(userId: string, guildId: string): Promise<void> {
    try {
        console.log(`[AutoUnmute] Tentative de désourdine via API pour l'utilisateur ${userId} dans le serveur ${guildId}`);

        await RestAPI.patch({
            url: Constants.Endpoints.GUILD_MEMBER(guildId, userId),
            body: {
                deaf: false
            }
        });

        console.log(`[AutoUnmute] Désourdine via API réussi pour l'utilisateur ${userId}`);
    } catch (error) {
        console.error(`[AutoUnmute] Erreur lors du désourdine via API:`, error);
        throw error;
    }
}

export default definePlugin({
    name: "AutoUnmute",
    description: "Démute et désourdine automatiquement quand on se fait mute/sourdine serveur si on a les permissions (sans notifications)",
    authors: [{
        name: "Bash",
        id: 1327483363518582784n
    }],

    // Utilisation du système flux pour écouter les événements vocaux
    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            // Vérification de sécurité pour l'utilisateur actuel
            const currentUser = UserStore.getCurrentUser();
            if (!currentUser) {
                console.warn("[AutoUnmute] Utilisateur actuel non disponible");
                return;
            }

            const currentUserId = currentUser.id;

            // Traitement de chaque changement d'état vocal
            for (const state of voiceStates) {
                const { userId, channelId, guildId, mute, selfMute, deaf, selfDeaf } = state;

                // On ne s'intéresse qu'aux événements de l'utilisateur actuel
                if (userId !== currentUserId) continue;

                // Vérifier si on est dans un salon vocal
                if (!channelId || !guildId) continue;

                // Vérifier les permissions
                const channel = ChannelStore.getChannel(channelId);
                if (!channel) {
                    console.warn("[AutoUnmute] Canal non trouvé");
                    continue;
                }

                // Vérifier si on a été mute par le serveur (pas par soi-même)
                if (mute && !selfMute) {
                    console.log(`[AutoUnmute] Mute serveur détecté pour l'utilisateur ${currentUserId} dans le salon ${channelId}`);

                    // Vérifier si on a la permission MUTE_MEMBERS
                    const hasMutePermission = PermissionStore.can(PermissionsBits.MUTE_MEMBERS, channel);

                    if (hasMutePermission) {
                        console.log(`[AutoUnmute] Permission MUTE_MEMBERS détectée, démute automatique via API en cours...`);

                        // Démute automatiquement via l'API Discord
                        setTimeout(async () => {
                            try {
                                // Utiliser l'API Discord pour se démute via le serveur
                                await unmuteUserViaAPI(currentUserId, guildId);
                                console.log(`[AutoUnmute] Démute automatique via API effectué avec succès`);
                            } catch (error) {
                                console.error("[AutoUnmute] Erreur lors du démute automatique via API:", error);

                                // Fallback: essayer avec toggleSelfMute si l'API échoue
                                try {
                                    console.log(`[AutoUnmute] Tentative de fallback avec toggleSelfMute...`);
                                    VoiceActions.toggleSelfMute();
                                    console.log(`[AutoUnmute] Démute automatique via fallback effectué avec succès`);
                                } catch (fallbackError) {
                                    console.error("[AutoUnmute] Erreur lors du fallback:", fallbackError);
                                }
                            }
                        }, 100); // Petit délai pour éviter les conflits
                    } else {
                        console.log(`[AutoUnmute] Pas de permission MUTE_MEMBERS, pas de démute automatique`);
                    }
                }

                // Vérifier si on a été sourdine par le serveur (pas par soi-même)
                if (deaf && !selfDeaf) {
                    console.log(`[AutoUnmute] Sourdine serveur détectée pour l'utilisateur ${currentUserId} dans le salon ${channelId}`);

                    // Vérifier si on a la permission DEAFEN_MEMBERS
                    const hasDeafenPermission = PermissionStore.can(PermissionsBits.DEAFEN_MEMBERS, channel);

                    if (hasDeafenPermission) {
                        console.log(`[AutoUnmute] Permission DEAFEN_MEMBERS détectée, désourdine automatique via API en cours...`);

                        // Désourdine automatiquement via l'API Discord
                        setTimeout(async () => {
                            try {
                                // Utiliser l'API Discord pour se désourdine via le serveur
                                await undeafenUserViaAPI(currentUserId, guildId);
                                console.log(`[AutoUnmute] Désourdine automatique via API effectué avec succès`);
                            } catch (error) {
                                console.error("[AutoUnmute] Erreur lors du désourdine automatique via API:", error);

                                // Fallback: essayer avec toggleSelfDeaf si l'API échoue
                                try {
                                    console.log(`[AutoUnmute] Tentative de fallback avec toggleSelfDeaf...`);
                                    VoiceActions.toggleSelfDeaf();
                                    console.log(`[AutoUnmute] Désourdine automatique via fallback effectué avec succès`);
                                } catch (fallbackError) {
                                    console.error("[AutoUnmute] Erreur lors du fallback:", fallbackError);
                                }
                            }
                        }, 100); // Petit délai pour éviter les conflits
                    } else {
                        console.log(`[AutoUnmute] Pas de permission DEAFEN_MEMBERS, pas de désourdine automatique`);
                    }
                }
            }
        }
    },

    start() {
        console.log("[AutoUnmute] Plugin AutoUnmute initialisé");

        // Vérification que les stores sont disponibles
        if (!VoiceStateStore || !VoiceActions || !UserStore || !PermissionStore) {
            console.error("[AutoUnmute] Erreur : Stores Discord non disponibles");
            return;
        }
    },

    stop() {
        console.log("[AutoUnmute] Plugin AutoUnmute arrêté");
    }
});
