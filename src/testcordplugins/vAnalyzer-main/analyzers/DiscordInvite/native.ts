/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

export interface DiscordInviteData {
    code: string;
    expires_at: string | null;
    guild?: {
        id: string;
        name: string;
        description: string | null;
        verification_level: number;
        nsfw_level: number;
        nsfw: boolean;
        features: string[];
        premium_subscription_count: number;
        premium_tier: number;
        vanity_url_code: string | null;
    };
    channel?: {
        id: string;
        type: number;
        name: string;
    };
    approximate_member_count?: number;
    approximate_presence_count?: number;
}

export interface DiscordGuildWidgetData {
    id: string;
    name: string;
    instant_invite: string | null;
    channels: Array<{
        id: string;
        name: string;
        position?: number;
    }>;
    members: Array<{
        id: string;
        username: string;
        discriminator: string;
        avatar: string | null;
        status: string;
        avatar_url: string;
        activity?: {
            name?: string;
        };
    }>;
    presence_count: number;
}

export async function queryDiscordInvite(_: IpcMainInvokeEvent, inviteCode: string): Promise<{ status: number; data: DiscordInviteData | null; error?: string; }> {
    try {
        const res = await fetch(`https://discord.com/api/v10/invites/${encodeURIComponent(inviteCode)}?with_counts=true`, {
            headers: {
                "accept": "application/json",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
            }
        });

        if (!res.ok) {
            return { status: res.status, data: null, error: `HTTP ${res.status}` };
        }

        const data: DiscordInviteData = await res.json();
        return { status: 200, data };
    } catch (e) {
        return { status: -1, data: null, error: String(e) };
    }
}

export async function queryDiscordGuildWidget(_: IpcMainInvokeEvent, guildId: string): Promise<{ status: number; data: DiscordGuildWidgetData | null; error?: string; }> {
    try {
        const res = await fetch(`https://canary.discord.com/api/v10/guilds/${encodeURIComponent(guildId)}/widget.json`, {
            headers: {
                "accept": "application/json",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
            }
        });

        if (!res.ok) {
            return { status: res.status, data: null, error: `HTTP ${res.status}` };
        }

        const data: DiscordGuildWidgetData = await res.json();
        return { status: 200, data };
    } catch (e) {
        return { status: -1, data: null, error: String(e) };
    }
}
