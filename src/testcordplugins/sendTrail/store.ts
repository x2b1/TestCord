/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { React, UserStore } from "@webpack/common";
import type { DispatchWithoutAction } from "react";

import type { SentTrailMediaItem, SentTrailRecord } from "./types";

const STORAGE_PREFIX = "kamidere-send-trail:";
const signals = new Set<DispatchWithoutAction>();
const recordCache = new Map<string, SentTrailRecord[]>();

function getCachedRecords(userId: string | null) {
    if (!userId) return [];
    return recordCache.get(userId) ?? [];
}

function setCachedRecords(userId: string | null, records: SentTrailRecord[]) {
    if (!userId) return;
    recordCache.set(userId, records);
}

export function hasSentTrailRecord(userId: string | null, channelId: string, messageId: string) {
    if (!userId) return false;
    return getCachedRecords(userId).some(record =>
        record.channelId === channelId &&
        record.messageId === messageId,
    );
}

function emit() {
    signals.forEach(signal => signal());
}

function getStorageKey(userId: string) {
    return `${STORAGE_PREFIX}${userId}`;
}

export async function getSentTrailRecords(userId: string | null) {
    if (!userId) return [];
    const records = await DataStore.get(getStorageKey(userId)) as SentTrailRecord[] | undefined;
    const nextRecords = records ?? [];
    setCachedRecords(userId, nextRecords);
    return nextRecords;
}

export async function appendSentTrailRecord(record: SentTrailRecord) {
    const userId = UserStore.getCurrentUser()?.id;
    if (!userId) return;
    let nextRecords = getCachedRecords(userId);

    await DataStore.update(getStorageKey(userId), (existing: SentTrailRecord[] | undefined) => {
        const records = existing ?? [];
        const index = records.findIndex(existingRecord =>
            existingRecord.channelId === record.channelId &&
            existingRecord.messageId === record.messageId,
        );

        if (index === -1) {
            records.unshift(record);
        } else {
            records[index] = {
                ...records[index],
                ...record,
            };
        }

        records.sort((left, right) => right.timestamp - left.timestamp);
        nextRecords = records;
        return records;
    });

    setCachedRecords(userId, nextRecords);
    emit();
}

export async function mergeSentTrailRecordMedia(
    channelId: string,
    messageId: string,
    media: SentTrailMediaItem[],
    metadata?: Partial<Pick<SentTrailRecord, "guildId" | "jumpLink" | "channelNameSnapshot" | "guildNameSnapshot" | "recipientUserIds">>,
) {
    const userId = UserStore.getCurrentUser()?.id;
    if (!userId || media.length === 0) return;

    let didChange = false;
    let nextRecords = getCachedRecords(userId);

    await DataStore.update(getStorageKey(userId), (existing: SentTrailRecord[] | undefined) => {
        const records = existing ?? [];
        const index = records.findIndex(record => record.channelId === channelId && record.messageId === messageId);
        if (index === -1) return records;

        const current = records[index];
        const nextMedia = [...current.media];

        for (const item of media) {
            const duplicate = nextMedia.some(existingMedia =>
                existingMedia.source === item.source &&
                existingMedia.kind === item.kind &&
                existingMedia.url === item.url,
            );

            if (!duplicate) {
                nextMedia.push(item);
                didChange = true;
            }
        }

        const nextRecord: SentTrailRecord = {
            ...current,
            media: nextMedia,
            hasMedia: nextMedia.length > 0,
            guildId: metadata?.guildId ?? current.guildId,
            jumpLink: metadata?.jumpLink ?? current.jumpLink,
            channelNameSnapshot: metadata?.channelNameSnapshot ?? current.channelNameSnapshot,
            guildNameSnapshot: metadata?.guildNameSnapshot ?? current.guildNameSnapshot,
            recipientUserIds: metadata?.recipientUserIds ?? current.recipientUserIds,
        };

        if (
            nextRecord.hasMedia !== current.hasMedia ||
            nextRecord.media.length !== current.media.length ||
            nextRecord.jumpLink !== current.jumpLink ||
            nextRecord.guildId !== current.guildId ||
            nextRecord.channelNameSnapshot !== current.channelNameSnapshot ||
            nextRecord.guildNameSnapshot !== current.guildNameSnapshot ||
            (nextRecord.recipientUserIds?.join(",") ?? "") !== (current.recipientUserIds?.join(",") ?? "")
        ) {
            didChange = true;
        }

        records[index] = nextRecord;
        nextRecords = records;
        return records;
    });

    if (didChange) {
        setCachedRecords(userId, nextRecords);
        emit();
    }
}

export async function clearSentTrailRecords(userId: string | null) {
    if (!userId) return;
    await DataStore.set(getStorageKey(userId), []);
    setCachedRecords(userId, []);
    emit();
}

export async function clearSentTrailRecordsWhere(
    userId: string | null,
    predicate: (record: SentTrailRecord) => boolean,
) {
    if (!userId) return;
    let nextRecords = getCachedRecords(userId);

    await DataStore.update(getStorageKey(userId), (existing: SentTrailRecord[] | undefined) => {
        nextRecords = (existing ?? []).filter(record => !predicate(record));
        return nextRecords;
    });

    setCachedRecords(userId, nextRecords);
    emit();
}

export async function removeSentTrailRecord(userId: string | null, channelId: string, messageId: string) {
    if (!userId) return;
    let nextRecords = getCachedRecords(userId);

    await DataStore.update(getStorageKey(userId), (existing: SentTrailRecord[] | undefined) => {
        nextRecords = (existing ?? []).filter(record => !(record.channelId === channelId && record.messageId === messageId));
        return nextRecords;
    });

    setCachedRecords(userId, nextRecords);
    emit();
}

export async function removeSentTrailRecordsWhere(
    userId: string | null,
    predicate: (record: SentTrailRecord) => boolean,
) {
    await clearSentTrailRecordsWhere(userId, predicate);
}

export function useSentTrailRecords(userId: string | null) {
    const [signal, setSignal] = React.useReducer(value => value + 1, 0);
    const [records, setRecords] = React.useState<SentTrailRecord[]>(() => getCachedRecords(userId));
    const [pending, setPending] = React.useState(() => !!userId && !recordCache.has(userId));
    const previousUserIdRef = React.useRef<string | null | undefined>(void 0);

    React.useEffect(() => {
        signals.add(setSignal);
        return () => void signals.delete(setSignal);
    }, []);

    React.useEffect(() => {
        let isAlive = true;
        const userChanged = previousUserIdRef.current !== userId;
        previousUserIdRef.current = userId;

        if (userChanged) {
            const cachedRecords = getCachedRecords(userId);
            setRecords(cachedRecords);
            setPending(!!userId && !recordCache.has(userId));
            if (!userId) setRecords([]);
        }

        void getSentTrailRecords(userId).then(nextRecords => {
            if (!isAlive) return;
            setRecords(nextRecords);
            setPending(false);
        });

        return () => {
            isAlive = false;
        };
    }, [userId, signal]);

    return [records, pending] as const;
}
