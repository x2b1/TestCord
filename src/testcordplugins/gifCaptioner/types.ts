/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface CaptionMedia {
    buffer: ArrayBuffer;
    contentType: string;
    height: number;
    isVideo: boolean;
    release: () => void;
    url: string;
    width: number;
}

export interface CaptionTransform {
    height: number;
    text: string;
    size: number;
    sourceVideo?: HTMLVideoElement | null;
    type: "caption";
    width: number;
}

export type GifTransform = CaptionTransform;
export type OnSubmit = (callback: () => GifTransform) => void;
