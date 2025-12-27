/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher } from "@webpack/common";
import smd5 from "file://spark-md5.js?minify";

import { ServerConfig } from "./components/ServerConfig";
import { getApplicationAsset } from "./utils/constants";
import { getNowPlayingTrack, req } from "./utils/navidrome";
import { NowPlayingTrack } from "./utils/types";

const shp = {
    hidden: true,
    description: ""
};
export const settings = definePluginSettings({
    serverURL: {
        ...shp,
        type: OptionType.STRING
    },
    username: {
        ...shp,
        type: OptionType.STRING
    },
    isLoggedIn: {
        ...shp,
        type: OptionType.BOOLEAN,
        default: false
    },
    serverConfigComponent: {
        type: OptionType.COMPONENT,
        component: () => <ServerConfig />
    },
    delay: {
        type: OptionType.NUMBER,
        description: "Delay between the requests to Navidrome in milliseconds. 1000 = 1 second",
        default: 1000,
        restartNeeded: true
    },
    name: {
        type: OptionType.STRING,
        description: "The application name that'll show (Listening to _____). Use %ARTIST% to get the main artist, %ARTISTS% to get all artists, %ALBUM% to get the album and %TRACK% to get the track",
        default: "Navidrome"
    },
    shouldCalculateTimestamps: {
        type: OptionType.BOOLEAN,
        description: "Show the song progress with start and finish times, if disabled will only show start time (how many mins ago). Insanely buggy",
        default: false
    }
});

export default definePlugin({
    name: "NavidromeRPC",
    description: "Show the currently playing song on your Navidrome server in your Rich Presence",
    authors: [Devs.nin0dev],
    settings,
    interval: -1,
    start() {
        (0, eval)(smd5);
        settings.store.isLoggedIn && this.initRPC();
    },
    stop() {
        delete window.SparkMD5;
        FluxDispatcher.dispatch({
            type: "LOCAL_ACTIVITY_UPDATE",
            activity: null,
            socket: "NavidromeRPC"
        });
        clearInterval(this.interval);
    },
    req,
    getNowPlayingTrack,
    initRPC() {
        const fn = async () => {
            try {
                await this.setRichPresence(await getNowPlayingTrack());
            } catch (e) {
                console.error(e);
                FluxDispatcher.dispatch({
                    type: "LOCAL_ACTIVITY_UPDATE",
                    activity: null,
                    socket: "NavidromeRPC"
                });
                clearInterval(this.interval);
                setTimeout(() => {
                    // @ts-expect-error
                    this.interval = setInterval(fn, settings.store.delay);
                }, 5000);
            }
        };

        fn();
        // @ts-expect-error
        this.interval = setInterval(fn, settings.store.delay);
    },
    async setRichPresence(track: NowPlayingTrack) {
        if (!track.isPlaying) {
            return void FluxDispatcher.dispatch({
                type: "LOCAL_ACTIVITY_UPDATE",
                activity: null,
                socket: "NavidromeRPC"
            });
        }

        let times = {

        };
        if (settings.store.shouldCalculateTimestamps) times = {
            timestamps: track.timestamps!
        };

        FluxDispatcher.dispatch({
            type: "LOCAL_ACTIVITY_UPDATE",
            activity: {
                application_id: "1396969056136986775",
                name: settings.store.name
                    .replaceAll("%ARTIST%", track.artists![0])
                    .replaceAll("%ARTISTS%", track.artists!.join(", "))
                    .replaceAll("%ALBUM%", track.album!.name)
                    .replaceAll("%TRACK%", track.title!),
                type: 2,
                status_display_type: 1,

                details: track.title!,
                state: track.artists!.join(", "),
                assets: {
                    large_image: await getApplicationAsset(track.album!.art),
                    large_text: track.album!.name
                },
                ...times
            },
            socketId: "NavidromeRPC",
        });
    }
});
