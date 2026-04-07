/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { decompressFrames, parseGIF } from "gifuct-js";

import type { CaptionMedia, GifTransform } from "../types";
import { looksLikeGif } from "../utils/media";
import GifRenderer from "./gifRenderer";
import captionMp4 from "./mp4";

export default async function captionGif(media: CaptionMedia, transform: GifTransform) {
    if (!looksLikeGif(media)) {
        await captionMp4(media, transform);
        return;
    }

    const parsed = parseGIF(media.buffer);
    const frames = decompressFrames(parsed, true);
    const renderer = new GifRenderer({
        frames: frames.length,
        width: transform.width,
        height: transform.height,
        transform
    });

    while (frames.length > 0) {
        const frame = frames.shift();
        if (!frame) break;

        renderer.addGifFrame(frame, parsed);
        await new Promise(resolve => setTimeout(resolve));
    }

    renderer.render();
}
