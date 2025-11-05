/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Minimal local re-declarations to remove external type dependency
export interface UserJSON {
    id: string;
    username: string;
    avatar: string | null;
    discriminator: string;
}

export interface MessageJSON {
    id: string;
    channel_id: string;
    guild_id?: string;
    content: string;
    author: UserJSON;
    attachments?: { id: string; filename: string }[];
    type?: number;
}

export interface Channel {
    id: string;
    guild_id?: string;
    name?: string;
    type?: number;
    ownerId?: string;
    parent_id?: string;
}

export interface MessageUpdatePayload {
    type: string;
    guildId: string;
    message: MessageJSON;
}

export interface MessageCreatePayload {
    type: string;
    guildId: string;
    channelId: string;
    message: MessageJSON;
    optimistic: boolean;
    isPushNotification: boolean;
}

export interface MessageDeletePayload {
    type: string;
    guildId: string;
    id: string;
    channelId: string;
    mlDeleted?: boolean;
}

export interface TypingStartPayload {
    type: string;
    channelId: string;
    userId: string;
}

export interface UserUpdatePayload {
    type: string;
    user: {
        id: string;
        username: string;
        avatar: string;
        discriminator: string;
        flags: number;
        banner: string;
        banner_color: string;
        accent_color: number;
        bio: string;
        publicFlags: number;
        avatarDecorationData: {
            asset: string;
            skuId: string;
        };
        globalName: string | null;
    };
}
interface ThreadCreatePayload {
    type: string;
    isNewlyCreated: boolean;
    channel: Channel;
}

export type subscribedEvents =
    | "MESSAGE_CREATE"
    | "MESSAGE_DELETE"
    | "MESSAGE_UPDATE"
    | "THREAD_CREATE"
    | "TYPING_START"
    | "USER_UPDATE";
