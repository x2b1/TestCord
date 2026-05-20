/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { MessageObject, MessageOptions } from "@api/MessageEvents";
import { ClockIcon } from "@components/Icons";
import SettingsPlugin from "@plugins/_core/settings";
import { removeFromArray, sleep } from "@utils/misc";
import definePlugin from "@utils/types";
import { ChannelStore, GuildStore, MessageStore, UserStore } from "@webpack/common";

import SendTrailTab from "./SendTrailTab";
import { settings } from "./settings";
import { appendSentTrailRecord, hasSentTrailRecord, mergeSentTrailRecordMedia, removeSentTrailRecord } from "./store";
import type { MessageCreatePayload, MessageDeletePayload, MessageUpdatePayload, PendingSendDraft, SentTrailRecord } from "./types";
import { buildJumpLink, collectMessageMediaItems, getChannelRecipientIds, getMessageDisplayContent, getMessageTimestamp, getRecordPreview, hasMediaLinks, isForwardedMessage, makeAttachmentSignature, makeUploadSignature, normalizeContent } from "./utils";

const DRAFT_TTL_MS = 20_000;
const MIN_MATCH_SCORE = 4;
const SEND_TRAIL_SETTINGS_KEY = "kamidere_send_trail";

let draftCounter = 0;
const pendingDrafts = new Map<string, PendingSendDraft>();

function cleanupExpiredDrafts(now = Date.now()) {
    for (const [key, draft] of pendingDrafts.entries()) {
        if (now - draft.createdAt > DRAFT_TTL_MS) {
            pendingDrafts.delete(key);
        }
    }
}

function createPendingDraft(channelId: string, messageObj: MessageObject, options: MessageOptions) {
    cleanupExpiredDrafts();

    const content = options.content ?? messageObj.content ?? "";
    const normalizedContent = normalizeContent(content);
    const localId = `${Date.now()}-${++draftCounter}`;

    pendingDrafts.set(localId, {
        localId,
        channelId,
        createdAt: Date.now(),
        content,
        normalizedContent,
        hasText: normalizedContent.length > 0,
        mediaHint: (options.uploads?.length ?? 0) > 0 || hasMediaLinks(content),
        uploadSignature: makeUploadSignature({ uploads: options.uploads }),
        replyMessageId: options.replyOptions?.messageReference?.message_id,
    });
}

function getDraftScore(draft: PendingSendDraft, payload: MessageCreatePayload) {
    const { message } = payload;
    if (draft.channelId !== message.channel_id) return Number.NEGATIVE_INFINITY;

    const now = Date.now();
    if (now - draft.createdAt > DRAFT_TTL_MS) return Number.NEGATIVE_INFINITY;

    const normalizedContent = normalizeContent(getMessageDisplayContent(message, message.content ?? ""));
    const attachmentSignature = makeAttachmentSignature(message.attachments ?? []);
    const media = collectMessageMediaItems(message);

    let score = 2;

    if (draft.normalizedContent === normalizedContent) {
        score += 6;
    } else if (!draft.normalizedContent && !normalizedContent) {
        score += 3;
    }

    if (draft.replyMessageId && draft.replyMessageId === message.messageReference?.message_id) {
        score += 2;
    }

    if (draft.uploadSignature && draft.uploadSignature === attachmentSignature) {
        score += 4;
    } else if (!draft.uploadSignature && !attachmentSignature) {
        score += 1;
    }

    if (draft.mediaHint === (media.length > 0)) {
        score += 1;
    }

    if (draft.mediaHint && media.length > 0) {
        score += 2;
    }

    if (draft.hasText === (normalizedContent.length > 0)) {
        score += 1;
    }

    score -= Math.min(4, Math.abs(now - draft.createdAt) / 2000);
    return score;
}

function resolveBestDraft(payload: MessageCreatePayload) {
    let bestDraft: PendingSendDraft | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const draft of pendingDrafts.values()) {
        const score = getDraftScore(draft, payload);
        if (score > bestScore || (score === bestScore && bestDraft && draft.createdAt > bestDraft.createdAt)) {
            bestDraft = draft;
            bestScore = score;
        }
    }

    if (!bestDraft || bestScore < MIN_MATCH_SCORE) return null;

    pendingDrafts.delete(bestDraft.localId);
    return bestDraft;
}

function buildRecord(payload: MessageCreatePayload, draft?: PendingSendDraft | null): SentTrailRecord {
    const { message } = payload;
    const channel = ChannelStore.getChannel(message.channel_id);
    const guildId = payload.guildId ?? channel?.guild_id ?? "@me";
    const guild = guildId !== "@me" ? GuildStore.getGuild(guildId) : null;
    const timestamp = getMessageTimestamp(message);
    const content = getMessageDisplayContent(message, draft?.content ?? "");
    const media = collectMessageMediaItems(message);
    const normalizedContent = normalizeContent(content);

    return {
        id: `${message.channel_id}:${message.id}`,
        messageId: message.id,
        channelId: message.channel_id,
        guildId,
        timestamp,
        content,
        preview: getRecordPreview(content),
        hasText: normalizedContent.length > 0,
        hasMedia: media.length > 0,
        jumpLink: buildJumpLink(guildId, message.channel_id, message.id),
        media,
        channelNameSnapshot: channel?.name ?? undefined,
        guildNameSnapshot: guild?.name ?? undefined,
        recipientUserIds: getChannelRecipientIds(channel),
        replyMessageId: message.messageReference?.message_id ?? draft?.replyMessageId,
    };
}

