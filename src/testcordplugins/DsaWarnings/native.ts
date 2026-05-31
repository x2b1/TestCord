/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { RendererSettings } from "@main/settings";
import { BrowserWindow, IpcMainInvokeEvent, session, shell } from "electron";

import type { NativeCordCatResult } from "./types";

const pluginSettings = RendererSettings.store.plugins?.DsaWarnings;
const BASE_URL = pluginSettings?.dsaBrowseBaseUrl || "https://dsa.discord.food";
const CORDBASE_URL = pluginSettings?.cordCatApiBaseUrl || "https://api.cord.cat";
const PARTITION = "persist:dsa-warnings";
const FETCH_TIMEOUT_MS = 10_000;
const WINDOW_WIDTH = 1120;
const WINDOW_HEIGHT = 860;

let captchaWindow: BrowserWindow | null = null;

function getMainWindow() {
    return BrowserWindow.getAllWindows().find(window => !window.isDestroyed()) ?? null;
}

function getSession() {
    return session.fromPartition(PARTITION, { cache: true });
}

function buildBrowseUrl(parsedId?: string) {
    const url = new URL("/browse", BASE_URL);
    if (parsedId) url.searchParams.set("parsedId", parsedId);
    url.searchParams.set("sort", "applicationDate");
    url.searchParams.set("order", "desc");
    return url.toString();
}

function focusWindow(window: BrowserWindow) {
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
}

export async function openCaptchaWindow(_: IpcMainInvokeEvent, parsedId?: string) {
    if (captchaWindow && !captchaWindow.isDestroyed()) {
        focusWindow(captchaWindow);
        if (parsedId) {
            await captchaWindow.loadURL(buildBrowseUrl(parsedId));
        }
        return { ok: true };
    }

    const parent = getMainWindow();
    const win = new BrowserWindow({
        width: WINDOW_WIDTH,
        height: WINDOW_HEIGHT,
        minWidth: 900,
        minHeight: 680,
        title: "DSA Lookup Verification",
        parent: parent ?? undefined,
        autoHideMenuBar: true,
        show: false,
        webPreferences: {
            partition: PARTITION,
            sandbox: false,
            contextIsolation: true
        }
    });

    captchaWindow = win;
    win.on("closed", () => {
        if (captchaWindow === win) captchaWindow = null;
    });

    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: "deny" };
    });

    await win.loadURL(buildBrowseUrl(parsedId));
    win.once("ready-to-show", () => focusWindow(win));

    return await new Promise<{ ok: boolean; }>(resolve => {
        win.once("closed", () => resolve({ ok: true }));
    });
}

export async function fetchCordCatQuery(_: IpcMainInvokeEvent, parsedId: string): Promise<NativeCordCatResult> {
    try {
        const url = `${CORDBASE_URL}/api/v2/query/${encodeURIComponent(parsedId)}`;
        const response = await fetch(url, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
        });

        return {
            ok: true,
            status: response.status,
            body: await response.text()
        };
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}
