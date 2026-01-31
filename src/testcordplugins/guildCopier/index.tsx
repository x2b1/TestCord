/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { TestcordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findByCodeLazy } from "@webpack";
import {
    ChannelStore,
    Constants,
    EmojiStore,
    GuildRoleStore,
    GuildStore,
    Menu,
    PermissionsBits,
    PermissionStore,
    RestAPI,
    showToast,
    StickersStore,
    Toasts,
    UserStore,
} from "@webpack/common";

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

interface BackupEmote {
    name: string;
    id: string;
    animated: boolean;
    url: string;
}

interface BackupSticker {
    name: string;
    id: string;
    format_type: number;
    url: string;
    tags: string;
    description: string;
}

const uploadEmoji = findByCodeLazy(".GUILD_EMOJIS(", "EMOJI_UPLOAD_START");

const StickerExtMap = {
    1: "png",
    2: "png",
    3: "json",
    4: "gif"
} as const;

const MAX_EMOJI_SIZE_BYTES = 256 * 1024;
const MAX_STICKER_SIZE_BYTES = 512 * 1024;

async function fetchBlob(url: string, maxSize: number) {
    for (let size = 4096; size >= 16; size /= 2) {
        const res = await fetch(`${url}?size=${size}&lossless=true&animated=true`);
        if (!res.ok)
            throw new Error(`Failed to fetch ${url} - ${res.status}`);

        const blob = await res.blob();
        if (blob.size <= maxSize)
            return blob;
    }

    throw new Error(`Failed to fetch within size limit of ${maxSize / 1000}kB`);
}

async function cloneSticker(guildId: string, sticker: BackupSticker) {
    const data = new FormData();
    data.append("name", sticker.name);
    data.append("tags", sticker.tags);
    data.append("description", sticker.description);
    data.append("file", await fetchBlob(sticker.url, MAX_STICKER_SIZE_BYTES));

    await RestAPI.post({
        url: Constants.Endpoints.GUILD_STICKER_PACKS(guildId),
        body: data,
    });
}

async function cloneEmoji(guildId: string, emoji: BackupEmote) {
    const data = await fetchBlob(emoji.url, MAX_EMOJI_SIZE_BYTES);

    const dataUrl = await new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(data);
    });

    return uploadEmoji({
        guildId,
        name: emoji.name,
        image: dataUrl
    });
}

