/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type NowPlayingTrack = {
    isPlaying: boolean;
    title?: string;
    artists?: string[],
    album?: {
        artist: string;
        name: string;
        art: string;
    };
    timestamps?: {
        start: string;
        end: string;
    };
};
