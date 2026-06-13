/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findByCodeLazy } from "@webpack";
import {
    ChannelStore,
    EmojiStore,
    GuildMemberStore,
    GuildRoleStore,
    GuildStore,
    RestAPI,
    StickersStore,
    UserStore,
} from "@webpack/common";

type AnyGuild = {
    id: string;
    name: string;
    ownerId?: string;
    icon?: string;
    description?: string;
    verificationLevel?: number;
    defaultMessageNotifications?: number;
    explicitContentFilter?: number;
    afkTimeout?: number;
    [k: string]: any;
};

export interface CopyTarget {
    kind: "new" | "existing";
    name?: string;
    guildId?: string;
}

export interface CopyInclude {
    roles: boolean;
    channels: boolean;
    emojis: boolean;
    stickers: boolean;
    webhooks: boolean;
    serverSettings: boolean;
    ownNickname: boolean;
    otherNicknames: boolean;
    bots: boolean;
}

export interface CopyWipe {
    roles: boolean;
    channels: boolean;
    emojis: boolean;
    stickers: boolean;
}

export interface CopyOptions {
    source: AnyGuild;
    target: CopyTarget;
    include: CopyInclude;
    wipe: CopyWipe;
    onLog: (line: string) => void;
}

const uploadEmoji = findByCodeLazy(".GUILD_EMOJIS(", "EMOJI_UPLOAD_START") as any;

const StickerExtMap = {
    1: "png",
    2: "png",
    3: "json",
    4: "gif",
} as const;

const MAX_EMOJI_SIZE_BYTES = 256 * 1024;
const MAX_STICKER_SIZE_BYTES = 512 * 1024;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchBlob(url: string, maxSize: number): Promise<Blob> {
    for (let size = 4096; size >= 16; size /= 2) {
        const res = await fetch(`${url}?size=${size}&lossless=true&animated=true`);
        if (!res.ok) {
            throw new Error(`Failed to fetch ${url} - ${res.status}`);
        }
        const blob = await res.blob();
        if (blob.size <= maxSize) {
            return blob;
        }
    }
    throw new Error(`Failed to fetch within size limit of ${maxSize / 1000}kB`);
}

async function cloneEmoji(guildId: string, emoji: { name: string; url: string }) {
    const data = await fetchBlob(emoji.url, MAX_EMOJI_SIZE_BYTES);
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(data);
    });
    return uploadEmoji({
        guildId,
        name: emoji.name,
        image: dataUrl,
    });
}

async function cloneSticker(guildId: string, sticker: { name: string; url: string; tags: string; description: string }) {
    const data = new FormData();
    data.append("name", sticker.name);
    data.append("tags", sticker.tags);
    data.append("description", sticker.description);
    data.append("file", await fetchBlob(sticker.url, MAX_STICKER_SIZE_BYTES));

    await RestAPI.post({
        url: `/guilds/${guildId}/stickers`,
        body: data,
    });
}

