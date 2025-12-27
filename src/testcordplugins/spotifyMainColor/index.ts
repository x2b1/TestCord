/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { SpotifyStore } from "plugins/spotifyControls/SpotifyStore";

export default definePlugin({
    name: "SpotifyMainColor",
    description: "Get main color of now playing track and set as variable",
    authors: [Devs.nin0dev],
    async setTrackMainColor() {
        if (!SpotifyStore.track) {
            document.getElementById("vc-spotify-main-color")!.innerText = "";
            return;
        }
        const mainColor = await window.colorjs.average(SpotifyStore.track?.album.image.url, {
            format: "hex"
        });

        const style = document.createElement("style");
        style.setAttribute("id", "vc-spotify-main-color");
        style.textContent = `:root { --vc-spotify-main-color: ${mainColor}; }`;
        document.head.appendChild(style);
    },
    async start() {
        const cjs = await fetch("https://unpkg.com/color.js@1.2.0/dist/color.js");
        (0, eval)(await cjs.text());

        this.setTrackMainColor();

        SpotifyStore.addChangeListener(this.setTrackMainColor);
    },
    stop() {
        SpotifyStore.removeChangeListener(this.setTrackMainColor);
    }
});