async function copyGuild(guildId: string): Promise<void> {
    try {
        const guild = GuildStore.getGuild(guildId);
        if (!guild) {
            throw new Error("Guild not found");
        }

        // Check permissions
        const currentUser = UserStore.getCurrentUser();
        if (guild.ownerId !== currentUser.id && !PermissionStore.can(PermissionsBits.MANAGE_GUILD, guild)) {
            showToast("You don't have permission to copy this guild", Toasts.Type.FAILURE);
            return;
        }

        showToast("Starting guild copy process...", Toasts.Type.SUCCESS);

        // Get roles
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
                id: role.id,
            }));

        // Get channels
        const allChannels = ChannelStore.getMutableGuildChannelsForGuild(guildId);
        const backupChannels: BackupChannel[] = [];

        for (const [channelId, channelData] of Object.entries(allChannels)) {
            if (channelData && channelData.guild_id === guildId) {
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
                    user_limit: channelData.userLimit,
                });
            }
        }

        // Get emotes (limit to 50 PNG and 50 GIF as per free limits)
        const allEmotes = EmojiStore.getGuildEmoji(guildId) || [];
        const pngEmotes = allEmotes.filter((emote: any) => !emote.animated);
        const gifEmotes = allEmotes.filter((emote: any) => emote.animated);

        // Take up to 50 of each type
        const selectedPngEmotes = pngEmotes.slice(0, 50);
        const selectedGifEmotes = gifEmotes.slice(0, 50);

        const backupEmotes: BackupEmote[] = [...selectedPngEmotes, ...selectedGifEmotes].map((emote: any) => ({
            name: emote.name,
            id: emote.id,
            animated: emote.animated,
            url: `https://cdn.discordapp.com/emojis/${emote.id}.${emote.animated ? "gif" : "png"}`,
        }));

        // Get stickers (limit to 5 random stickers)
        const allStickers = StickersStore.getStickersByGuildId(guildId) || [];
        // Shuffle and take up to 5 stickers
        const shuffledStickers = allStickers.sort(() => 0.5 - Math.random());
        const selectedStickers = shuffledStickers.slice(0, 5);

        const backupStickers: BackupSticker[] = selectedStickers.map((sticker: any) => ({
            name: sticker.name,
            id: sticker.id,
            format_type: sticker.format_type,
            url: `https://media.discordapp.net/stickers/${sticker.id}.${StickerExtMap[sticker.format_type]}`,
            tags: sticker.tags,
            description: sticker.description,
        }));

        // Create new guild
        const { body: newGuild } = await RestAPI.post({
            url: "/guilds",
            body: {
                name: `${guild.name} (Copy)`,
                icon: guild.icon,
                description: guild.description,
            },
        });

        const newGuildId = newGuild.id;
        showToast(`Created new guild: ${newGuild.name}`, Toasts.Type.SUCCESS);

        // Copy roles
        const roleMapping: Record<string, string> = {};
        for (const role of backupRoles) {
            try {
                const { body } = await RestAPI.post({
                    url: `/guilds/${newGuildId}/roles`,
                    body: {
                        name: role.name,
                        permissions: role.permissions,
                        color: role.color,
                        hoist: role.hoist,
                        mentionable: role.mentionable,
                    },
                });
                roleMapping[role.id] = body.id;
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`Error creating role ${role.name}:`, error);
            }
        }

        // Copy channels (categories first, then others)
        const categories = backupChannels.filter(c => c.type === 4);
        const otherChannels = backupChannels.filter(c => c.type !== 4);
        const channelMapping: Record<string, string> = {};

        // Create categories first
        for (const channel of categories) {
            try {
                const permissionOverwrites = channel.permission_overwrites.map(
                    (overwrite: any) => ({
                        ...overwrite,
                        id: roleMapping[overwrite.id] || overwrite.id,
                    })
                );

                const { body } = await RestAPI.post({
                    url: `/guilds/${newGuildId}/channels`,
                    body: {
                        name: channel.name,
                        type: channel.type,
                        permission_overwrites: permissionOverwrites,
                    },
                });
                channelMapping[channel.id] = body.id;
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`Error creating category ${channel.name}:`, error);
            }
        }

        // Create other channels
        for (const channel of otherChannels) {
            try {
                const permissionOverwrites = channel.permission_overwrites.map(
                    (overwrite: any) => ({
                        ...overwrite,
                        id: roleMapping[overwrite.id] || overwrite.id,
                    })
                );

                const channelBody: any = {
                    name: channel.name,
                    type: channel.type,
                    permission_overwrites: permissionOverwrites,
                    parent_id: channelMapping[channel.parent_id!] || null,
                };

                if (channel.topic) channelBody.topic = channel.topic;
                if (channel.nsfw !== undefined) channelBody.nsfw = channel.nsfw;
                if (channel.rate_limit_per_user)
                    channelBody.rate_limit_per_user = channel.rate_limit_per_user;
                if (channel.bitrate) channelBody.bitrate = channel.bitrate;
                if (channel.user_limit) channelBody.user_limit = channel.user_limit;

                const { body } = await RestAPI.post({
                    url: `/guilds/${newGuildId}/channels`,
                    body: channelBody,
                });
                channelMapping[channel.id] = body.id;
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`Error creating channel ${channel.name}:`, error);
            }
        }

        // Copy emotes
        for (const emote of backupEmotes) {
            try {
                await cloneEmoji(newGuildId, emote);
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`Error creating emote ${emote.name}:`, error);
            }
        }

        // Copy stickers
        for (const sticker of backupStickers) {
            try {
                await cloneSticker(newGuildId, sticker);
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`Error creating sticker ${sticker.name}:`, error);
            }
        }

        showToast("Guild copy completed successfully!", Toasts.Type.SUCCESS);
    } catch (error) {
        console.error("[GuildCopier] Error during guild copy:", error);
        const errorMessage = error instanceof Error ? error.message : "An error occurred";
        showToast(`Error copying guild: ${errorMessage}`, Toasts.Type.FAILURE);
    }
}

const ctxMenuPatch: NavContextMenuPatchCallback = (children, props) => {
    if (!props.guild) return;

    children.splice(1, 0,
        <Menu.MenuItem
            id="vc-guild-copy"
            label="Copy Guild"
            action={() => copyGuild(props.guild.id)}
        />
    );
};

export default definePlugin({
    name: "GuildCopier",
    description: "Copy an entire guild including channels, roles, permissions, emotes, stickers, and categories to create a new identical guild.",
    authors: [TestcordDevs.x2b],
    dependencies: [],

    contextMenus: {
        "guild-context": ctxMenuPatch,
    },
});
