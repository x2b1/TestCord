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
        default: false
    },
    showNotifications: {
        type: OptionType.BOOLEAN,
        description: "Afficher les notifications lors de la sortie automatique",
        default: true
    },
    verboseLogs: {
        type: OptionType.BOOLEAN,
        description: "Show detailed logs in the console",
        default: false
    },
    delay: {
        type: OptionType.NUMBER,
        description: "Delay before leaving the group (in milliseconds)",
        default: 1000,
        min: 100,
        max: 10000
    },
    whitelist: {
        type: OptionType.STRING,
        description: "Allowed user IDs (comma-separated)",
        default: ""
    },
    autoReply: {
        type: OptionType.BOOLEAN,
        description: "Envoyer un message automatique avant de quitter",
        default: true
    },
    replyMessage: {
        type: OptionType.STRING,
        description: "Message to send before leaving",
        default: "I do not wish to be added to groups. Please contact me privately."
    }
});

function log(message: string, level: "info" | "warn" | "error" = "info") {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[AntiGroup ${timestamp}]`;
    switch (level) {
        case "warn": console.warn(prefix, message); break;
        case "error": console.error(prefix, message); break;
        default: console.log(prefix, message);
    }
}

function verboseLog(message: string) {
    if (settings.store.verboseLogs) log(message);
}

async function leaveGroupDM(channelId: string) {
    try {
        const channel = ChannelStore.getChannel(channelId);
        const channelName = channel?.name || "Groupe sans nom";


        if (settings.store.autoReply && settings.store.replyMessage.trim()) {
            try {
                await RestAPI.post({
                    url: Constants.Endpoints.MESSAGES(channelId),
                    body: { content: settings.store.replyMessage }
                });
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (msgError) {
                log(`❌ Error lors de l'envoi du message automatique: ${msgError}`, "error");
            }
        }

        await RestAPI.del({ url: Constants.Endpoints.CHANNEL(channelId) });

        if (settings.store.showNotifications) {
            showNotification({
                title: "🛡️ AntiGroup - Group left",
                body: `Vous avez automatiquement quitté le groupe "${channelName}"`,
                icon: undefined
            });
        }
    } catch (error) {
        const channel = ChannelStore.getChannel(channelId);
        const channelName = channel?.name || "Groupe inconnu";
        log(`❌ ERREUR lors de la sortie du groupe "${channelName}" (${channelId}): ${error}`, "error");
        if (settings.store.showNotifications) {
            showNotification({
                title: "❌ AntiGroup - Error",
                body: `Impossible de quitter automatiquement le groupe "${channelName}"`,
                icon: undefined
            });
        }
    }
}

function isUserWhitelisted(userId: string): boolean {
    const whitelist = settings.store.whitelist
        .split(",")
        .map(id => id.trim())
        .filter(id => id.length > 0);
    return whitelist.includes(userId);
}

function wasRecentlyAdded(channel: any, currentUserId: string): boolean {
    if (channel.type !== 3) return false;
    return channel.ownerId !== currentUserId;
}

export default definePlugin({
    name: "AntiGroup",
    enabledByDefault: false,
    description: "Automatically leaves group DMs as soon as you're added",
    authors: [{ name: "Bash", id: 1327483363518582784n }],
    settings,

    flux: {
        CHANNEL_CREATE(event: { channel: any; }) {
            if (!settings.store.enabled) return;

            const { channel } = event;
            const currentUserId = UserStore.getCurrentUser()?.id;
            if (!channel || !currentUserId) return;
            if (channel.type !== 3) return;
            if (!wasRecentlyAdded(channel, currentUserId)) return;

            if (channel.ownerId && isUserWhitelisted(channel.ownerId)) return;

            const whitelistedMember = channel.recipients?.find((recipient: any) =>
                isUserWhitelisted(recipient.id)
            );
            if (whitelistedMember) return;

            if (settings.store.showNotifications) {
                showNotification({
                    title: "🚨 AntiGroup - Groupe detected",
                    body: `Ajouté au groupe "${channel.name || "Sans nom"}" - Sortie automatique dans ${settings.store.delay / 1000}s`,
                    icon: undefined
                });
            }

            setTimeout(() => leaveGroupDM(channel.id), settings.store.delay);
        }
    },

    start() {
        log(`[AntiGroup] Plugin démarré`);
    },

    stop() {
        log(`[AntiGroup] Plugin arrêté`);
    }
});
