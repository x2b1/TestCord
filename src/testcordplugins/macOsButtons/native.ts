/*
 * Equicord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BrowserWindow } from "electron";

function getWin(event: any) {
    // Get the window that sent the IPC event
    return BrowserWindow.fromWebContents(event.sender);
}

export function closeWindow(event: any) {
    getWin(event)?.close();
}

export function minimizeWindow(event: any) {
    getWin(event)?.minimize();
}

export function maximizeWindow(event: any) {
    const win = getWin(event);
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
}

export function isMaximized(event: any): boolean {
    return getWin(event)?.isMaximized() ?? false;
}
