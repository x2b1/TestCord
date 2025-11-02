/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, sendBotMessage } from "@api/Commands";
import { DataStore } from "@api/index";
import definePlugin from "@utils/types";
import { ChannelStore, GuildRoleStore, GuildStore, RestAPI, showToast, Toasts } from "@webpack/common";

interface BackupRole {
    name: string;
    color: number;
    hoist: boolean;
    permissions: string;
    mentionable: boolean;
    position: number;
    id: string;
}

interface BackupChannel {
    name: string;
    type: number;
    topic?: string;
    nsfw: boolean;
    parent_id?: string;
    position: number;
    permission_overwrites: any[];
    id: string;
    rate_limit_per_user?: number;
    bitrate?: number;
    user_limit?: number;
}

interface ServerBackup {
    id: string;
    name: string;
    icon?: string;
    description?: string;
    roles: BackupRole[];
    channels: BackupChannel[];
    timestamp: number;
}

const BACKUP_STORE_KEY = "ServerBackup_Backups";

// Fonction pour sauvegarder un serveur
async function backupServer(guildId: string): Promise<string> {
    try {
        const guild = GuildStore.getGuild(guildId);
        if (!guild) {
            throw new Error("Serveur introuvable");
        }

        // Récupérer les rôles
        const roles = GuildRoleStore.getSortedRoles(guildId);
        const backupRoles: BackupRole[] = roles
            .filter((role: any) => role.name !== "@everyone")
            .map((role: any) => ({
                name: role.name,
                color: role.color,
                hoist: role.hoist,
                permissions: role.permissions,
                mentionable: role.mentionable,
                position: role.position,
                id: role.id
            }));

        // Récupérer TOUS les canaux (textuels, vocaux, catégories, etc.)
        const allChannels = ChannelStore.getMutableGuildChannelsForGuild(guildId);
        const backupChannels: BackupChannel[] = [];

        // Parcourir tous les canaux du serveur
        for (const [channelId, channelData] of Object.entries(allChannels)) {
            if (channelData && channelData.guild_id === guildId) {
                // Convertir permissionOverwrites de Record en Array
                const permOverwrites = channelData.permissionOverwrites
                    ? Object.values(channelData.permissionOverwrites)
                    : [];

                backupChannels.push({
                    name: channelData.name,
                    type: channelData.type,
                    topic: channelData.topic,
                    nsfw: channelData.nsfw,
                    parent_id: channelData.parent_id,
                    position: channelData.position,
                    permission_overwrites: permOverwrites,
                    id: channelData.id,
                    rate_limit_per_user: channelData.rateLimitPerUser,
                    bitrate: channelData.bitrate,
                    user_limit: channelData.userLimit
                });
            }
        }

        // Créer la sauvegarde
        const backup: ServerBackup = {
            id: guildId,
            name: guild.name,
            icon: guild.icon,
            description: guild.description,
            roles: backupRoles,
            channels: backupChannels,
            timestamp: Date.now()
        };

        // Sauvegarder dans DataStore
        const backups = await DataStore.get<Record<string, ServerBackup>>(BACKUP_STORE_KEY) || {};
        const backupKey = `${guild.name}_${Date.now()}`;
        backups[backupKey] = backup;
        await DataStore.set(BACKUP_STORE_KEY, backups);

        return backupKey;
    } catch (error) {
        console.error("[ServerBackup] Erreur lors de la sauvegarde:", error);
        throw error;
    }
}