async function maybeEnrichRecord(payload: MessageUpdatePayload) {
    const currentUserId = UserStore.getCurrentUser()?.id;
    if (!currentUserId) return;

    const cachedMessage = MessageStore.getMessage(payload.message.channel_id, payload.message.id);
    const message = cachedMessage ?? payload.message;
    if (!message?.author || message.author.id !== currentUserId) return;

    const media = collectMessageMediaItems(message);
    if (!media.length) return;

    const channel = ChannelStore.getChannel(message.channel_id);
    const guildId = payload.guildId ?? channel?.guild_id ?? "@me";
    const guild = guildId !== "@me" ? GuildStore.getGuild(guildId) : null;

    await mergeSentTrailRecordMedia(
        message.channel_id,
        message.id,
        media,
        {
            guildId,
            jumpLink: buildJumpLink(guildId, message.channel_id, message.id),
            channelNameSnapshot: channel?.name ?? undefined,
            guildNameSnapshot: guild?.name ?? undefined,
            recipientUserIds: getChannelRecipientIds(channel),
        },
    );
}

async function maybeCreateRecordFromUpdate(payload: MessageUpdatePayload) {
    const currentUserId = UserStore.getCurrentUser()?.id;
    if (!currentUserId) return;

    const cachedMessage = MessageStore.getMessage(payload.message.channel_id, payload.message.id);
    const message = cachedMessage ?? payload.message;

    if (!message?.author || message.author.id !== currentUserId) return;
    if (!isForwardedMessage(message)) return;
    if (hasSentTrailRecord(currentUserId, message.channel_id, message.id)) return;

    const record = buildRecord({
        type: "MESSAGE_CREATE",
        optimistic: false,
        channelId: message.channel_id,
        guildId: payload.guildId,
        message: message as MessageCreatePayload["message"],
    }, null);

    await appendSentTrailRecord(record);
}

async function enrichFromStore(channelId: string, messageId: string, guildId?: string) {
    const message = MessageStore.getMessage(channelId, messageId);
    if (!message) return false;

    const media = collectMessageMediaItems(message);
    if (!media.length) return false;

    const channel = ChannelStore.getChannel(channelId);
    const effectiveGuildId = guildId ?? channel?.guild_id ?? "@me";
    const guild = effectiveGuildId !== "@me" ? GuildStore.getGuild(effectiveGuildId) : null;

    await mergeSentTrailRecordMedia(
        channelId,
        messageId,
        media,
        {
            guildId: effectiveGuildId,
            jumpLink: buildJumpLink(effectiveGuildId, channelId, messageId),
            channelNameSnapshot: channel?.name ?? undefined,
            guildNameSnapshot: guild?.name ?? undefined,
            recipientUserIds: getChannelRecipientIds(channel),
        },
    );

    return true;
}

function scheduleEnrichment(channelId: string, messageId: string, guildId?: string) {
    void (async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
            await sleep(900 + attempt * 1200);
            if (await enrichFromStore(channelId, messageId, guildId)) break;
        }
    })();
}

function unregisterSendTrailSettingsTab() {
    while (SettingsPlugin.customEntries.some(entry => entry.key === SEND_TRAIL_SETTINGS_KEY)) {
        removeFromArray(SettingsPlugin.customEntries, entry => entry.key === SEND_TRAIL_SETTINGS_KEY);
    }
}

function registerSendTrailSettingsTab() {
    unregisterSendTrailSettingsTab();

    SettingsPlugin.customEntries.push({
        key: SEND_TRAIL_SETTINGS_KEY,
        title: "Kamidere Send Trail",
        Component: SendTrailTab,
        Icon: ClockIcon,
    });
}

export default definePlugin({
    name: "SendTrail",
    description: "Tracks your newly sent messages, lets you select them, and purges them in a dedicated Illegalcord settings page.",
    authors: [{
        name: "clrxxo",
        id: 0n
    }],
    dependencies: ["Settings", "MessageEventsAPI"],
    enabledByDefault: true,
    tags: ["Chat", "Utility"],
    requiresRestart: false,
    settings,

    start() {
        registerSendTrailSettingsTab();
    },

    stop() {
        pendingDrafts.clear();
        unregisterSendTrailSettingsTab();
    },

    onBeforeMessageSend(channelId, messageObj, options) {
        createPendingDraft(channelId, messageObj, options);
    },

    flux: {
        async MESSAGE_CREATE(payload: MessageCreatePayload) {
            cleanupExpiredDrafts();

            if (payload.optimistic || payload.type !== "MESSAGE_CREATE") return;
            if (payload.message.state === "SENDING") return;

            const currentUserId = UserStore.getCurrentUser()?.id;
            if (!currentUserId || payload.message.author?.id !== currentUserId) return;

            const draft = resolveBestDraft(payload);
            if (!draft && !isForwardedMessage(payload.message)) return;

            const record = buildRecord(payload, draft);
            await appendSentTrailRecord(record);
            scheduleEnrichment(record.channelId, record.messageId, record.guildId);
        },

        async MESSAGE_UPDATE(payload: MessageUpdatePayload) {
            cleanupExpiredDrafts();
            await maybeCreateRecordFromUpdate(payload);
            await maybeEnrichRecord(payload);
        },

        async MESSAGE_DELETE(payload: MessageDeletePayload) {
            await removeSentTrailRecord(UserStore.getCurrentUser()?.id ?? null, payload.channelId, payload.id);
        },
    },
});
