/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { settings } from "..";
import { navidromePassword } from "./constants";
import { NowPlayingTrack } from "./types";

const salt = "nvdrpc";
const currentlyActiveStartTime: {
    id?: string;
    minutes?: string;
    timestamp?: number;
} = {};
const albumArtCache: Record<string, string> = {};

export async function req(endpoint: string): Promise<any> {
    if (!settings.store.isLoggedIn) throw new Error("NavidromeRPC: Not logged in");

    const url = new URL(`/rest${endpoint}`, settings.store.serverURL);
    const params = new URLSearchParams({
        "u": settings.store.username || "",
        "t": (window as any).SparkMD5.hash(navidromePassword.get() + salt),
        "s": salt,
        "v": "1.16.1",
        "c": "NavidromeRPC",
        "f": "json"
    });
    url.search = params.toString();

    const request = await fetch(url.href);

    const rtv = await request.json();
    if (rtv["subsonic-response"].status === "failed") throw new Error(`NavidromeRPC: ${rtv["subsonic-response"].error.message}`);

    return rtv["subsonic-response"];
}

export async function getNowPlayingTrack(): Promise<NowPlayingTrack> {
    const nowPlayingReq = await req("/getNowPlaying");
    let entriesBelongingToSelf: any[] = [];
    try {
        entriesBelongingToSelf = (nowPlayingReq.nowPlaying.entry as any[]).filter(entry => entry.username === settings.store.username);
        if (entriesBelongingToSelf.length === 0) return {
            isPlaying: false
        };
    }
    catch {
        return {
            isPlaying: false
        };
    }

    const entry = entriesBelongingToSelf[0];

    let art = albumArtCache[entry.id] || "";
    try {
        if (!art) {
            const lastFMRequest: any = await (await fetch(`https://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=feff915bf5987580c9dc354d523dc6b9&artist=${encodeURIComponent(entry.albumArtists[0].name)}&album=${encodeURIComponent(entry.album)}&format=json`)).json();
            art = lastFMRequest.album.image.at(-1)?.["#text"] || "";
            albumArtCache[entry.id] = art;
        }
    } catch { }

    if (settings.store.shouldCalculateTimestamps) {
        const now = Date.now();

        const isThereNoStartTime = !currentlyActiveStartTime.id;
        const repeat = (currentlyActiveStartTime.timestamp! + (entry.duration * 1000)) < now;
        const isStartTimeForSameID = entry.id === currentlyActiveStartTime.id;
        const isStartTimeForSameMinsAgo = entry.minutesAgo === currentlyActiveStartTime.minutes;

        if (isThereNoStartTime || repeat || isStartTimeForSameID || isStartTimeForSameMinsAgo) {
            currentlyActiveStartTime.timestamp = now - (entry.minutesAgo * 60 * 1000);
            currentlyActiveStartTime.id = entry.id;
            currentlyActiveStartTime.minutes = entry.minutesAgo;
        }

        return {
            isPlaying: true,
            title: entry.title,
            artists: entry.artists.map(a => a.name),
            album: {
                artist: entry.albumArtists[0].name,
                name: entry.album,
                art
            },
            timestamps: {
                start: String(currentlyActiveStartTime.timestamp),
                end: String(currentlyActiveStartTime.timestamp! + (entry.duration * 1000))
            }
        };
    }
    else return {
        isPlaying: true,
        title: entry.title,
        artists: entry.artists.map(a => a.name),
        album: {
            artist: entry.albumArtists[0].name,
            name: entry.album,
            art
        }
    };
}
