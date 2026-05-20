/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { CloudUpload, Embed, Message, MessageAttachment } from "@vencord/discord-types";

export type SentTrailMediaKind = "image" | "video";
export type SentTrailMediaSource = "attachment" | "embed";

export interface SentTrailMediaItem {
    kind: SentTrailMediaKind;
    source: SentTrailMediaSource;
    url: string;
    filename?: string;
    contentType?: string;
    width?: number;
    height?: number;
}

export interface SentTrailRecord {
    id: string;
    messageId: string;
    channelId: string;
    guildId: string;
    timestamp: number;
    content: string;
    preview: string;
    hasText: boolean;
    hasMedia: boolean;
    jumpLink: string;
    media: SentTrailMediaItem[];
    channelNameSnapshot?: string;
    guildNameSnapshot?: string;
    recipientUserIds?: string[];
    replyMessageId?: string;
}

export interface PendingSendDraft {
    localId: string;
    channelId: string;
    createdAt: number;
    content: string;
    normalizedContent: string;
    hasText: boolean;
    mediaHint: boolean;
    uploadSignature: string;
    replyMessageId?: string;
}

export interface MessageCreatePayload {
    type: "MESSAGE_CREATE";
    optimistic: boolean;
    channelId: string;
    guildId?: string;
    message: Message;
}

export interface MessageUpdatePayload {
    type: "MESSAGE_UPDATE";
    guildId?: string;
    message: Partial<Message> & Pick<Message, "id" | "channel_id">;
}

export interface MessageDeletePayload {
    type: "MESSAGE_DELETE";
    channelId: string;
    id: string;
}

export interface MediaExtractionInput {
    content?: string;
    attachments?: MessageAttachment[];
    embeds?: Embed[];
}

export interface UploadSignatureInput {
    uploads?: CloudUpload[];
}
