/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { app } from "electron";
import { copyFile, mkdir } from "fs/promises";
import { join, normalize } from "path";

export async function saveRecording(_: any, sourcePath: string, folder: string, filename: string) {
    sourcePath = normalize(sourcePath);
    const destPath = join(folder, filename);
    const sourceFilename = sourcePath.split(/[/\\]/).pop() || "";
    const discordBaseDirWithTrailingSlash = normalize(app.getPath("userData") + "/");
    if (!/^\d*recording\.ogg$/.test(sourceFilename) || !sourcePath.startsWith(discordBaseDirWithTrailingSlash)) {
        throw new Error("Invalid source path");
    }

    try {
        await mkdir(folder, { recursive: true });
        await copyFile(sourcePath, destPath);
        return destPath;
    } catch (err) {
        console.error("saveRecording error", err);
        throw err;
    }
}
