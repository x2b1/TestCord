/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Link } from "@components/Link";
import {EquicordDevs} from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { ApplicationAssetUtils, FluxDispatcher, Forms } from "@webpack/common";

const DISCORD_APP_ID = "1333493119525720082";
const logger = new Logger("MediaStatus");
const PresenceStore = findByPropsLazy("getLocalPresence");

enum MediaType {
    MOVIE = "Movie",
    EPISODE = "Episode",
    AUDIO = "Audio",
    VIDEO = "Video",
    PHOTO = "Photo",
    UNKNOWN = "Unknown"
}

enum ServiceType {
    JELLYFIN = "jellyfin",
    PLEX = "plex"
}

enum DisplayFormat {
    NATURAL = "natural",
    SHORT = "short",
    MINIMAL = "minimal",
}

const settings = definePluginSettings({
    serverType: {
        type: OptionType.SELECT,
        description: "What media server are you using?",
        options: [
            { label: "Jellyfin", value: ServiceType.JELLYFIN, default: true },
            { label: "Plex", value: ServiceType.PLEX }
        ]
    },
    serverUrl: {
        type: OptionType.STRING,
        description: "Your server's URL (include http:// or https://)",
        placeholder: "https://your-server.com"
    },
    apiKey: {
        type: OptionType.STRING,
        description: "Your server's API key (Jellyfin) or token (Plex)",
        placeholder: "Enter your API key or token"
    },
    episodeFormat: {
        type: OptionType.SELECT,
        description: "How should episodes be displayed?",
        options: [
            { label: "Season 1 Episode 2", value: DisplayFormat.NATURAL, default: true },
            { label: "S01E02", value: DisplayFormat.SHORT },
            { label: "1x02", value: DisplayFormat.MINIMAL }
        ]
    },
    preferSeriesName: {
        type: OptionType.BOOLEAN,
        description: "Show series name instead of episode title in status title",
        default: false
    },
    showTimestamps: {
        type: OptionType.BOOLEAN,
        description: "Show elapsed/remaining time",
        default: true
    },
    serverName: {
        type: OptionType.STRING,
        description: "Custom server name (leave empty to use default)",
        placeholder: "My Media Server"
    },
    updateInterval: {
        type: OptionType.SLIDER,
        description: "How often to update the presence (in seconds)",
        default: 10,
        markers: [5, 10, 15, 30, 60],
        stickToMarkers: true
    },
    hideWhenPaused: {
        type: OptionType.BOOLEAN,
        description: "Hide presence when media is paused",
        default: true
    },
    hideWhenOtherActivity: {
        type: OptionType.BOOLEAN,
        description: "Hide when you have another activity (like playing a game)",
        default: false
    }
});

interface MediaData {
    title: string;
    type: MediaType;
    progress?: number;
    isPaused: boolean;
    imageUrl?: string;
    duration?: number;
    position?: number;
    series?: string;
    season?: number;
    episode?: number;
    year?: number;
    studio?: string;
    artist?: string;
    albumTitle?: string;
    albumArtist?: string;
    photographer?: string;
}