async function getGuildIconBase64(guild: AnyGuild): Promise<string | null> {
    if (!guild.icon) return null;
    const url = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`;
    try {
        const blob = await fetchBlob(url, 256 * 1024);
        return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

export async function runCopy(opts: CopyOptions): Promise<void> {
    const { source: partialSource, target, include, wipe, onLog } = opts;

    // Resolve source guild to full object
    const source = (GuildStore.getGuild(partialSource.id) ?? partialSource) as AnyGuild;

    onLog(`→ Source Server: ${source.name} (${source.id})`);

    let targetId: string;
    if (target.kind === "new") {
        onLog(`→ Creating new server: ${target.name}...`);
        const iconBase64 = await getGuildIconBase64(source);
        const { body: newGuild } = await RestAPI.post({
            url: "/guilds",
            body: {
                name: target.name,
                icon: iconBase64,
                description: source.description,
            },
        });
        targetId = newGuild.id;
        onLog(`✓ Created new server: ${newGuild.name} (${targetId})`);

        // Delete default channels in new server
        onLog("  · Cleaning default channels...");
        try {
            const { body: defaultChannels } = await RestAPI.get({ url: `/guilds/${targetId}/channels` });
            const nonCategories = defaultChannels.filter((c: any) => c.type !== 4);
            const categories = defaultChannels.filter((c: any) => c.type === 4);
            for (const ch of [...nonCategories, ...categories]) {
                await RestAPI.del({ url: `/channels/${ch.id}` });
                await sleep(500);
            }
        } catch (e) {
            onLog(`  ⚠ Warning: Failed to clean default channels: ${e}`);
        }
    } else {
        if (!target.guildId) throw new Error("No target guild selected.");
        targetId = target.guildId;
        onLog(`→ Target Server (Existing): ${targetId}`);

        // Overwrite existing target name and profile picture (icon)
        onLog("  · Overwriting target server name and icon...");
        try {
            const iconBase64 = await getGuildIconBase64(source);
            await RestAPI.patch({
                url: `/guilds/${targetId}`,
                body: {
                    name: target.name || source.name,
                    icon: iconBase64,
                },
            });
            onLog("✓ Overwrote target server name and icon");
        } catch (e) {
            onLog(`  ⚠ Failed to overwrite target server name/icon: ${e}`);
        }
    }

    // Wipe Target
    if (target.kind === "existing") {
        onLog("→ Target Wipe Phase");
        if (wipe.channels) {
            onLog("  · Wiping channels...");
            try {
                const { body: targetChannels } = await RestAPI.get({ url: `/guilds/${targetId}/channels` });
                const nonCategories = targetChannels.filter((c: any) => c.type !== 4);
                const categories = targetChannels.filter((c: any) => c.type === 4);
                for (const ch of [...nonCategories, ...categories]) {
                    await RestAPI.del({ url: `/channels/${ch.id}` });
                    await sleep(400);
                }
            } catch (e) {
                onLog(`  ⚠ Channel wipe failed: ${e}`);
            }
        }
        if (wipe.roles) {
            onLog("  · Wiping roles...");
            try {
                const targetRoles = GuildRoleStore.getSortedRoles(targetId);
                for (const role of targetRoles) {
                    if (role.name !== "@everyone" && !role.managed) {
                        await RestAPI.del({ url: `/guilds/${targetId}/roles/${role.id}` });
                        await sleep(400);
                    }
                }
            } catch (e) {
                onLog(`  ⚠ Role wipe failed: ${e}`);
            }
        }
        if (wipe.emojis) {
            onLog("  · Wiping emojis...");
            try {
                const targetEmojis = EmojiStore.getGuildEmoji(targetId) || [];
                for (const em of targetEmojis) {
                    await RestAPI.del({ url: `/guilds/${targetId}/emojis/${em.id}` });
                    await sleep(400);
                }
            } catch (e) {
                onLog(`  ⚠ Emoji wipe failed: ${e}`);
            }
        }
        if (wipe.stickers) {
            onLog("  · Wiping stickers...");
            try {
                const targetStickers = StickersStore.getStickersByGuildId(targetId) || [];
                for (const st of targetStickers) {
                    await RestAPI.del({ url: `/guilds/${targetId}/stickers/${st.id}` });
                    await sleep(400);
                }
            } catch (e) {
                onLog(`  ⚠ Sticker wipe failed: ${e}`);
            }
        }
    }

    // Copy Server Settings
    if (include.serverSettings) {
        onLog("→ Copying server settings...");
        try {
            await RestAPI.patch({
                url: `/guilds/${targetId}`,
                body: {
                    verification_level: source.verificationLevel,
                    default_message_notifications: source.defaultMessageNotifications,
                    explicit_content_filter: source.explicitContentFilter,
                    afk_timeout: source.afkTimeout,
                },
            });
            onLog("✓ Server settings copied");
        } catch (e) {
            onLog(`  ⚠ Server settings copy failed: ${e}`);
        }
    }

    // Role Mapping
    const roleMapping: Record<string, string> = {};
    roleMapping[source.id] = targetId;
    if (include.roles) {
        onLog("→ Copying roles...");
        try {
            const roles = GuildRoleStore.getSortedRoles(source.id);
            const backupRoles = roles.filter((role: any) => role.name !== "@everyone");
            for (const role of backupRoles) {
                try {
                    const { body } = await RestAPI.post({
                        url: `/guilds/${targetId}/roles`,
                        body: {
                            name: role.name,
                            permissions: role.permissions,
                            color: role.color,
                            hoist: role.hoist,
                            mentionable: role.mentionable,
                        },
                    });
                    roleMapping[role.id] = body.id;
                    onLog(`  · Created role: ${role.name}`);
                    await sleep(450);
                } catch (e) {
                    onLog(`  ⚠ Failed to copy role ${role.name}: ${e}`);
                }
            }
        } catch (e) {
            onLog(`  ⚠ Role copying failed: ${e}`);
        }
    }

    // Channel Mapping
    const channelMapping: Record<string, string> = {};
    if (include.channels) {
        onLog("→ Copying channels...");
        try {
            const allChannels = ChannelStore.getMutableGuildChannelsForGuild(source.id);
            const backupChannels: any[] = [];
            for (const [, channelData] of Object.entries(allChannels)) {
                if (channelData && (channelData as any).guild_id === source.id) {
                    const permOverwrites = (channelData as any).permissionOverwrites
                        ? Object.values((channelData as any).permissionOverwrites)
                        : [];
                    backupChannels.push({
                        name: (channelData as any).name,
                        type: (channelData as any).type === 5 ? 0 : (channelData as any).type,
                        topic: (channelData as any).topic,
                        nsfw: (channelData as any).nsfw,
                        parent_id: (channelData as any).parent_id,
                        position: (channelData as any).position,
                        permission_overwrites: permOverwrites,
                        id: (channelData as any).id,
                        rate_limit_per_user: (channelData as any).rateLimitPerUser,
                        bitrate: (channelData as any).bitrate,
                        user_limit: (channelData as any).userLimit,
                        default_auto_archive_duration: (channelData as any).defaultAutoArchiveDuration,
                        rtc_region: (channelData as any).rtcRegion,
                        video_quality_mode: (channelData as any).videoQualityMode,
                        default_thread_rate_limit_per_user: (channelData as any).defaultThreadRateLimitPerUser,
                    });
                }
            }
            backupChannels.sort((a, b) => a.position - b.position);

            const categories = backupChannels.filter(c => c.type === 4);
            const otherChannels = backupChannels.filter(c => c.type !== 4);

            // Copy Categories first
            for (const category of categories) {
                try {
                    const permissionOverwrites = category.permission_overwrites.map((o: any) => ({
                        ...o,
                        id: roleMapping[o.id] || o.id,
                    }));
                    const { body } = await RestAPI.post({
                        url: `/guilds/${targetId}/channels`,
                        body: {
                            name: category.name,
                            type: category.type,
                            permission_overwrites: permissionOverwrites,
                        },
                    });
                    channelMapping[category.id] = body.id;
                    onLog(`  · Created category: ${category.name}`);
                    await sleep(450);
                } catch (e) {
                    onLog(`  ⚠ Failed to copy category ${category.name}: ${e}`);
                }
            }

            // Group other channels by category parent
            const channelsByParent: Record<string, any[]> = {};
            for (const ch of otherChannels) {
                const parentKey = ch.parent_id || "none";
                if (!channelsByParent[parentKey]) channelsByParent[parentKey] = [];
                channelsByParent[parentKey].push(ch);
            }

            for (const parentKey of Object.keys(channelsByParent)) {
                const groupChannels = channelsByParent[parentKey];
                const nonForums = groupChannels.filter(c => c.type !== 15).sort((a, b) => a.position - b.position);
                const forums = groupChannels.filter(c => c.type === 15).sort((a, b) => a.position - b.position);
                for (const ch of [...nonForums, ...forums]) {
                    try {
                        const permissionOverwrites = ch.permission_overwrites.map((o: any) => ({
                            ...o,
                            id: roleMapping[o.id] || o.id,
                        }));
                        const channelBody: any = {
                            name: ch.name,
                            type: ch.type,
                            permission_overwrites: permissionOverwrites,
                            parent_id: channelMapping[ch.parent_id] || null,
                        };
                        if (ch.topic) channelBody.topic = ch.topic;
                        if (ch.nsfw !== undefined) channelBody.nsfw = ch.nsfw;
                        if (ch.rate_limit_per_user) channelBody.rate_limit_per_user = ch.rate_limit_per_user;
                        if (ch.bitrate) channelBody.bitrate = ch.bitrate;
                        else if (ch.type === 2) channelBody.bitrate = 96000;
                        if (ch.user_limit) channelBody.user_limit = ch.user_limit;
                        if (ch.default_auto_archive_duration) {
                            channelBody.default_auto_archive_duration = ch.default_auto_archive_duration;
                        } else if (ch.type === 5) {
                            channelBody.default_auto_archive_duration = 1440;
                        }
                        if (ch.rtc_region && ch.rtc_region !== null) channelBody.rtc_region = ch.rtc_region;
                        if (ch.video_quality_mode) channelBody.video_quality_mode = ch.video_quality_mode;
                        if (ch.default_thread_rate_limit_per_user) {
                            channelBody.default_thread_rate_limit_per_user = ch.default_thread_rate_limit_per_user;
                        }

                        const { body } = await RestAPI.post({
                            url: `/guilds/${targetId}/channels`,
                            body: channelBody,
                        });
                        channelMapping[ch.id] = body.id;
                        onLog(`  · Created channel: #${ch.name}`);
                        await sleep(450);
                    } catch (e) {
                        onLog(`  ⚠ Failed to copy channel ${ch.name}: ${e}`);
                    }
                }
            }
        } catch (e) {
            onLog(`  ⚠ Channel copying failed: ${e}`);
        }
    }

    // Bot List Creator
    if (include.bots) {
        onLog("→ Generating Bot List Invite links...");
        try {
            const members = Object.values(GuildMemberStore.getMembers(source.id)) as any[];
            const bots = members
                .filter(m => (UserStore as any).getUser(m.userId)?.bot)
                .map(m => {
                    const user = (UserStore as any).getUser(m.userId);
                    return {
                        id: m.userId,
                        username: user?.username || m.userId,
                    };
                });
            onLog(`  · Found ${bots.length} bots in client cache`);

            if (bots.length > 0) {
                onLog("  · Creating #bots-list channel...");
                const { body: botChannel } = await RestAPI.post({
                    url: `/guilds/${targetId}/channels`,
                    body: {
                        name: "bots-list",
                        type: 0,
                    },
                });
                await sleep(800);
                for (const bot of bots) {
                    const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${bot.id}&scope=bot&permissions=0`;
                    await RestAPI.post({
                        url: `/channels/${botChannel.id}/messages`,
                        body: {
                            content: `**${bot.username}**\n${inviteUrl}`,
                        },
                    });
                    onLog(`    · Added invite for bot: ${bot.username}`);
                    await sleep(600);
                }
                onLog("✓ Bot List channel populated");
            } else {
                onLog("  · No bots found in client cache to list");
            }
        } catch (e) {
            onLog(`  ⚠ Bot list generation failed: ${e}`);
        }
    }

    // Copy Emojis
    if (include.emojis) {
        onLog("→ Copying emojis...");
        try {
            const allEmotes = EmojiStore.getGuildEmoji(source.id) || [];
            for (const emote of allEmotes) {
                try {
                    const url = `https://cdn.discordapp.com/emojis/${emote.id}.${emote.animated ? "gif" : "png"}`;
                    await cloneEmoji(targetId, { name: emote.name, url });
                    onLog(`  · Copied emoji: :${emote.name}:`);
                    await sleep(2000);
                } catch (e: any) {
                    if (e?.status === 429) {
                        const retryAfter = e?.body?.retry_after ?? e?.text?.match(/"retry_after":([\d.]+)/)?.[1];
                        const waitMs = retryAfter ? Math.min(parseFloat(retryAfter) * 1000, 15000) : 10000;
                        onLog(`    [Rate Limited] Waiting ${waitMs / 1000}s then retrying :${emote.name}: once...`);
                        await sleep(waitMs);
                        try {
                            const url = `https://cdn.discordapp.com/emojis/${emote.id}.${emote.animated ? "gif" : "png"}`;
                            await cloneEmoji(targetId, { name: emote.name, url });
                            onLog(`  · Copied emoji (Retry): :${emote.name}:`);
                            await sleep(2000);
                        } catch (e2) {
                            onLog(`    [Skip] Emoji retry failed: ${e2}`);
                        }
                    } else {
                        onLog(`  ⚠ Failed to copy emoji :${emote.name}: - ${e}`);
                    }
                }
            }
        } catch (e) {
            onLog(`  ⚠ Emoji copying failed: ${e}`);
        }
    }

    // Copy Stickers
    if (include.stickers) {
        onLog("→ Copying stickers...");
        try {
            const allStickers = StickersStore.getStickersByGuildId(source.id) || [];
            for (const sticker of allStickers) {
                try {
                    const ext = StickerExtMap[sticker.format_type as keyof typeof StickerExtMap] || "png";
                    const url = `https://media.discordapp.net/stickers/${sticker.id}.${ext}`;
                    await cloneSticker(targetId, {
                        name: sticker.name,
                        url,
                        tags: sticker.tags || "",
                        description: sticker.description || "",
                    });
                    onLog(`  · Copied sticker: ${sticker.name}`);
                    await sleep(1000);
                } catch (e) {
                    onLog(`  ⚠ Failed to copy sticker ${sticker.name}: ${e}`);
                }
            }
        } catch (e) {
            onLog(`  ⚠ Sticker copying failed: ${e}`);
        }
    }

    // Copy Webhooks
    if (include.webhooks) {
        onLog("→ Copying webhooks...");
        try {
            const res = await RestAPI.get({ url: `/guilds/${source.id}/webhooks` });
            const sourceWebhooks = res.body ?? [];
            for (const hw of sourceWebhooks) {
                try {
                    const mappedChannelId = channelMapping[hw.channel_id];
                    if (!mappedChannelId) continue;
                    await RestAPI.post({
                        url: `/channels/${mappedChannelId}/webhooks`,
                        body: {
                            name: hw.name,
                            avatar: hw.avatar,
                        },
                    });
                    onLog(`  · Recreated webhook: ${hw.name}`);
                    await sleep(400);
                } catch (e) {
                    onLog(`  ⚠ Webhook recreate failed for ${hw.name}: ${e}`);
                }
            }
        } catch (e) {
            onLog(`  ⚠ Webhooks copy failed: ${e}`);
        }
    }

    // Copy Own Nickname
    if (include.ownNickname) {
        onLog("→ Copying own nickname...");
        try {
            const me = UserStore.getCurrentUser();
            const myNick = GuildMemberStore.getMember(source.id, me.id)?.nick;
            if (myNick) {
                await RestAPI.patch({
                    url: `/guilds/${targetId}/members/@me`,
                    body: { nick: myNick },
                });
                onLog(`✓ Own nickname set to: ${myNick}`);
            }
        } catch (e) {
            onLog(`  ⚠ Own nickname copy failed: ${e}`);
        }
    }

    // Copy Other Nicknames
    if (include.otherNicknames) {
        onLog("→ Copying other members' nicknames...");
        try {
            const me = UserStore.getCurrentUser();
            const members = Object.values(GuildMemberStore.getMembers(source.id)) as any[];
            for (const m of members) {
                if (m.userId !== me.id && m.nick) {
                    try {
                        await RestAPI.patch({
                            url: `/guilds/${targetId}/members/${m.userId}`,
                            body: { nick: m.nick },
                        });
                        onLog(`  · Copied nick for member: ${m.userId}`);
                        await sleep(450);
                    } catch {
                        // Suppressed because member might not be in the target server yet
                    }
                }
            }
        } catch (e) {
            onLog(`  ⚠ Other nicknames copy failed: ${e}`);
        }
    }

    onLog("✓ Guild Copy operation complete!");
}
