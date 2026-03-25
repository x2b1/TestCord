/*
 * TestCord, a Discord client mod
 * Copyright (c) 2024 Mixiruri
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { addContextMenuPatch, NavContextMenuPatchCallback, removeContextMenuPatch } from "@api/ContextMenu";
import { Link } from "@components/Link";
import { TestcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { showToast, Toasts, Menu } from "@webpack/common";
import { findByProps } from "@webpack";

// ─── Types ───────────────────────────────────────────────────────────────────

interface GifEntry {
    url: string;
    src: string;
    width: number;
    height: number;
    format: number;
    order: number;
}

// ─── Settings ────────────────────────────────────────────────────────────────

const settings = definePluginSettings({
    scanMode: {
        type: OptionType.SELECT,
        description: "Where to scan for GIFs",
        options: [
            { label: "Current channel only", value: "channel", default: true },
            { label: "Entire server", value: "server" },
        ],
    },
    saveMode: {
        type: OptionType.SELECT,
        description: "What to do with found GIFs",
        options: [
            { label: "Export to JSON file", value: "export", default: true },
            { label: "Add to favorites", value: "favorites" },
            { label: "Both (export + add to favorites)", value: "both" },
        ],
    },
    maxMessages: {
        type: OptionType.NUMBER,
        description: "Max messages to scan (99999 = all)",
        default: 99999,
    },
});

// ─── State ───────────────────────────────────────────────────────────────────

let isScanning = false;
let currentGifsFound = 0;
    const savePromises: Promise<void>[] = [];
let stopRequested = false;


// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

function getToken(): string | null {
    try {
        const TokenStore = findByProps("getToken");
        return TokenStore?.getToken() ?? null;
    } catch {
        return null;
    }
}

async function discordFetch(url: string): Promise<any> {
    const token = getToken();
    if (!token) return null;
    const res = await fetch("https://discord.com/api/v9" + url, {
        headers: { "Authorization": token }
    });
    if (res.status === 429) throw { status: 429 };
    if (!res.ok) return null;
    return res.json();
}

function getAddGifFn(): ((gif: any) => void) | null {
    const wreq = (window as any).Vencord?.Webpack?.wreq;
    if (!wreq?.c) return null;
    for (const key of Object.keys(wreq.c)) {
        try {
            const m = wreq.c[key].exports;
            for (const val of Object.values(m ?? {})) {
                if (typeof val === "function") {
                    const src = (val as Function).toString();
                    if (src.includes("favoriteGifs") && src.includes("order") && src.includes("updateAsync")) {
                        return val as (gif: any) => void;
                    }
                }
            }
        } catch { }
    }
    return null;
}

function getCurrentFavoriteUrls(): Set<string> {
    try {
        const wreq = (window as any).Vencord?.Webpack?.wreq;
        if (!wreq?.c) return new Set();
        for (const key of Object.keys(wreq.c)) {
            try {
                const m = wreq.c[key].exports;
                if (m?.bW && typeof m.bW === "object" && typeof m.bW.getCurrentValue === "function") {
                    const gifs = m.bW.getCurrentValue()?.favoriteGifs?.gifs ?? {};
                    return new Set(Object.keys(gifs));
                }
            } catch { }
        }
    } catch { }
    return new Set();
}

function getCurrentChannelId(): string | null {
    try {
        const wreq = (window as any).Vencord?.Webpack?.wreq;
        if (!wreq?.c) return null;
        for (const key of Object.keys(wreq.c)) {
            try {
                const m = wreq.c[key].exports;
                for (const val of Object.values(m ?? {})) {
                    if (val && typeof (val as any).getChannelId === "function") {
                        return (val as any).getChannelId();
                    }
                }
            } catch { }
        }
    } catch { }
    return null;
}

// ─── GIF Extraction ──────────────────────────────────────────────────────────

function extractGifsFromMessage(msg: any): GifEntry[] {
    const gifs: GifEntry[] = [];

    for (const att of msg.attachments ?? []) {
        const url: string = att.url ?? "";
        if (url.match(/\.gif/i) || att.content_type?.includes("gif")) {
            gifs.push({ url: att.url, src: att.proxy_url ?? att.url, width: att.width ?? 498, height: att.height ?? 280, format: 1, order: 0 });
        }
    }

    for (const embed of msg.embeds ?? []) {
        const embedUrl: string = embed.url ?? "";
        const videoUrl: string = embed.video?.url ?? "";
        const thumbUrl: string = embed.thumbnail?.url ?? embed.image?.url ?? "";
        if (embed.type === "gifv" || embedUrl.includes("tenor.com") || embedUrl.includes("giphy.com") || videoUrl.includes("tenor.com") || embedUrl.match(/\.gif/i)) {
            const finalUrl = embedUrl || videoUrl || thumbUrl;
            if (finalUrl) gifs.push({ url: finalUrl, src: videoUrl || thumbUrl || finalUrl, width: embed.video?.width ?? embed.thumbnail?.width ?? 498, height: embed.video?.height ?? embed.thumbnail?.height ?? 280, format: 2, order: 0 });
        }
    }

    const content: string = msg.content ?? "";
    for (const url of (content.match(/https?:\/\/[^\s<>"]+/g) ?? [])) {
        if (url.match(/\.gif(\?|$)/i) || url.includes("tenor.com/view/") || url.includes("giphy.com/gifs/") || url.includes("giphy.com/media/") || url.includes("klipy.com/gifs/") || url.includes("klipy.com/g/") || url.includes("media.tenor.com")) {
            gifs.push({ url, src: url, width: 498, height: 280, format: url.endsWith(".gif") ? 1 : 2, order: 0 });
        }
    }

    return gifs;
}

// ─── Search ───────────────────────────────────────────────────────────────────

async function searchMessages(
    guildId: string,
    userId: string,
    filter: { type: "content" | "has"; value: string; },
    maxResults: number,
    channelId: string | null,
    seen: Set<string>,
    label: string,
    onGifFound?: (g: GifEntry) => void
): Promise<GifEntry[]> {
    const gifs: GifEntry[] = [];
    let offset = 0;
    const pageSize = 25;
    let total = 0;

    do {
        if (stopRequested) break;

        let url = "/guilds/" + guildId + "/messages/search?author_id=" + userId + "&offset=" + offset + "&limit=" + pageSize;
        if (filter.type === "content") url += "&content=" + encodeURIComponent(filter.value);
        else url += "&has=" + filter.value;
        if (channelId) url += "&channel_id=" + channelId;

        try {
            const body = await discordFetch(url);
            if (!body) break;
            const messages: any[] = (body.messages ?? []).flat();
            total = body.total_results ?? 0;
            if (messages.length === 0) break;

            for (const msg of messages) {
                for (const g of extractGifsFromMessage(msg)) {
                    if (!seen.has(g.url)) {
                        seen.add(g.url);
                        gifs.push(g);
                        currentGifsFound++;
                        if (onGifFound) onGifFound(g);
                    }
                }
            }

            console.log("[SaveUserGifs] [" + label + "] " + (offset + messages.length) + "/" + total + " | GIFs: " + currentGifsFound);
            offset += pageSize;
            if (messages.length < pageSize) break;
            if (stopRequested) break;
            await sleep(800);
        } catch (e: any) {
            if (e?.status === 429) {
                console.warn("[SaveUserGifs] Rate limited, waiting 5s...");
                await sleep(5000);
                continue;
            }
            console.warn("[SaveUserGifs] Error:", e);
            break;
        }
    } while (offset < total && offset < maxResults);

    return gifs;
}

// ─── Main Scan ────────────────────────────────────────────────────────────────

async function scanUserGifs(userId: string, username: string, guildId: string | null): Promise<void> {
    if (isScanning) {
        showToast("Already scanning! Use the stop button.", Toasts.Type.FAILURE);
        return;
    }
    if (!guildId) {
        showToast("This plugin only works in servers, not DMs.", Toasts.Type.FAILURE);
        return;
    }

    const saveMode = settings.store.saveMode ?? "favorites";
    const maxMessages = settings.store.maxMessages ?? 99999;
    const mode = settings.store.scanMode ?? "channel";

    isScanning = true;
    stopRequested = false;
    currentGifsFound = 0;
    const savePromises: Promise<void>[] = [];

    const channelFilter = mode === "channel" ? (getCurrentChannelId() ?? null) : null;

    showToast(`Scanning GIFs from ${username}...`, Toasts.Type.MESSAGE);
    console.log(`[SaveUserGifs] Starting scan for ${username} (${userId})`);

    const addGif = getAddGifFn();
    const favUrls = getCurrentFavoriteUrls();
    const savedRealtime = new Set<string>();

    const onGifFound = (saveMode === "favorites" || saveMode === "both") && addGif
        ? (g: GifEntry) => {
            if (!favUrls.has(g.url) && !savedRealtime.has(g.url)) {
                savedRealtime.add(g.url);
                try { addGif({ url: g.url, src: g.src ?? g.url, width: Number(g.width) || 498, height: Number(g.height) || 280, format: Number(g.format) || 2 }); } catch { }
            }
        }
        : undefined;

    const seen = new Set<string>();
    const allGifs: GifEntry[] = [];
    const searches = [
        { type: "content" as const, value: "tenor.com", label: "tenor" },
        { type: "content" as const, value: "giphy.com", label: "giphy" },
        { type: "content" as const, value: "klipy.com", label: "klipy" },
        { type: "has" as const, value: "file", label: "files" },
    ];

    for (const s of searches) {
        if (stopRequested) break;
        const found = await searchMessages(guildId, userId, { type: s.type, value: s.value }, maxMessages, channelFilter, seen, s.label, onGifFound);
        allGifs.push(...found);
    }

    // Wait for all pending confirmations before reporting
    if (savePromises.length > 0) {
        showToast("Verifying saved GIFs...", Toasts.Type.MESSAGE);
        await Promise.all(savePromises);
    }

    isScanning = false;
    stopRequested = false;

    if (allGifs.length === 0) {
        showToast(`No GIFs found from ${username}.`, Toasts.Type.FAILURE);
        return;
    }

    if (saveMode === "export" || saveMode === "both") {
        const blob = new Blob([JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), collectedFrom: { userId, username }, totalGifs: allGifs.length, gifs: allGifs }, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `gifs-from-${username}-${Date.now()}.json`;
        a.click();
    }

    const alreadyHad = allGifs.filter(g => favUrls.has(g.url)).length;
    const saved = savedRealtime.size;

    console.log(`[SaveUserGifs] Done! Found: ${allGifs.length} | Saved: ${saved} | Already had: ${alreadyHad}`);
    showToast(`✅ Found ${allGifs.length} GIFs from ${username}`, Toasts.Type.SUCCESS);
    await sleep(1500);
    showToast(`Saved: ${saved} | Already had: ${alreadyHad}`, Toasts.Type.SUCCESS);
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

const userContextMenuPatch: NavContextMenuPatchCallback = (children, { user, guildId }) => {
    if (!user) return;
    children.push(
        <Menu.MenuSeparator />,
        <Menu.MenuItem
            id="save-user-gifs"
            label="Save GIFs from user"
            disabled={isScanning}
            action={() => scanUserGifs(user.id, user.username ?? user.globalName ?? user.id, guildId ?? null)}
        />,
        ...(isScanning ? [
            <Menu.MenuItem
                id="save-user-gifs-stop"
                label="⏹ Stop saving GIFs"
                action={() => {
                    stopRequested = true;
                    showToast("Stopping...", Toasts.Type.MESSAGE);
                }}
            />,
            <Menu.MenuItem
                id="save-user-gifs-status"
                label={`📊 ${currentGifsFound} GIFs found so far`}
                action={() => showToast(`${currentGifsFound} GIFs found so far`, Toasts.Type.MESSAGE)}
            />
        ] : [])
    );
};

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default definePlugin({
    name: "SaveUserGifs",
    description: "Right-click a user to save all GIFs they have sent to your favorites. Due to Discord's search API being non-deterministic, some GIFs may be missed on the first scan — simply run it again to pick up any remaining ones.",
    authors: [TestcordDevs.nnenaza],
    settings,

    settingsAboutComponent() {
        return (
            <div style={{ fontSize: "14px", lineHeight: "1.8" }}>
                <p style={{ marginBottom: "12px", color: "var(--header-secondary, #b9bbbe)" }}>
                    Right-click any user → <b style={{ color: "var(--header-primary, #fff)" }}>Save GIFs from user</b> to collect all GIFs they have sent. GIFs are saved to favorites in real-time as they are found.
                </p>
                <p style={{ marginBottom: "4px", color: "var(--header-primary, #fff)" }}>⚙️ <b>Scan Mode</b></p>
                <p style={{ marginBottom: "12px", color: "var(--header-secondary, #b9bbbe)" }}>
                    <b style={{ color: "var(--header-primary, #fff)" }}>Current channel</b> — only scans the channel you are in.<br />
                    <b style={{ color: "var(--header-primary, #fff)" }}>Entire server</b> — scans all channels.
                </p>
                <p style={{ marginBottom: "4px", color: "var(--header-primary, #fff)" }}>💾 <b>Save Mode</b></p>
                <p style={{ marginBottom: "12px", color: "var(--header-secondary, #b9bbbe)" }}>
                    <b style={{ color: "var(--header-primary, #fff)" }}>Export to JSON</b> — downloads a .json file.<br />
                    <b style={{ color: "var(--header-primary, #fff)" }}>Add to favorites</b> — adds directly to Discord GIF favorites.<br />
                    <b style={{ color: "var(--header-primary, #fff)" }}>Both</b> — exports and adds to favorites.
                </p>
                <p style={{ marginBottom: "8px", color: "var(--text-warning, #faa61a)", fontWeight: "700" }}>
                    ⚠️ You can stop the scan at any time by right-clicking any user and selecting "Stop saving GIFs". GIFs found so far will already be saved.
                </p>
                <p style={{ marginBottom: "16px", color: "var(--header-secondary, #b9bbbe)" }}>
                    Due to Discord's search API being non-deterministic, some GIFs may be missed on the first scan. Simply run it again on the same user to pick up any remaining ones — already saved GIFs will be skipped automatically.
                </p>
                <Link href="https://github.com/Mixiruri" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <img
                        src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"
                        alt="GitHub"
                        style={{ width: 20, height: 20, borderRadius: "50%", verticalAlign: "middle" }}
                    />
                    <span>Mixiruri on GitHub</span>
                </Link>
            </div>
        );
    },

    start() {
        addContextMenuPatch("user-context", userContextMenuPatch);
        addContextMenuPatch("user-profile-actions", userContextMenuPatch);
    },

    stop() {
        removeContextMenuPatch("user-context", userContextMenuPatch);
        removeContextMenuPatch("user-profile-actions", userContextMenuPatch);
    },
});
