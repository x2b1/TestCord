/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { TestcordDevs } from "@utils/constants";
import { showItemInFolder } from "@utils/native";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";

const VoiceStateStore = findByPropsLazy("getVoiceStateForUser");
const UserStore = findByPropsLazy("getCurrentUser", "getUser");
const MediaEngineStore = findByPropsLazy("getInputDeviceId");

const settings = definePluginSettings({
    recordingEnabled: {
        type: OptionType.BOOLEAN,
        description: "Enable recording functionality",
        default: true,
    },
    autoStart: {
        type: OptionType.BOOLEAN,
        description: "Auto-start recording on VC join",
        default: true,
    },
    outputFolder: {
        type: OptionType.STRING,
        description: "Output folder (full path, e.g. C:/Recordings). Leave empty for Downloads",
        default: "",
    },
    lastSavedFile: {
        type: OptionType.STRING,
        description: "Last saved recording path",
        default: "",
    },
    controls: {
        type: OptionType.COMPONENT,
        component: function CallRecorderControls() {
            const { lastSavedFile, outputFolder, recordingEnabled, autoStart } = settings.use(["lastSavedFile", "outputFolder", "recordingEnabled", "autoStart"]);

            return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", gap: 6 }}>
                        <button
                            style={{ padding: "6px 10px", cursor: "pointer" }}
                            onClick={() => {
                                if (isRecording) stopRecording();
                                else startRecording();
                            }}
                        >{isRecording ? "Stop recording" : "Start recording"}</button>
                    </div>

                    <button
                        style={{ padding: "6px 10px", cursor: "pointer" }}
                        disabled={!lastSavedFile && !outputFolder}
                        onClick={() => {
                            let folder = "";
                            if (outputFolder?.trim()) {
                                folder = outputFolder.trim();
                            } else if (lastSavedFile?.trim()) {
                                const last = lastSavedFile.trim();
                                const parsed = last.replace(/[\\/]+$/, "");
                                folder = parsed.includes("\\") || parsed.includes("/") ? parsed.replace(/[^\\/]+$/, "") : "";
                            }

                            if (!folder) {
                                showNotification({ title: "CallRecorder", body: "No output folder configured" });
                                return;
                            }
                            showItemInFolder(folder);
                        }}
                    >Open recordings folder</button>

                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        Auto-start: {autoStart ? "enabled" : "disabled"} • Recording: {recordingEnabled ? "enabled" : "disabled"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        Path: {outputFolder || "Downloads"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        Last saved: {lastSavedFile || "none"}
                    </div>
                </div>
            );
        },
    }
});

let isRecording = false;
let isStopping = false;

function safeRequire(moduleName: string) {
    try {
        const req = (window as any).require || require;
        return req(moduleName);
    } catch {
        return null;
    }
}

function getFsHelpers() {
    const fs = safeRequire("fs");
    const path = safeRequire("path");
    const os = safeRequire("os");
    return { fs, path, os };
}

function resolveOutputFolder() {
    const configured = (settings.store.outputFolder || "").trim();
    if (configured) return configured;

    // Fallback to Downloads using Node APIs
    const { path, os } = getFsHelpers();
    if (path && os) {
        return path.join(os.homedir(), "Downloads");
    }

    // Last resort fallback
    const username = (DiscordNative as any)?.process?.env?.USERNAME;
    if (username) {
        return `C:/Users/${username}/Downloads`;
    }
    return null;
}

function getFileName() {
    const date = new Date();
    const formatted = date.toISOString().replace(/:/g, "-").replace(/\..+$/, "");
    return `call-${formatted}.ogg`;
}

async function saveRecordingFile(sourcePath) {
    console.log("CallRecorder: saveRecordingFile called with", sourcePath);

    if (!sourcePath) {
        console.log("CallRecorder: no sourcePath");
        showNotification({ title: "CallRecorder", body: "No source recording path returned." });
        return;
    }

    const folder = resolveOutputFolder();
    console.log("CallRecorder: resolved folder", folder);
    if (!folder) {
        console.log("CallRecorder: no folder");
        showNotification({ title: "CallRecorder", body: "Unable to determine output folder." });
        return;
    }

    let outputFileName = getFileName();
    console.log("CallRecorder: filename", outputFileName);

    try {
        // Try native helper first
        const vencordNative = (window as any).VencordNative;
        if (vencordNative?.pluginHelpers?.CallRecorder?.saveRecording) {
            console.log("CallRecorder: using native saveRecording");
            const result = await vencordNative.pluginHelpers.CallRecorder.saveRecording(sourcePath, folder, outputFileName);
            console.log("CallRecorder: saved successfully to", result);
            settings.store.lastSavedFile = result;
            showNotification({ title: "CallRecorder", body: `Saved recording to ${result}` });
            showItemInFolder(result);
            return;
        }

        // Fallback to fs if available
        const { fs, path } = getFsHelpers();
        if (fs && path) {
            const dir = path.dirname(sourcePath);
            const baseName = path.basename(sourcePath);

            // Try to rename to a better name
            try {
                const files = await new Promise<string[]>((resolve, reject) => {
                    fs.readdir(dir, (err, files) => {
                        if (err) reject(err);
                        else resolve(files);
                    });
                });

                const recordingFiles = files.filter(f => f.startsWith("recording ") && f.endsWith(".ogg"));
                const numbers = recordingFiles.map(f => {
                    const match = f.match(/^recording (\d+)\.ogg$/);
                    return match ? parseInt(match[1]) : 0;
                });
                const nextNum = Math.max(0, ...numbers) + 1;
                const newName = `recording ${nextNum}.ogg`;
                const newPath = path.join(dir, newName);

                await new Promise((resolve, reject) => {
                    fs.rename(sourcePath, newPath, err => {
                        if (err) reject(err);
                        else resolve(undefined);
                    });
                });

                console.log("CallRecorder: renamed to", newPath);
                showNotification({ title: "CallRecorder", body: `Recording saved as ${newName}` });
                showItemInFolder(newPath);
                return;
            } catch (renameErr) {
                console.log("CallRecorder: rename failed, using original path", renameErr);
                // Fall through to showing original path
            }

            // Copy to output folder with unique name if exists
            let fullDestPath = path.join(folder, outputFileName);
            let attempts = 0;
            while (true) {
                const existsPromise = new Promise(resolve => {
                    fs.access(fullDestPath, err => resolve(err == null));
                });
                const exists = await existsPromise;
                if (!exists) break;
                const name = path.basename(outputFileName, path.extname(outputFileName));
                const ext = path.extname(outputFileName);
                const randomDigits = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join("");
                outputFileName = `${name}-${randomDigits}${ext}`;
                fullDestPath = path.join(folder, outputFileName);
                attempts++;
                if (attempts > 100) {
                    throw new Error("Too many filename collisions");
                }
            }
            console.log("CallRecorder: copying file from", sourcePath, "to", fullDestPath);
            await new Promise((resolve, reject) => {
                fs.copyFile(sourcePath, fullDestPath, err => {
                    if (err) reject(err);
                    else resolve(undefined);
                });
            });
            console.log("CallRecorder: saved successfully to", fullDestPath);
            settings.store.lastSavedFile = fullDestPath;
            showNotification({ title: "CallRecorder", body: `Saved recording to ${fullDestPath}` });
            showItemInFolder(fullDestPath);
            return;
        }

        // Last resort: show the source path
        console.log("CallRecorder: cannot save file, showing source path");
        showNotification({ title: "CallRecorder", body: `Recording saved to temporary location: ${sourcePath}. Please copy it manually.` });
        showItemInFolder(sourcePath);
    } catch (err) {
        console.error("CallRecorder saveRecordingFile error", err);
        showNotification({ title: "CallRecorder", body: "Failed to save recording file." });
    }
}

async function startRecording() {
    if (!settings.store.recordingEnabled) {
        showNotification({ title: "CallRecorder", body: "Recording is disabled." });
        return;
    }

    if (isRecording) {
        showNotification({ title: "CallRecorder", body: "Recording already running." });
        return;
    }

    console.log("CallRecorder: startRecording called");

    if (typeof DiscordNative === "undefined") {
        console.error("CallRecorder: DiscordNative is undefined");
        showNotification({ title: "CallRecorder", body: "DiscordNative is not available." });
        return;
    }

    console.log("CallRecorder: DiscordNative exists", DiscordNative);

    if (!DiscordNative.nativeModules) {
        console.error("CallRecorder: DiscordNative.nativeModules is undefined");
        showNotification({ title: "CallRecorder", body: "DiscordNative.nativeModules is not available." });
        return;
    }

    console.log("CallRecorder: nativeModules exists", DiscordNative.nativeModules);

    if (typeof DiscordNative.nativeModules.requireModule !== "function") {
        console.error("CallRecorder: requireModule is not a function");
        showNotification({ title: "CallRecorder", body: "requireModule is not available." });
        return;
    }

    console.log("CallRecorder: requireModule is function");

    const discordVoice = DiscordNative.nativeModules.requireModule("discord_voice");
    console.log("CallRecorder: discordVoice module", discordVoice);

    if (!discordVoice) {
        console.error("CallRecorder: discord_voice module not found");
        showNotification({ title: "CallRecorder", body: "discord_voice module is unavailable." });
        return;
    }

    if (typeof discordVoice.startLocalAudioRecording !== "function") {
        console.error("CallRecorder: startLocalAudioRecording is not a function", discordVoice);
        showNotification({ title: "CallRecorder", body: "startLocalAudioRecording is not available." });
        return;
    }

    console.log("CallRecorder: startLocalAudioRecording is function");

    const deviceId = MediaEngineStore?.getInputDeviceId?.() || "";
    console.log("CallRecorder: deviceId", deviceId);

    discordVoice.startLocalAudioRecording(
        {
            echoCancellation: false,
            noiseCancellation: false,
            deviceId,
        },
        success => {
            console.log("CallRecorder: startLocalAudioRecording callback", success);
            if (!success) {
                showNotification({ title: "CallRecorder", body: "Failed to start recording." });
                return;
            }
            isRecording = true;
            showNotification({ title: "CallRecorder", body: "Recording started." });
        }
    );
}

function stopRecording() {
    console.log("CallRecorder: stopRecording called");

    const discordVoice = DiscordNative?.nativeModules?.requireModule?.("discord_voice");
    if (!discordVoice || typeof discordVoice.stopLocalAudioRecording !== "function") {
        console.error("CallRecorder: stopLocalAudioRecording not available");
        showNotification({ title: "CallRecorder", body: "stopLocalAudioRecording is unavailable." });
        return;
    }

    if (!isRecording || isStopping) return;
    isStopping = true;

    console.log("CallRecorder: calling stopLocalAudioRecording");

    discordVoice.stopLocalAudioRecording(async filePath => {
        console.log("CallRecorder: stopLocalAudioRecording callback", filePath);
        isRecording = false;
        isStopping = false;

        if (!filePath) {
            showNotification({ title: "CallRecorder", body: "Failed to stop recording or no file path." });
            return;
        }

        await saveRecordingFile(filePath);
    });
}

export default definePlugin({
    name: "CallRecorder",
    description: "Records Discord call audio on join and stops on leave, saves in a temp folder and the recording MIGHT be overwritten because of various electron limitations. (i tried all i could to fix it, but for now u gotta just drag the recording outta the folder if u wanna keep it for longer)",
    authors: [TestcordDevs.x2b],
    native: true,
    settings,
    flux: {
        VOICE_STATE_UPDATES() {
            const currentUser = UserStore.getCurrentUser?.();
            if (!currentUser) return;
            const selfState = VoiceStateStore.getVoiceStateForUser(currentUser.id);
            const inVoice = Boolean(selfState?.channelId);

            if (inVoice && !isRecording && settings.store.recordingEnabled && settings.store.autoStart) {
                startRecording();
            }

            if (!inVoice && isRecording) {
                stopRecording();
            }
        },
    },
    start() { },
    stop() { stopRecording(); },
});
