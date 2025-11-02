/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Message } from "@vencord/discord-types";
import { ChannelStore, GuildStore, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    translateUserIds: {
        type: OptionType.BOOLEAN,
        description: "Convertir les IDs d'utilisateurs en mentions @ cliquables",
        default: true
    },
    translateChannelIds: {
        type: OptionType.BOOLEAN,
        description: "Convertir les IDs de canaux en r?f?rences # cliquables",
        default: true
    },
    translateRoleIds: {
        type: OptionType.BOOLEAN,
        description: "Convertir les IDs de r?les en mentions @& cliquables",
        default: true
    },
    translateMessageIds: {
        type: OptionType.BOOLEAN,
        description: "Convertir les IDs de messages en liens cliquables",
        default: false
    },
    translateOwnMessages: {
        type: OptionType.BOOLEAN,
        description: "Traduire les IDs dans vos propres messages envoyés",
        default: false
    },
    minIdLength: {
        type: OptionType.NUMBER,
        description: "Longueur minimale des IDs ? convertir (Discord: 17-19 chiffres)",
        default: 17
    },
    maxIdLength: {
        type: OptionType.NUMBER,
        description: "Longueur maximale des IDs ? convertir",
        default: 19
    }
});

// Regex pour d?tecter les IDs Discord (nombres de 17-19 chiffres g?n?ralement)
function createIdRegex(minLength: number, maxLength: number): RegExp {
    return new RegExp(`\\b\\d{${minLength},${maxLength}}\\b`, "g");
}

// V?rifier si un ID correspond ? un utilisateur
function isUserId(id: string): boolean {
    try {
        const user = UserStore.getUser(id);
        return user !== undefined && user !== null;
    } catch {
        return false;
    }
}

// V?rifier si un ID correspond ? un canal
function isChannelId(id: string): boolean {
    try {
        const channel = ChannelStore.getChannel(id);
        return channel !== undefined && channel !== null;
    } catch {
        return false;
    }
}

// V?rifier si un ID correspond ? un r?le (via le canal actuel)
function isRoleId(id: string, channelId?: string): boolean {
    if (!channelId) return false;
    try {
        const channel = ChannelStore.getChannel(channelId);
        if (!channel?.guild_id) return false;

        const guild = GuildStore.getGuild(channel.guild_id);
        if (!guild) return false;

        // V?rifier si le r?le existe dans le serveur
        return guild.roles?.[id] !== undefined;
    } catch {
        return false;
    }
}

// V?rifier si un ID est d?j? dans une mention Discord ou une URL
function isIdInContext(content: string, id: string, index: number): boolean {
    // V?rifier le contexte avant l'ID
    const beforeStart = Math.max(0, index - 5);
    const before = content.substring(beforeStart, index);

    // V?rifier le contexte apr?s l'ID
    const afterEnd = Math.min(content.length, index + id.length + 5);
    const after = content.substring(index + id.length, afterEnd);

    // Ignorer si l'ID fait partie d'une mention Discord existante
    if (before.includes("<@") || before.includes("<#") || before.includes("<@&")) {
        return true;
    }

    // Ignorer si l'ID fait partie d'une URL
    if (before.match(/[:\/\.]/) || after.match(/[:\/\.]/)) {
        return true;
    }

    // Ignorer si l'ID est pr?c?d? ou suivi par @ ou #
    if (before.endsWith("@") || before.endsWith("#") || after.startsWith("@") || after.startsWith("#")) {
        return true;
    }

    return false;
}

// Fonction principale pour traduire les IDs en mentions cliquables
function translateIds(content: string, channelId?: string): string {
    if (!content) return content;

    const { translateUserIds, translateChannelIds, translateRoleIds, translateMessageIds, minIdLength, maxIdLength } = settings.store;

    if (!translateUserIds && !translateChannelIds && !translateRoleIds && !translateMessageIds) {
        return content;
    }

    const idRegex = createIdRegex(minIdLength, maxIdLength);
    let translatedContent = content;
    const processedIds = new Map<string, string>(); // ID -> replacement

    // Trouver tous les IDs et d?terminer leurs remplacements
    let match;
    const idMatches: Array<{ id: string; index: number; }> = [];

    while ((match = idRegex.exec(content)) !== null) {
        const id = match[0];
        const index = match.index;

        // V?rifier si l'ID est dans un contexte sp?cial
        if (isIdInContext(content, id, index)) {
            continue;
        }

        // ?viter les doublons
        if (processedIds.has(id)) {
            continue;
        }

        // D?terminer le type d'ID et le remplacement appropri?
        let replacement: string | null = null;

        if (translateUserIds && isUserId(id)) {
            replacement = `<@${id}>`;
        } else if (translateChannelIds && isChannelId(id)) {
            replacement = `<#${id}>`;
        } else if (translateRoleIds && channelId && isRoleId(id, channelId)) {
            replacement = `<@&${id}>`;
        } else if (translateMessageIds && channelId) {
            // Pour les messages, cr?er un lien Discord
            const channel = ChannelStore.getChannel(channelId);
            if (channel?.guild_id) {
                replacement = `https://discord.com/channels/${channel.guild_id}/${channelId}/${id}`;
            } else {
                // DM
                replacement = `https://discord.com/channels/@me/${channelId}/${id}`;
            }
        }

        if (replacement) {
            processedIds.set(id, replacement);
            idMatches.push({ id, index });
        }
    }

    // Remplacer les IDs de la fin vers le d?but pour pr?server les indices
    idMatches.reverse().forEach(({ id, index }) => {
        const replacement = processedIds.get(id);
        if (replacement) {
            translatedContent = translatedContent.substring(0, index) + replacement + translatedContent.substring(index + id.length);
        }
    });

    return translatedContent;
}

// Fonction pour modifier les messages entrants
function modifyIncomingMessage(message: Message): string {
    if (!message.content) return message.content || "";

    // Vérifier si le message vient de l'utilisateur actuel
    const currentUser = UserStore.getCurrentUser();
    const messageAuthor = message.author;
    const isOwnMessage = currentUser?.id && messageAuthor?.id && messageAuthor.id === currentUser.id;

    // Ne pas modifier les messages de l'utilisateur actuel sauf si l'option est activée
    if (isOwnMessage && !settings.store.translateOwnMessages) {
        return message.content;
    }

    // Ne pas modifier les messages qui contiennent d?j? des mentions Discord
    // pour ?viter les doublons (sauf si c'est juste un lien de message)
    if (message.content.includes("<@") || message.content.includes("<#")) {
        return message.content;
    }

    return translateIds(message.content, message.channel_id);
}

export default definePlugin({
    name: "ID Translater",
    description: "Traduit automatiquement les IDs Discord en mentions @ ou r?f?rences # cliquables",
    authors: [{ name: "Bash", id: 1327483363518582784n }],
    isModified: true,

    settings,
    modifyIncomingMessage,

    patches: [
        {
            find: "!1,hideSimpleEmbedContent",
            replacement: {
                match: /(let{toAST:.{0,125}?)\(null!=\i\?\i:\i\).content/,
                replace: "const idTranslaterContent=$self.modifyIncomingMessage(arguments[2]?.contentMessage??arguments[1]);$1idTranslaterContent"
            }
        }
    ],

    start() {
        console.log("[ID Translater] Plugin demarre - Conversion automatique des IDs activee");
    },

    stop() {
        console.log("[ID Translater] Plugin arrete");
    }
});
