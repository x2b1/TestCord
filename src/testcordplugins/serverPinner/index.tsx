/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { showNotification } from "@api/Notifications";
import definePlugin, { OptionType } from "@utils/types";
import { findStoreLazy, findByPropsLazy } from "@webpack";
import { GuildStore, Menu, UserStore } from "@webpack/common";
import { Guild } from "discord-types/general";

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Activer le plugin Server Pinner",
        default: true
    },
    showNotifications: {
        type: OptionType.BOOLEAN,
        description: "Afficher les notifications lors des actions",
        default: true
    },
    pinnedServers: {
        type: OptionType.STRING,
        description: "Liste des serveurs épinglés (format JSON)",
        default: "[]"
    }
});

// Fonction de log avec préfixe
function log(message: string, level: "info" | "warn" | "error" = "info") {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[ServerPinner ${timestamp}]`;

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

// Fonction pour obtenir la liste des serveurs épinglés
function getPinnedServers(): string[] {
    try {
        const pinned = JSON.parse(settings.store.pinnedServers);
        return Array.isArray(pinned) ? pinned : [];
    } catch (error) {
        log(`Erreur lors du parsing des serveurs épinglés: ${error}`, "error");
        return [];
    }
}

// Fonction pour sauvegarder la liste des serveurs épinglés
function savePinnedServers(pinnedServers: string[]) {
    try {
        settings.store.pinnedServers = JSON.stringify(pinnedServers);
        log(`Serveurs épinglés sauvegardés: ${pinnedServers.length} serveur(s)`);
    } catch (error) {
        log(`Erreur lors de la sauvegarde des serveurs épinglés: ${error}`, "error");
    }
}

// Fonction pour vérifier si un serveur est épinglé
function isServerPinned(guildId: string): boolean {
    const pinnedServers = getPinnedServers();
    return pinnedServers.includes(guildId);
}

// Fonction pour épingler un serveur
function pinServer(guildId: string) {
    const pinnedServers = getPinnedServers();
    if (!pinnedServers.includes(guildId)) {
        pinnedServers.unshift(guildId); // Ajouter au début pour l'ordre
        savePinnedServers(pinnedServers);

        log(`Serveur ${guildId} épinglé`);

        if (settings.store.showNotifications) {
            showNotification({
                title: "📌 Serveur épinglé",
                body: "Le serveur a été ajouté aux serveurs épinglés",
                icon: undefined
            });
        }
    }
}

// Fonction pour dépingler un serveur
function unpinServer(guildId: string) {
    const pinnedServers = getPinnedServers();
    const index = pinnedServers.indexOf(guildId);
    if (index !== -1) {
        pinnedServers.splice(index, 1);
        savePinnedServers(pinnedServers);

        log(`Serveur ${guildId} dépinglé`);

        if (settings.store.showNotifications) {
            showNotification({
                title: "📌 Serveur dépinglé",
                body: "Le serveur a été retiré des serveurs épinglés",
                icon: undefined
            });
        }
    }
}

// Patch du menu contextuel des serveurs
const ServerContextMenuPatch: NavContextMenuPatchCallback = (children, { guild }: { guild: Guild; }) => {
    if (!settings.store.enabled || !guild) return;

    const isPinned = isServerPinned(guild.id);
    const group = findGroupChildrenByChildId("privacy", children);

    if (group) {
        group.push(
            <Menu.MenuSeparator />,
            <Menu.MenuItem
                id="vc-toggle-server-pin"
                label={isPinned ? "📌 Dépingler ce serveur" : "📌 Épingler ce serveur"}
                action={() => {
                    if (isPinned) {
                        unpinServer(guild.id);
                    } else {
                        pinServer(guild.id);
                    }
                }}
            />
        );
    }
};

export default definePlugin({
    name: "Server Pinner",
    description: "Permet d'épingler des serveurs via le menu contextuel. La catégorie dédiée sera ajoutée dans une future mise à jour.",
    authors: [{
        name: "Bash",
        id: 1327483363518582784n
    }],
    dependencies: ["ContextMenuAPI"],
    settings,

    contextMenus: {
        "guild-context": ServerContextMenuPatch
    },

    start() {
        log("🚀 Plugin Server Pinner démarré");

        const pinnedCount = getPinnedServers().length;
        if (pinnedCount > 0) {
            log(`${pinnedCount} serveur(s) épinglé(s) chargé(s)`);
        }

        if (settings.store.showNotifications) {
            showNotification({
                title: "📌 Server Pinner activé",
                body: "Clic droit sur un serveur pour l'épingler",
                icon: undefined
            });
        }
    },

    stop() {
        log("🛑 Plugin Server Pinner arrêté");
    }
});
