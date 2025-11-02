/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { ChannelStore, FluxDispatcher, showToast, Toasts, Menu } from "@webpack/common";
import { Channel } from "discord-types/general";

// Trouver ChannelActionCreators pour fermer les DMs
const ChannelActionCreators = findByPropsLazy("openPrivateChannel", "closePrivateChannel");

// Utiliser PrivateChannelSortStore comme dans pinDms
const PrivateChannelSortStore = findStoreLazy("PrivateChannelSortStore") as { getPrivateChannelIds: () => string[]; };

// Fonction pour fermer un DM avec rate limite
async function closeDMWithDelay(channelId: string, delay: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(() => {
            try {
                const channel = ChannelStore.getChannel(channelId);

                // Vérifier que c'est un DM privé (type 1) et non un groupe (type 3)
                if (channel && channel.type === 1) {
                    // Utiliser ChannelActionCreators.closePrivateChannel si disponible
                    if (ChannelActionCreators?.closePrivateChannel) {
                        ChannelActionCreators.closePrivateChannel(channelId);
                    } else {
                        // Fallback: utiliser FluxDispatcher
                        FluxDispatcher.dispatch({
                            type: "CHANNEL_DELETE",
                            channel: {
                                id: channelId,
                                type: 1
                            }
                        });
                    }
                }
            } catch (err) {
                console.error(`Erreur lors de la fermeture du DM ${channelId}:`, err);
            }
            resolve();
        }, delay);
    });
}

async function closeAllDMs() {
    try {
        // Obtenir tous les canaux privés via PrivateChannelSortStore
        const privateChannelIds = PrivateChannelSortStore.getPrivateChannelIds();

        let closedCount = 0;
        const dmsToClose: string[] = [];

        // Filtrer les DMs à fermer (seulement les DMs privés, pas les groupes)
        privateChannelIds.forEach((channelId: string) => {
            const channel = ChannelStore.getChannel(channelId);

            // Vérifier que c'est un DM privé (type 1) et non un groupe (type 3)
            if (channel && channel.type === 1) {
                dmsToClose.push(channelId);
            }
        });

        if (dmsToClose.length === 0) {
            showToast(Toasts.Type.MESSAGE, "ℹ️ Aucun DM à fermer");
            return;
        }

        // Fermer les DMs avec une rate limite de 50ms
        for (let i = 0; i < dmsToClose.length; i++) {
            await closeDMWithDelay(dmsToClose[i], i * 50); // 50ms de délai entre chaque fermeture
            closedCount++;
        }

        // Notification de succès
        showToast(Toasts.Type.SUCCESS, `✅ ${closedCount} DM(s) fermé(s) avec rate limite de 50ms`);

    } catch (error) {
        console.error("Erreur lors de la fermeture des DMs:", error);
        showToast(Toasts.Type.FAILURE, "❌ Erreur lors de la fermeture des DMs");
    }
}

// Menu contextuel pour les DMs de groupe
const GroupDMContextMenuPatch: NavContextMenuPatchCallback = (children, props) => {
    const container = findGroupChildrenByChildId("leave-channel", children);

    if (container) {
        container.push(
            <Menu.MenuItem
                id="vc-close-all-dms"
                label="Fermer tous les DMs"
                action={closeAllDMs}
            />
        );
    }
};

// Menu contextuel pour les utilisateurs
const UserContextMenuPatch: NavContextMenuPatchCallback = (children, props) => {
    const container = findGroupChildrenByChildId("close-dm", children);

    if (container) {
        container.push(
            <Menu.MenuItem
                id="vc-close-all-dms-user"
                label="Fermer tous les DMs"
                action={closeAllDMs}
            />
        );
    }
};

// Menu contextuel pour les serveurs
const ServerContextMenuPatch: NavContextMenuPatchCallback = (children, props) => {
    const group = findGroupChildrenByChildId("privacy", children);

    if (group) {
        group.push(
            <Menu.MenuItem
                id="vc-close-all-dms-server"
                label="Fermer tous les DMs"
                action={closeAllDMs}
            />
        );
    }
};

export default definePlugin({
    name: "CloseAllDms",
    description: "Ferme tous les DMs privés d'un seul clic avec rate limite de 50ms (préserve les groupes)",
    authors: [Devs.BigDuck],

    contextMenus: {
        "gdm-context": GroupDMContextMenuPatch,
        "user-context": UserContextMenuPatch,
        "guild-context": ServerContextMenuPatch
    }
});
