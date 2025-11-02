/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";
import { showToast } from "@webpack/common";

import GIF from "./gif.js";
import { decompressFrames, parseGIF } from "./gifuct.js";

// ok so dis just setup basic plugin stuff nothing fancy
const PLUGIN_ID = "GifCaptioner";
const BUTTON_CLASS = "gc-caption-btn";

// makes lil caption btn overlay for gifs
function createOverlayButton() {
    const btn = document.createElement("button");
    btn.className = BUTTON_CLASS;
    btn.type = "button";
    btn.title = "Add caption";
    btn.innerText = "caption";
    Object.assign(btn.style, {
        position: "absolute",
        right: "6px",
        bottom: "6px",
        zIndex: "999",
        padding: "4px 6px",
        fontSize: "12px",
        borderRadius: "6px",
        border: "none",
        background: "rgba(0,0,0,0.65)",
        color: "white",
        cursor: "pointer",
    });
    return btn;
}

// fetch gif to arraybuffer so we can edit it
async function fetchArrayBuffer(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("cant fetch gif bro");
    return await res.arrayBuffer();
}

// main caption proc kinda jank but works
async function processGifWithCaption(arrayBuffer, caption) {
    const parsed = parseGIF(arrayBuffer);
    const frames = decompressFrames(parsed, true);
    if (!frames || frames.length === 0) throw new Error("no frames??");

    const gif = new GIF({ workers: 2, quality: 10 });
    const { width } = parsed.lsd;
    const { height } = parsed.lsd;

    for (const f of frames) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas context not available");

        const imageData = ctx.createImageData(f.dims.width, f.dims.height);
        imageData.data.set(f.patch || []);
        ctx.putImageData(imageData, f.dims.left, f.dims.top);

        const padding = 8;
        const captionHeight = 28;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, height - captionHeight - padding, width, captionHeight + padding);

        ctx.font = "18px sans-serif";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "white";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 3;
        const x = padding;
        const y = height - captionHeight / 2 - padding / 2;
        ctx.strokeText(caption, x, y);
        ctx.fillText(caption, x, y);

        gif.addFrame(canvas, { delay: f.delay || 100 });
    }

    return await new Promise((resolve, reject) => {
        gif.on("finished", blob => resolve(blob));
        gif.on("abort", () => reject(new Error("rip gif render fail")));
        try {
            gif.render();
        } catch (err) {
            reject(err);
        }
    });
}

// drop da file into discord composer kinda hacky
function dropFileToComposer(file) {
    const composer = document.querySelector("div[data-slate-node]") || document.querySelector("textarea[data-slate-node]");
    if (!composer) return false;

    const dt = new DataTransfer();
    dt.items.add(file);
    const event = new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
    });
    composer.dispatchEvent(event);
    return true;
}

export default definePlugin({
    name: "GifCaptioner",
    description: "Add captions to GIFs before sendin em",
    authors: [{ name: "TheLazySquid", id: BigInt("619261917352951815") }],

    start() {
        this.observer = new MutationObserver(this.onMutations.bind(this));
        this.observer.observe(document.body, { childList: true, subtree: true });
        this.scanAndAttach();
    },

    stop() {
        if (this.observer) this.observer.disconnect();
        document.querySelectorAll(`.${BUTTON_CLASS}`).forEach(b => b.remove());
    },

    observer: null as MutationObserver | null,

    onMutations(muts) {
        for (const m of muts) {
            if (m.addedNodes && m.addedNodes.length) this.scanAndAttach();
        }
    },

    // find gifs and add da btn
    scanAndAttach() {
        // More specific selector to avoid server icons and other non-GIF images
        const imgs = Array.from(document.querySelectorAll("img[src*='.gif']:not([src*='guilds']):not([src*='avatars']):not([class*='guild'])"));
        for (const img of imgs) {
            // Skip if this looks like a server icon or avatar
            if ((img as HTMLImageElement).src.includes("/guilds/") || (img as HTMLImageElement).src.includes("/avatars/") || img.classList.contains("guildIcon")) continue;

            const wrapper = img.closest(".image-2tk21A, .imageContainer-2wCq4N, .imageWrapper-2bJf5f, .embedMedia-1mdW, .attachment-1PZZB") || img.parentElement;
            if (!wrapper) continue;
            if (wrapper.querySelector(`.${BUTTON_CLASS}`)) continue;

            const style = getComputedStyle(wrapper);
            if (style.position === "static") (wrapper as HTMLElement).style.position = "relative";

            const btn = createOverlayButton();
            btn.addEventListener("click", async e => {
                e.stopPropagation();
                const caption = prompt("enter caption text:");
                if (caption === null) return;
                try {
                    showToast("processing gif... hold on");
                    const buffer = await fetchArrayBuffer((img as HTMLImageElement).src);
                    const blob = await processGifWithCaption(buffer, caption);
                    const file = new File([blob as BlobPart], "captioned.gif", { type: "image/gif" });
                    const dropped = dropFileToComposer(file);
                    if (!dropped) {
                        const url = URL.createObjectURL(blob as Blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "captioned.gif";
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                        showToast("downloaded gif caption done");
                    } else {
                        showToast("captioned gif added to msg box");
                    }
                } catch (err) {
                    console.error(err);
                    showToast("failed caption gif :(");
                }
            });

            wrapper.appendChild(btn);
        }
    },
});