// Fonction pour restaurer un serveur
async function restoreServer(backupKey: string, targetGuildId: string): Promise<void> {
    try {
        const guild = GuildStore.getGuild(targetGuildId);
        if (!guild) {
            throw new Error("Serveur cible introuvable");
        }

        // Récupérer la sauvegarde
        const backups = await DataStore.get<Record<string, ServerBackup>>(BACKUP_STORE_KEY);
        if (!backups || !backups[backupKey]) {
            throw new Error("Sauvegarde introuvable");
        }

        const backup = backups[backupKey];

        // ÉTAPE 1: Supprimer tous les canaux existants
        const existingChannels = ChannelStore.getMutableGuildChannelsForGuild(targetGuildId);
        let deletedChannels = 0;

        for (const [channelId, channel] of Object.entries(existingChannels)) {
            try {
                await RestAPI.del({
                    url: `/channels/${channelId}`
                });
                deletedChannels++;
                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (error) {
                console.error(`[ServerBackup] Erreur lors de la suppression du canal ${channel.name}:`, error);
            }
        }

        console.log(`[ServerBackup] ${deletedChannels} canaux supprimés`);

        // ÉTAPE 2: Supprimer tous les rôles existants (sauf @everyone)
        const existingRoles = GuildRoleStore.getSortedRoles(targetGuildId);
        let deletedRoles = 0;

        for (const role of existingRoles) {
            // Ne pas supprimer @everyone (l'id du rôle @everyone est égal à l'id du serveur)
            if (role.id === targetGuildId) continue;

            try {
                await RestAPI.del({
                    url: `/guilds/${targetGuildId}/roles/${role.id}`
                });
                deletedRoles++;
                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (error) {
                console.error(`[ServerBackup] Erreur lors de la suppression du rôle ${role.name}:`, error);
            }
        }

        console.log(`[ServerBackup] ${deletedRoles} rôles supprimés`);

        // ÉTAPE 3: Créer les nouveaux rôles
        const roleMapping: Record<string, string> = {};
        for (const role of backup.roles) {
            try {
                const { body } = await RestAPI.post({
                    url: `/guilds/${targetGuildId}/roles`,
                    body: {
                        name: role.name,
                        permissions: role.permissions,
                        color: role.color,
                        hoist: role.hoist,
                        mentionable: role.mentionable
                    }
                });
                roleMapping[role.id] = body.id;
                // Délai pour éviter le rate limit
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`[ServerBackup] Erreur lors de la création du rôle ${role.name}:`, error);
            }
        }

        // Créer les canaux (d'abord les catégories, puis les autres)
        const categories = backup.channels.filter(c => c.type === 4);
        const otherChannels = backup.channels.filter(c => c.type !== 4);
        const channelMapping: Record<string, string> = {};

        // Créer les catégories d'abord
        for (const channel of categories) {
            try {
                const permissionOverwrites = channel.permission_overwrites.map((overwrite: any) => ({
                    ...overwrite,
                    id: roleMapping[overwrite.id] || overwrite.id
                }));

                const { body } = await RestAPI.post({
                    url: `/guilds/${targetGuildId}/channels`,
                    body: {
                        name: channel.name,
                        type: channel.type,
                        permission_overwrites: permissionOverwrites
                    }
                });
                channelMapping[channel.id] = body.id;
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`[ServerBackup] Erreur lors de la création de la catégorie ${channel.name}:`, error);
            }
        }

        // Créer les autres canaux
        for (const channel of otherChannels) {
            try {
                const permissionOverwrites = channel.permission_overwrites.map((overwrite: any) => ({
                    ...overwrite,
                    id: roleMapping[overwrite.id] || overwrite.id
                }));

                const channelBody: any = {
                    name: channel.name,
                    type: channel.type,
                    permission_overwrites: permissionOverwrites,
                    parent_id: channelMapping[channel.parent_id!] || null
                };

                if (channel.topic) channelBody.topic = channel.topic;
                if (channel.nsfw !== undefined) channelBody.nsfw = channel.nsfw;
                if (channel.rate_limit_per_user) channelBody.rate_limit_per_user = channel.rate_limit_per_user;
                if (channel.bitrate) channelBody.bitrate = channel.bitrate;
                if (channel.user_limit) channelBody.user_limit = channel.user_limit;

                const { body } = await RestAPI.post({
                    url: `/guilds/${targetGuildId}/channels`,
                    body: channelBody
                });
                channelMapping[channel.id] = body.id;
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`[ServerBackup] Erreur lors de la création du canal ${channel.name}:`, error);
            }
        }

        showToast(Toasts.Type.SUCCESS, "✅ Serveur restauré avec succès!");
    } catch (error) {
        console.error("[ServerBackup] Erreur lors de la restauration:", error);
        throw error;
    }
}

// Fonction pour lister les sauvegardes
async function listBackups(): Promise<string[]> {
    const backups = await DataStore.get<Record<string, ServerBackup>>(BACKUP_STORE_KEY) || {};
    return Object.keys(backups);
}