async function fetchJellyfinData(): Promise<MediaData | null> {
    if (!settings.store.serverUrl || !settings.store.apiKey) return null;

    try {
        const response = await fetch(`${settings.store.serverUrl}/Sessions`, {
            headers: { "X-Emby-Token": settings.store.apiKey }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const sessions = await response.json();
        const playingSession = sessions.find(s => s.NowPlayingItem);
        if (!playingSession) return null;

        const item = playingSession.NowPlayingItem;
        const playState = playingSession.PlayState;
        const toMs = (ticks: number) => Math.floor(ticks / 10000);

        const getMediaType = (type: string): MediaType => {
            switch (type.toLowerCase()) {
                case "movie": return MediaType.MOVIE;
                case "episode": return MediaType.EPISODE;
                case "audio": return MediaType.AUDIO;
                case "video": return MediaType.VIDEO;
                case "photo": return MediaType.PHOTO;
                default: return MediaType.UNKNOWN;
            }
        };

        const baseData: MediaData = {
            title: item.Name,
            type: getMediaType(item.Type),
            progress: item.RunTimeTicks ? Math.round((playState.PositionTicks / item.RunTimeTicks) * 100) : undefined,
            isPaused: playState.IsPaused,
            imageUrl: item.ImageTags?.Primary ?
                `${settings.store.serverUrl}/Items/${item.Id}/Images/Primary?api_key=${settings.store.apiKey}` :
                undefined,
            duration: item.RunTimeTicks ? toMs(item.RunTimeTicks) : undefined,
            position: playState.PositionTicks ? toMs(playState.PositionTicks) : undefined,
            year: item.ProductionYear
        };

        switch (baseData.type) {
            case MediaType.EPISODE:
                return {
                    ...baseData,
                    series: item.SeriesName,
                    season: item.ParentIndexNumber,
                    episode: item.IndexNumber
                };
            case MediaType.AUDIO:
                return {
                    ...baseData,
                    artist: item.Artists?.[0],
                    albumArtist: item.AlbumArtist,
                    albumTitle: item.Album
                };
            default:
                return baseData;
        }

    } catch (e) {
        logger.error("Failed to fetch Jellyfin data:", e);
        return null;
    }
}

async function fetchPlexData(): Promise<MediaData | null> {
    if (!settings.store.serverUrl || !settings.store.apiKey) return null;

    try {
        const response = await fetch(`${settings.store.serverUrl}/status/sessions`, {
            headers: {
                "X-Plex-Token": settings.store.apiKey,
                "Accept": "application/json"
            }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const session = data.MediaContainer.Metadata?.[0];
        if (!session) return null;

        const getMediaType = (type: string): MediaType => {
            switch (type.toLowerCase()) {
                case "movie": return MediaType.MOVIE;
                case "episode": return MediaType.EPISODE;
                case "track": return MediaType.AUDIO;
                case "photo": return MediaType.PHOTO;
                case "clip": return MediaType.VIDEO;
                default: return MediaType.UNKNOWN;
            }
        };

        const baseData: MediaData = {
            title: session.title,
            type: getMediaType(session.type),
            progress: session.duration ? Math.round((session.viewOffset / session.duration) * 100) : undefined,
            isPaused: session.Player.state !== "playing",
            imageUrl: session.thumb ?
                `${settings.store.serverUrl}${session.thumb}?X-Plex-Token=${settings.store.apiKey}` :
                undefined,
            duration: session.duration,
            position: session.viewOffset,
            year: session.year,
            studio: session.studio
        };

        switch (baseData.type) {
            case MediaType.EPISODE:
                return {
                    ...baseData,
                    series: session.grandparentTitle,
                    season: session.parentIndex,
                    episode: session.index
                };
            case MediaType.AUDIO:
                return {
                    ...baseData,
                    artist: session.originalTitle || session.grandparentTitle,
                    albumArtist: session.grandparentTitle,
                    albumTitle: session.parentTitle
                };
            case MediaType.PHOTO:
                return {
                    ...baseData,
                    photographer: session.originalTitle || undefined
                };
            default:
                return baseData;
        }

    } catch (e) {
        logger.error("Failed to fetch Plex data:", e);
        return null;
    }
}

async function getApplicationAsset(key: string): Promise<string> {
    return (await ApplicationAssetUtils.fetchAssetIds(DISCORD_APP_ID, [key]))[0];
}

function formatEpisodeNumber(season?: number, episode?: number): string {
    if (!season || !episode) return "";

    const pad = (n: number) => n.toString().padStart(2, "0");
    switch (settings.store.episodeFormat) {
        case DisplayFormat.SHORT:
            return `S${pad(season)}E${pad(episode)}`;
        case DisplayFormat.MINIMAL:
            return `${season}x${pad(episode)}`;
        default:
            return `Season ${season} Episode ${episode}`;
    }
}

function getServerName(): string {
    if (settings.store.serverName) return settings.store.serverName;
    return settings.store.serverType === ServiceType.JELLYFIN ? "Jellyfin" : "Plex";
}

export default definePlugin({
    name: "MediaStatus",
    description: "Show your Jellyfin/Plex media activity as Discord Rich Presence",
    authors: [EquicordDevs.RedBaron2k7, EquicordDevs.x2b],
    dependencies: ["UserSettingsAPI"],
    settings,

    settingsAboutComponent: () => (
        <>
            <Forms.FormTitle tag="h3">Setup Instructions</Forms.FormTitle>
            <Forms.FormText>
                For detailed setup instructions including how to find your server URL and API keys/tokens, visit the <Link href="https://github.com/redbaron2k7/MediaStatus">Documentatiom</Link>
            </Forms.FormText>

            <Forms.FormDivider className="margin-top-8" />

            <Forms.FormText>
                Having issues? Check the common problems section in the documentation or open an issue on GitHub.
            </Forms.FormText>
        </>
    ),

    async start() {
        this.updatePresence();
        this.interval = setInterval(
            () => this.updatePresence(),
            settings.store.updateInterval * 1000
        );
    },

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = undefined;
        }
        this.clearPresence();
    },

    clearPresence() {
        FluxDispatcher.dispatch({
            type: "LOCAL_ACTIVITY_UPDATE",
            activity: null,
            socketId: "MediaStatus"
        });
    },

    async updatePresence() {
        try {
            const mediaData = await (settings.store.serverType === ServiceType.JELLYFIN ?
                fetchJellyfinData() :
                fetchPlexData());

            if (!mediaData || (mediaData.isPaused && settings.store.hideWhenPaused)) {
                this.clearPresence();
                return;
            }

            if (settings.store.hideWhenOtherActivity) {
                const activities = PresenceStore.getActivities();
                if (activities.some(a => a.application_id !== DISCORD_APP_ID)) {
                    this.clearPresence();
                    return;
                }
            }

            const getDetails = (): string => {
                switch (mediaData.type) {
                    case MediaType.EPISODE:
                        return `${mediaData.series} - ${formatEpisodeNumber(mediaData.season, mediaData.episode)}`;
                    case MediaType.AUDIO:
                        return `${mediaData.artist}${mediaData.albumTitle ? ` - ${mediaData.albumTitle}` : ""}`;
                    case MediaType.MOVIE:
                        return mediaData.title + (mediaData.year ? ` (${mediaData.year})` : "");
                    case MediaType.PHOTO:
                        return `Viewing ${mediaData.photographer ? `${mediaData.photographer}'s ` : ""}photo`;
                    default:
                        return mediaData.title;
                }
            };

            const getState = (): string => {
                const parts: string[] = [];

                if (mediaData.type === MediaType.EPISODE) {
                    parts.unshift(mediaData.title);
                }

                if (mediaData.type === MediaType.AUDIO && mediaData.albumTitle) {
                    parts.unshift(`from ${mediaData.albumTitle}`);
                }

                return parts.join(" • ") || "Watching";
            };

            const timestamps = settings.store.showTimestamps && mediaData.duration ? {
                start: Date.now() - (mediaData.position || 0),
                end: Date.now() + (mediaData.duration - (mediaData.position || 0))
            } : undefined;

            const assets = mediaData.imageUrl ? {
                large_image: await getApplicationAsset(mediaData.imageUrl),
                large_text: mediaData.title,
                small_image: await getApplicationAsset(`${settings.store.serverUrl}/web/favicon.png`),
                small_text: getServerName()
            } : undefined;

            const activityType = mediaData.type === MediaType.AUDIO ? 2 : 3;

            const activity = {
                application_id: DISCORD_APP_ID,
                name: mediaData.type === MediaType.EPISODE && settings.store.preferSeriesName ?
                    (mediaData.series || mediaData.title) :
                    mediaData.title,
                details: getDetails(),
                state: getState(),
                assets,
                timestamps,
                type: activityType,
                flags: 1 << 0
            };

            FluxDispatcher.dispatch({
                type: "LOCAL_ACTIVITY_UPDATE",
                activity,
                socketId: "MediaStatus"
            });

        } catch (err) {
            logger.error("Failed to update presence:", err);
            this.clearPresence();
        }
    }
});



