/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { showNotification } from "@api/Notifications";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { Menu, React, VoiceStateStore, RestAPI, SelectedGuildStore, Constants } from "@webpack/common";
import definePlugin, { OptionType } from "@utils/types";
import { User, VoiceState } from "@vencord/discord-types";

type TLeashedUserInfo = {
    userId: string;
    lastChannelId: string | null;
} | null;

interface UserContextProps {
    channel: any;
    user: User;
    guildId?: string;
}

let leashedUserInfo: TLeashedUserInfo = null;
let myLastChannelId: string | null = null;

const ChannelActions = findByPropsLazy("selectChannel", "selectVoiceChannel");
const UserStore = findStoreLazy("UserStore");
const SelectedChannelStore = findStoreLazy("SelectedChannelStore");

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Activer le plugin laisse"
    },
    onlyWhenInVoice: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Ne déplacer l'utilisateur que quand vous êtes dans un canal vocal"
    },
    showNotifications: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Afficher les notifications lors des déplacements"
    }
});

// Fonction pour déplacer un utilisateur vers un canal vocal
async function moveUserToVoiceChannel(userId: string, channelId: string): Promise<void> {
    const guildId = SelectedGuildStore.getGuildId();
    if (!guildId) {
        throw new Error("Aucun serveur sélectionné");
    }

    try {
        // Utiliser l'API Discord pour déplacer l'utilisateur
        await RestAPI.patch({
            url: Constants.Endpoints.GUILD_MEMBER(guildId, userId),
            body: {
                channel_id: channelId
            }
        });

        if (settings.store.showNotifications) {
            const user = UserStore.getUser(userId);
            showNotification({
                title: "laisse - Succès",
                body: `${user?.username || "L'utilisateur"} a été déplacé vers votre canal vocal`
            });
        }
    } catch (error) {
        console.error("laisse: Erreur API Discord:", error);
        throw error;
    }
}

const UserContextMenuPatch: NavContextMenuPatchCallback = (children, { channel, user }: UserContextProps) => {
    if (UserStore.getCurrentUser().id === user.id) return;

    const [checked, setChecked] = React.useState(leashedUserInfo?.userId === user.id);

    children.push(
        <Menu.MenuSeparator />,
        <Menu.MenuCheckboxItem
            id="laisse-leash-user"
            label="laisse - Accrocher l'utilisateur"
            checked={checked}
            action={() => {
                if (leashedUserInfo?.userId === user.id) {
                    leashedUserInfo = null;
                    setChecked(false);
                    showNotification({
                        title: "laisse",
                        body: `L'utilisateur ${user.username} n'est plus accroché`
                    });
                    return;
                }

                leashedUserInfo = {
                    userId: user.id,
                    lastChannelId: null
                };
                setChecked(true);
                showNotification({
                    title: "laisse",
                    body: `L'utilisateur ${user.username} est maintenant accroché à vous`
                });
            }}
        />
    );
};

export default definePlugin({
    name: "laisse",
    description: "Accroche un utilisateur à vous en le déplaçant automatiquement dans le canal vocal où vous allez",
    authors: [{ name: "Bash", id: 1327483363518582784n }],
    settings,
    contextMenus: {
        "user-context": UserContextMenuPatch
    },
    flux: {
        async VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            if (!leashedUserInfo || !settings.store.enabled) return;

            const myId = UserStore.getCurrentUser().id;
            const myCurrentChannelId = SelectedChannelStore.getVoiceChannelId();

            // Vérifier si on doit seulement agir quand on est en vocal
            if (settings.store.onlyWhenInVoice && !myCurrentChannelId) return;

            for (const voiceState of voiceStates) {
                // Détecter quand l'utilisateur actuel change de canal vocal
                if (voiceState.userId === myId && voiceState.channelId !== myLastChannelId) {
                    myLastChannelId = voiceState.channelId;

                    // Si on a un utilisateur accroché et qu'on rejoint un canal vocal
                    if (voiceState.channelId && leashedUserInfo.userId) {
                        const leashedUserVoiceState = VoiceStateStore.getVoiceStateForUser(leashedUserInfo.userId);

                        // Si l'utilisateur accroché est dans un canal vocal différent
                        if (leashedUserVoiceState && leashedUserVoiceState.channelId !== voiceState.channelId) {
                            try {
                                // Essayer de déplacer l'utilisateur accroché vers notre canal
                                // Note: Cette fonctionnalité nécessite des permissions de modération
                                const user = UserStore.getUser(leashedUserInfo.userId);

                                if (settings.store.showNotifications) {
                                    showNotification({
                                        title: "laisse",
                                        body: `Tentative de déplacement de ${user?.username || "l'utilisateur"} vers votre canal vocal`
                                    });
                                }

                                // Utiliser l'API Discord pour déplacer l'utilisateur
                                await moveUserToVoiceChannel(leashedUserInfo.userId, voiceState.channelId);

                            } catch (error) {
                                console.error("laisse: Erreur lors du déplacement:", error);
                                if (settings.store.showNotifications) {
                                    showNotification({
                                        title: "laisse - Erreur",
                                        body: "Impossible de déplacer l'utilisateur (permissions insuffisantes)"
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    start() {
        myLastChannelId = SelectedChannelStore.getVoiceChannelId();
    },
    stop() {
        leashedUserInfo = null;
        myLastChannelId = null;
    }
});