export default definePlugin({
    name: "ServerBackup",
    description: "Sauvegarde et restaure la configuration complète d'un serveur Discord (rôles, canaux, permissions) - Aucune permission requise",
    authors: [{
        name: "Bash",
        id: 1327483363518582784n
    }],
    dependencies: ["CommandsAPI"],

    commands: [
        {
            name: "backup",
            description: "Gestion des sauvegardes de serveur",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "save",
                    description: "Sauvegarder la configuration d'un serveur",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [
                        {
                            name: "server_id",
                            description: "ID du serveur à sauvegarder (laisser vide pour le serveur actuel)",
                            type: ApplicationCommandOptionType.STRING,
                            required: false
                        }
                    ]
                },
                {
                    name: "restore",
                    description: "Restaurer une sauvegarde sur un serveur",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [
                        {
                            name: "backup_name",
                            description: "Nom de la sauvegarde à restaurer (utilisez /backup list pour voir les sauvegardes)",
                            type: ApplicationCommandOptionType.STRING,
                            required: true
                        },
                        {
                            name: "target_server_id",
                            description: "ID du serveur cible (laisser vide pour le serveur actuel)",
                            type: ApplicationCommandOptionType.STRING,
                            required: false
                        }
                    ]
                },
                {
                    name: "list",
                    description: "Lister toutes les sauvegardes disponibles",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: []
                },
                {
                    name: "delete",
                    description: "Supprimer une sauvegarde",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [
                        {
                            name: "backup_name",
                            description: "Nom de la sauvegarde à supprimer",
                            type: ApplicationCommandOptionType.STRING,
                            required: true
                        }
                    ]
                }
            ],
            execute: async (opts, ctx) => {
                try {
                    const subcommand = opts[0];
                    const subcommandName = subcommand.name;

                    if (subcommandName === "save") {
                        const serverIdOpt = subcommand.options?.find(opt => opt.name === "server_id");
                        const serverId = serverIdOpt?.value as string || ctx.guild?.id;

                        if (!serverId) {
                            sendBotMessage(ctx.channel.id, {
                                content: "❌ Vous devez spécifier un ID de serveur ou utiliser cette commande dans un serveur."
                            });
                            return;
                        }

                        sendBotMessage(ctx.channel.id, {
                            content: "⏳ Sauvegarde en cours..."
                        });

                        const backupKey = await backupServer(serverId);

                        sendBotMessage(ctx.channel.id, {
                            content: `✅ Sauvegarde créée avec succès!\n**Nom:** \`${backupKey}\`\n\nUtilisez \`/backup restore ${backupKey}\` pour restaurer cette sauvegarde.`
                        });
                    } else if (subcommandName === "restore") {
                        const backupNameOpt = subcommand.options?.find(opt => opt.name === "backup_name");
                        const targetServerIdOpt = subcommand.options?.find(opt => opt.name === "target_server_id");

                        const backupName = backupNameOpt?.value as string;
                        const targetServerId = targetServerIdOpt?.value as string || ctx.guild?.id;

                        if (!backupName) {
                            sendBotMessage(ctx.channel.id, {
                                content: "❌ Vous devez spécifier le nom de la sauvegarde."
                            });
                            return;
                        }

                        if (!targetServerId) {
                            sendBotMessage(ctx.channel.id, {
                                content: "❌ Vous devez spécifier un ID de serveur cible ou utiliser cette commande dans un serveur."
                            });
                            return;
                        }

                        sendBotMessage(ctx.channel.id, {
                            content: "⏳ Restauration en cours... Cela peut prendre plusieurs minutes selon la taille du serveur.\n⚠️ **ATTENTION:** Cette action va SUPPRIMER tous les rôles et canaux existants et les remplacer par ceux de la sauvegarde!"
                        });

                        await restoreServer(backupName, targetServerId);

                        sendBotMessage(ctx.channel.id, {
                            content: "✅ Serveur restauré avec succès!"
                        });
                    } else if (subcommandName === "list") {
                        const backupKeys = await listBackups();

                        if (backupKeys.length === 0) {
                            sendBotMessage(ctx.channel.id, {
                                content: "ℹ️ Aucune sauvegarde disponible.\n\nUtilisez `/backup save` pour créer une sauvegarde."
                            });
                            return;
                        }

                        const backups = await DataStore.get<Record<string, ServerBackup>>(BACKUP_STORE_KEY);
                        const backupList = backupKeys.map(key => {
                            const backup = backups![key];
                            const date = new Date(backup.timestamp);
                            return `**${key}**\n├ Serveur: ${backup.name}\n├ Rôles: ${backup.roles.length}\n├ Canaux: ${backup.channels.length}\n└ Date: ${date.toLocaleString()}`;
                        }).join("\n\n");

                        sendBotMessage(ctx.channel.id, {
                            content: `📦 **Sauvegardes disponibles:**\n\n${backupList}\n\nUtilisez \`/backup restore <nom>\` pour restaurer une sauvegarde.`
                        });
                    } else if (subcommandName === "delete") {
                        const backupNameOpt = subcommand.options?.find(opt => opt.name === "backup_name");
                        const backupName = backupNameOpt?.value as string;

                        if (!backupName) {
                            sendBotMessage(ctx.channel.id, {
                                content: "❌ Vous devez spécifier le nom de la sauvegarde."
                            });
                            return;
                        }

                        const backups = await DataStore.get<Record<string, ServerBackup>>(BACKUP_STORE_KEY);
                        if (!backups || !backups[backupName]) {
                            sendBotMessage(ctx.channel.id, {
                                content: `❌ Sauvegarde \`${backupName}\` introuvable.`
                            });
                            return;
                        }

                        delete backups[backupName];
                        await DataStore.set(BACKUP_STORE_KEY, backups);

                        sendBotMessage(ctx.channel.id, {
                            content: `✅ Sauvegarde \`${backupName}\` supprimée avec succès.`
                        });
                    }
                } catch (error) {
                    console.error("[ServerBackup] Erreur:", error);
                    const errorMessage = error instanceof Error ? error.message : "Une erreur s'est produite";
                    sendBotMessage(ctx.channel.id, {
                        content: `❌ **Erreur:** ${errorMessage}`
                    });
                }
            }
        }
    ],

    start() {
        console.log("[ServerBackup] Plugin démarré");
    },

    stop() {
        console.log("[ServerBackup] Plugin arrêté");
    }
});

