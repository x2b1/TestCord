/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Card } from "@components/Card";
import { Heading } from "@components/Heading";
import { Margins } from "@components/margins";
import { Paragraph } from "@components/Paragraph";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import type { Activity, ActivityButton } from "@vencord/discord-types";
import { ActivityFlags, ActivityType } from "@vencord/discord-types/enums";
import { ApplicationAssetUtils, FluxDispatcher } from "@webpack/common";

interface SCTrack {
    title: string;
    permalink_url: string;
    artwork_url: string | null;
    duration: number;
    user: { username: string; permalink_url: string; };
}

interface SCHistoryItem {
    track: SCTrack;
    played_at: string;
}

const SOCKET_ID = "SoundCloudRichPresence";
const SC_API = "https://api-v2.soundcloud.com";
const logger = new Logger("SoundCloudRichPresence");

let updateInterval: NodeJS.Timeout | undefined;
let lastTrackUrl = "";
let trackStart = 0;

const settings = definePluginSettings({
    oauthToken: {
        description: "Your SoundCloud OAuth token. Get it from soundcloud.com → F12 DevTools → Application → Cookies → oauth_token.",
        type: OptionType.STRING,
        default: "",
    },
    discordAppId: {
        description: "Discord Application ID for rich presence. See setup guide below.",
        type: OptionType.STRING,
        default: "",
    },
    showSongLink: {
        description: "Show a button linking to the currently playing track.",
        type: OptionType.BOOLEAN,
        default: true,
    },
    shareProfile: {
        description: "Show a button linking to your SoundCloud profile.",
        type: OptionType.BOOLEAN,
        default: false,
    },
    useListeningStatus: {
        description: 'Show "Listening to SoundCloud" instead of "Playing SoundCloud".',
        type: OptionType.BOOLEAN,
        default: true,
    },
    refreshInterval: {
        description: "Polling interval in seconds.",
        type: OptionType.SLIDER,
        markers: [5, 10, 15, 20, 30],
        default: 10,
        stickToMarkers: true,
    },
});

function setActivity(activity: Activity | null) {
    FluxDispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", activity, socketId: SOCKET_ID });
}

async function getAsset(appId: string, key: string): Promise<string> {
    return (await ApplicationAssetUtils.fetchAssetIds(appId, [key]))[0];
}

async function fetchCurrentTrack(): Promise<{ track: SCTrack; playedAt: number; } | null> {
    if (!settings.store.oauthToken) return null;

    try {
        const res = await fetch(`${SC_API}/me/play-history/tracks?limit=1`, {
            headers: { Authorization: `OAuth ${settings.store.oauthToken}` },
        });

        if (res.status === 401) {
            logger.warn("SoundCloud token expired or invalid.");
            return null;
        }
        if (!res.ok) throw `${res.status} ${res.statusText}`;

        const json = await res.json();
        const item: SCHistoryItem | undefined = json.collection?.[0];
        if (!item?.track) return null;

        const playedAt = new Date(item.played_at).getTime();

        // Only show if the track would still be playing (with 60s grace for pausing)
        if (Date.now() > playedAt + item.track.duration + 60_000) return null;

        return { track: item.track, playedAt };
    } catch (e) {
        logger.error("Failed to fetch SoundCloud play history", e);
        return null;
    }
}

async function getActivity(): Promise<Activity | null> {
    const appId = settings.store.discordAppId;
    if (!appId) return null;

    const result = await fetchCurrentTrack();
    if (!result) return null;

    const { track, playedAt } = result;

    if (track.permalink_url !== lastTrackUrl) {
        lastTrackUrl = track.permalink_url;
        trackStart = playedAt;
    }

    const artworkKey = track.artwork_url?.replace("-large", "-t500x500") ?? null;
    const largeImage = artworkKey
        ? await getAsset(appId, artworkKey)
        : await getAsset(appId, "soundcloud");

    const buttons: ActivityButton[] = [];
    if (settings.store.showSongLink)
        buttons.push({ label: "Listen on SoundCloud", url: track.permalink_url });
    if (settings.store.shareProfile)
        buttons.push({ label: "SoundCloud Profile", url: track.user.permalink_url });

    return {
        application_id: appId,
        name: "SoundCloud",
        details: track.title,
        state: track.user.username,
        timestamps: { start: trackStart, end: trackStart + track.duration },
        assets: {
            large_image: largeImage,
            large_text: track.title,
            small_image: await getAsset(appId, "soundcloud"),
            small_text: "SoundCloud",
        },
        buttons: buttons.length ? buttons.map(b => b.label) : undefined,
        metadata: buttons.length ? { button_urls: buttons.map(b => b.url) } : undefined,
        type: settings.store.useListeningStatus ? ActivityType.LISTENING : ActivityType.PLAYING,
        flags: ActivityFlags.INSTANCE,
    };
}

async function updatePresence() {
    try {
        setActivity(await getActivity());
    } catch (e) {
        logger.error("Failed to update presence", e);
        setActivity(null);
    }
}

export default definePlugin({
    name: "SoundCloudRichPresence",
    description: "Show your currently playing SoundCloud track as Discord rich presence.",
    tags: ["Activity", "Media"],
    authors: [{ name: "Sharp", id: 0n }],
    settings,

    settingsAboutComponent() {
        return (
            <Card>
                <Heading tag="h5">Setup</Heading>
                <Paragraph>
                    <strong>1. OAuth token:</strong> Go to soundcloud.com, open DevTools (F12),
                    then Application → Cookies → https://soundcloud.com → copy the value of <code>oauth_token</code>.
                </Paragraph>
                <Paragraph className={Margins.top8}>
                    <strong>2. Discord App ID:</strong> Go to discord.com/developers/applications, create
                    an app named "SoundCloud", upload a SoundCloud logo as a Rich Presence asset named{" "}
                    <code>soundcloud</code>, then paste the Application ID in the field above.
                </Paragraph>
            </Card>
        );
    },

    start() {
        updatePresence();
        updateInterval = setInterval(updatePresence, (settings.store.refreshInterval ?? 10) * 1000);
    },

    stop() {
        clearInterval(updateInterval);
        updateInterval = undefined;
        lastTrackUrl = "";
        trackStart = 0;
        setActivity(null);
    },
});
