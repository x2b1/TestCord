/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Link } from "@components/Link";
import { TestcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { showToast, Toasts } from "@webpack/common";

// ─── Types ───────────────────────────────────────────────────────────────────

interface GifEntry {
    url: string;
    src: string;
    width: number;
    height: number;
    format: number;
    order: number;
}

interface ExportFile {
    version: number;
    exportedAt: string;
    totalGifs: number;
    gifs: GifEntry[];
}

// ─── Settings ────────────────────────────────────────────────────────────────

const settings = definePluginSettings({
    skipDuplicates: {
        type: OptionType.BOOLEAN,
        description: "Skip GIFs that are already in your favorites when importing",
        default: true,
    },
    delayBetweenImports: {
        type: OptionType.NUMBER,
        description: "Wait between each GIF when importing (ms). Prevents Discord rate-limits.",
        default: 500,
    },
});

// ─── Rate-limit tracking ─────────────────────────────────────────────────────

let rateLimitUntil = 0; // timestamp ms — block imports until this time
let lastStatusCode = 0; // last HTTP status seen on settings-proto/2

function patchFetch(): () => void {
    const orig = window.fetch.bind(window);
    (window as any).__gifTransferOrigFetch = orig;

    window.fetch = async function (...args: Parameters<typeof fetch>) {
        const req = args[0];
        const url = typeof req === "string" ? req : (req as Request).url ?? "";

        const res = await orig(...args);

        if (url.includes("settings-proto")) {
            lastStatusCode = res.status;
            if (res.status === 429) {
                // Retry-After header (in seconds), fallback 10s
                const retryAfter = Number(res.headers.get("retry-after") ?? "10");
                const waitMs = (retryAfter + 2) * 1000;
                rateLimitUntil = Date.now() + waitMs;
                console.warn(`[GifTransfer] 429 — waiting ${retryAfter + 2}s before next import`);
            } else if (res.status === 400) {
                // 50105 — too many favorites server-side, wait longer
                rateLimitUntil = Date.now() + 15_000;
                console.warn("[GifTransfer] 400 Bad Request on settings-proto — waiting 15s");
            }
        }

        return res;
    };

    return () => {
        window.fetch = orig;
        delete (window as any).__gifTransferOrigFetch;
    };
}

let unpatchFetch: (() => void) | null = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getFrecencyStore(): any {
    const wreq = (window as any).Vencord?.Webpack?.wreq;
    if (!wreq?.c) return null;
    for (const key of Object.keys(wreq.c)) {
        try {
            const m = wreq.c[key].exports;
            if (m?.bW && typeof m.bW === "object" && typeof m.bW.getCurrentValue === "function") {
                return m.bW;
            }
        } catch { }
    }
    return null;
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

function getCurrentGifs(): Record<string, GifEntry> {
    const store = getFrecencyStore();
    if (!store) return {};
    try {
        const state = store.getCurrentValue();
        return state?.favoriteGifs?.gifs ?? {};
    } catch {
        return {};
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

async function waitForRateLimit(): Promise<void> {
    const now = Date.now();
    if (rateLimitUntil > now) {
        const wait = rateLimitUntil - now;
        console.log(`[GifTransfer] Rate limited — waiting ${Math.ceil(wait / 1000)}s...`);
        showToast(`Rate limited! Waiting ${Math.ceil(wait / 1000)}s...`, Toasts.Type.FAILURE);
        await sleep(wait + 500); // extra 500ms buffer
    }
}

// ─── Export ──────────────────────────────────────────────────────────────────

async function exportGifs(): Promise<void> {
    const gifs = getCurrentGifs();
    const entries = Object.entries(gifs);

    if (entries.length === 0) {
        showToast("No favorite GIFs found to export.", Toasts.Type.FAILURE);
        return;
    }

    const gifsArray: GifEntry[] = entries.map(([url, data]: [string, any]) => ({
        url,
        src: data.src,
        width: Number(data.width) || 498,
        height: Number(data.height) || 280,
        format: Number(data.format) || 2,
        order: Number(data.order) || 0,
    }));

    const exportData: ExportFile = {
        version: 2,
        exportedAt: new Date().toISOString(),
        totalGifs: gifsArray.length,
        gifs: gifsArray,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gif-favorites-${Date.now()}.json`;
    a.click();

    showToast(`Exported ${gifsArray.length} GIFs successfully!`, Toasts.Type.SUCCESS);
}

// ─── Verify ──────────────────────────────────────────────────────────────────

async function verifyGifs(file: File): Promise<void> {
    try {
        const text = await file.text();
        const data: ExportFile = JSON.parse(text);

        if (!data.gifs || !Array.isArray(data.gifs)) {
            showToast("Invalid file format.", Toasts.Type.FAILURE);
            return;
        }

        const currentGifs = getCurrentGifs();
        const currentUrls = new Set(Object.keys(currentGifs));

        let found = 0;
        let missing = 0;
        let duplicates = 0;
        const missingList: string[] = [];

        for (const gif of data.gifs) {
            if (currentUrls.has(gif.url)) {
                found++;
            } else {
                missing++;
                missingList.push(gif.url);
            }
        }

        const urlsSeen = new Set<string>();
        for (const gif of data.gifs) {
            if (urlsSeen.has(gif.url)) duplicates++;
            else urlsSeen.add(gif.url);
        }

        const report = [
            "=== GIF Verification Report ===",
            `Total in file: ${data.gifs.length}`,
            `Found in favorites: ${found}`,
            `Missing from favorites: ${missing}`,
            `Duplicate URLs in file: ${duplicates}`,
            missing > 0
                ? `\nMissing GIFs:\n${missingList.slice(0, 10).join("\n")}${missingList.length > 10 ? `\n...and ${missingList.length - 10} more` : ""}`
                : "\nAll GIFs are present! ✅",
        ].join("\n");

        console.log(report);

        if (missing === 0) {
            showToast(`All ${found} GIFs verified! No missing GIFs. ✅`, Toasts.Type.SUCCESS);
        } else {
            showToast(`Missing ${missing} GIFs. Press Import again to retry. Check console for details.`, Toasts.Type.FAILURE);
        }
    } catch (e) {
        showToast("Failed to read file.", Toasts.Type.FAILURE);
        console.error("[GifTransfer] Verify error:", e);
    }
}

// ─── Import ──────────────────────────────────────────────────────────────────

async function importGifs(file: File): Promise<void> {
    const addGif = getAddGifFn();
    if (!addGif) {
        showToast("Could not find Discord's internal GIF function. Try reloading Discord.", Toasts.Type.FAILURE);
        return;
    }

    let data: ExportFile;
    try {
        data = JSON.parse(await file.text());
    } catch {
        showToast("Invalid JSON file.", Toasts.Type.FAILURE);
        return;
    }

    if (!data.gifs || !Array.isArray(data.gifs)) {
        showToast("Invalid file format.", Toasts.Type.FAILURE);
        return;
    }

    const seen = new Set<string>();
    const deduped = data.gifs.filter(gif => {
        if (seen.has(gif.url)) return false;
        seen.add(gif.url);
        return true;
    });

    const filedupes = data.gifs.length - deduped.length;
    if (filedupes > 0) console.log(`[GifTransfer] Removed ${filedupes} duplicate URLs from import file.`);

    const currentGifs = getCurrentGifs();
    const currentUrls = new Set(Object.keys(currentGifs));

    const toImport = settings.store.skipDuplicates
        ? deduped.filter(gif => !currentUrls.has(gif.url))
        : deduped;

    const skipped = deduped.length - toImport.length;

    if (toImport.length === 0) {
        showToast("All GIFs are already in your favorites. Nothing to import. ✅", Toasts.Type.MESSAGE);
        return;
    }

    showToast(`Importing ${toImport.length} GIFs... (${skipped} skipped as duplicates)`, Toasts.Type.MESSAGE);
    console.log(`[GifTransfer] Starting import: ${toImport.length} GIFs | Skipping: ${skipped} | File dupes removed: ${filedupes}`);

    let ok = 0;
    let err = 0;
    let retries = 0;
    const delay = settings.store.delayBetweenImports ?? 500;
    const MAX_RETRIES_PER_GIF = 3;

    for (let i = 0; i < toImport.length; i++) {
        const gif = toImport[i];

        // Wait if we're rate limited before attempting
        await waitForRateLimit();

        let gifOk = false;
        for (let attempt = 0; attempt < MAX_RETRIES_PER_GIF; attempt++) {
            if (attempt > 0) {
                // Before retrying, wait for rate limit again
                await waitForRateLimit();
                console.log(`[GifTransfer] Retrying GIF ${i + 1}/${toImport.length} (attempt ${attempt + 1})`);
                retries++;
            }

            try {
                addGif({
                    url: gif.url,
                    src: gif.src ?? gif.url,
                    width: Number(gif.width) || 498,
                    height: Number(gif.height) || 280,
                    format: Number(gif.format) || 2,
                });

                // Small pause to let the fetch fire and our interceptor update rateLimitUntil
                await sleep(150);

                // If rate limit was just triggered by this gif, retry it
                if (rateLimitUntil > Date.now()) {
                    continue; // retry loop
                }

                gifOk = true;
                ok++;
                break;
            } catch (e) {
                console.warn("[GifTransfer] Failed to import GIF:", gif.url, e);
                break; // don't retry on exception (not a rate limit)
            }
        }

        if (!gifOk && rateLimitUntil <= Date.now()) {
            // All retries exhausted and not rate limited — real error
            err++;
        }

        await sleep(delay);

        if ((ok + err) % 50 === 0)
            console.log(`[GifTransfer] Progress: ${ok + err}/${toImport.length} | OK: ${ok} | Errors: ${err} | Retries: ${retries}`);
    }

    console.log(`[GifTransfer] ✅ Done! Imported: ${ok} | Errors: ${err} | Retries: ${retries} | Skipped: ${skipped}`);
    showToast(`Import complete! ${ok} GIFs added, ${skipped} duplicates skipped, ${err} errors.`, ok > 0 ? Toasts.Type.SUCCESS : Toasts.Type.FAILURE);
}

// ─── File Picker Helper ───────────────────────────────────────────────────────

function openFilePicker(onFile: (file: File) => void): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (file) onFile(file);
    };
    input.click();
}

// ─── DOM Injection ───────────────────────────────────────────────────────────

const BUTTONS_ID = "gif-transfer-buttons";

function createButton(label: string, title: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.title = title;
    btn.setAttribute("data-gif-transfer", "true");
    Object.assign(btn.style, {
        background: "none",
        border: "1px solid var(--interactive-normal, #b9bbbe)",
        borderRadius: "4px",
        color: "var(--interactive-normal, #b9bbbe)",
        cursor: "pointer",
        fontSize: "12px",
        fontWeight: "600",
        fontFamily: "var(--font-primary, Whitney)",
        padding: "2px 8px",
        margin: "0 2px",
        height: "24px",
        lineHeight: "1",
        transition: "background 0.15s, color 0.15s, border-color 0.15s",
        whiteSpace: "nowrap",
        flexShrink: "0",
    });
    btn.addEventListener("mouseenter", () => {
        btn.style.background = "var(--brand-500, #5865f2)";
        btn.style.color = "#fff";
        btn.style.borderColor = "var(--brand-500, #5865f2)";
    });
    btn.addEventListener("mouseleave", () => {
        btn.style.background = "none";
        btn.style.color = "var(--interactive-normal, #b9bbbe)";
        btn.style.borderColor = "var(--interactive-normal, #b9bbbe)";
    });
    btn.addEventListener("click", e => {
        e.stopPropagation();
        onClick();
    });
    return btn;
}

function injectButtons(navList: Element): void {
    if (navList.querySelector(`#${BUTTONS_ID}`)) return;

    const wrapper = document.createElement("div");
    wrapper.id = BUTTONS_ID;
    Object.assign(wrapper.style, {
        display: "flex",
        alignItems: "center",
        marginLeft: "auto",
        paddingRight: "8px",
        gap: "4px",
        pointerEvents: "all",
    });

    wrapper.appendChild(createButton("Export", "Export favorite GIFs to JSON file", () => exportGifs()));
    wrapper.appendChild(createButton("Import", "Import favorite GIFs from JSON file (skips duplicates)", () => openFilePicker(f => importGifs(f))));
    wrapper.appendChild(createButton("Verify", "Check which GIFs from a file are missing from your favorites", () => openFilePicker(f => verifyGifs(f))));

    (navList as HTMLElement).style.display = "flex";
    (navList as HTMLElement).style.alignItems = "center";

    navList.appendChild(wrapper);
}

function tryInject(): void {
    const allTabLists = document.querySelectorAll('[role="tablist"]');
    for (const tl of allTabLists) {
        const label = (tl.getAttribute("aria-label") ?? "").toLowerCase();
        if (
            label.includes("expresi") ||
            label.includes("expression") ||
            label.includes("categor") ||
            label.includes("selector") ||
            label.includes("picker")
        ) {
            const activeTab = tl.querySelector('[role="tab"][aria-selected="true"]');
            const activeIsGif =
                activeTab?.textContent?.trim().toUpperCase() === "GIF" ||
                activeTab?.id === "gif-picker-tab" ||
                activeTab?.closest("[id*=gif-picker]") != null;
            if (activeIsGif) {
                injectButtons(tl);
            } else {
                tl.querySelector("#" + BUTTONS_ID)?.remove();
            }
            return;
        }
    }
}

let observer: MutationObserver | null = null;

function startObserver(): void {
    observer = new MutationObserver(() => tryInject());
    observer.observe(document.body, { childList: true, subtree: true });
    tryInject();
}

function stopObserver(): void {
    observer?.disconnect();
    observer = null;
    document.querySelectorAll(`#${BUTTONS_ID}`).forEach(el => el.remove());
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default definePlugin({
    name: "GifTransfer",
    description: "Export and import all your favorite GIFs between accounts using a JSON file.",
    authors: [TestcordDevs.nnenaza],
    settings,

    settingsAboutComponent() {
        return (
            <div style={{ fontSize: "14px", lineHeight: "1.8" }}>
                <p style={{ marginBottom: "12px", color: "var(--header-secondary, #b9bbbe)" }}>
                    Adds <b style={{ color: "var(--header-primary, #fff)" }}>Export</b>, <b style={{ color: "var(--header-primary, #fff)" }}>Import</b>, and <b style={{ color: "var(--header-primary, #fff)" }}>Verify</b> buttons to the GIF picker tab bar,
                    so you can transfer your favorite GIFs between Discord accounts.
                </p>

                <p style={{ marginBottom: "4px", color: "var(--header-primary, #fff)" }}>📤 <b>Export</b> <span style={{ color: "var(--header-secondary, #b9bbbe)", fontWeight: "normal" }}>— saves all your favorite GIFs to a .json file.</span></p>
                <p style={{ marginBottom: "4px", color: "var(--header-primary, #fff)" }}>📥 <b>Import</b> <span style={{ color: "var(--header-secondary, #b9bbbe)", fontWeight: "normal" }}>— loads GIFs from a .json file. Skips duplicates automatically.</span></p>
                <p style={{ marginBottom: "16px", color: "var(--header-primary, #fff)" }}>🔍 <b>Verify</b> <span style={{ color: "var(--header-secondary, #b9bbbe)", fontWeight: "normal" }}>— checks which GIFs from a file are missing from your favorites. Check the console for the full report.</span></p>

                <p style={{ marginBottom: "6px", color: "#faa61a", fontWeight: "700", fontSize: "13px" }}>
                    ⚠️ Discord Rate Limits
                </p>
                <p style={{ marginBottom: "16px", color: "var(--header-secondary, #b9bbbe)" }}>
                    The plugin now <b style={{ color: "var(--header-primary, #fff)" }}>auto-detects 429 and 400 errors</b> and
                    pauses automatically until Discord allows more requests. No need to manually increase the delay —
                    but you can still raise it if you want extra safety.
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
        unpatchFetch = patchFetch();
        startObserver();
    },

    stop() {
        unpatchFetch?.();
        unpatchFetch = null;
        stopObserver();
    },

    toolboxActions: {
        "Export Favorite GIFs"() {
            exportGifs();
        },
        "Import Favorite GIFs"() {
            openFilePicker(file => importGifs(file));
        },
        "Verify GIFs (compare file vs favorites)"() {
            openFilePicker(file => verifyGifs(file));
        },
    },
});