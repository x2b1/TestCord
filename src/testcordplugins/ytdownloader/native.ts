/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChildProcessWithoutNullStreams, execFileSync, spawn } from "child_process";
import { IpcMainInvokeEvent } from "electron";
import * as fs from "fs";
import os from "os";
import path from "path";

type Format = "video" | "audio";
type DownloadOptions = {
    url: string;
    format: Format;
    quality?: string;
    maxFileSize?: number;
};

let workdir: string | null = null;
let stdout_global: string = "";
let logs_global: string = "";

let ytdlpAvailable = false;
let denoAvailable = false;
let ffmpegAvailable = false;

let ytdlpProcess: ChildProcessWithoutNullStreams | null = null;
let ffmpegProcess: ChildProcessWithoutNullStreams | null = null;

const getdir = () => workdir ?? process.cwd();
const p = (file: string) => path.join(getdir(), file);
const cleanVideoFiles = () => {
    if (!workdir) return;
    fs.readdirSync(workdir)
        .filter(f => f !== "." && f !== "..")
        .forEach(f => fs.unlinkSync(p(f)));
};
const appendOut = (data: string) => (
    (stdout_global += data), (stdout_global = stdout_global.replace(/^.*\r([^\n])/gm, "$1")));
const log = (...data: string[]) => (console.log(`[Plugin:YTdownloader] ${data.join(" ")}`), logs_global += `[Plugin:YTdownloader] ${data.join(" ")}\n`);
const error = (...data: string[]) => console.error(`[Plugin:YTdownloader] [ERROR] ${data.join(" ")}`);

function ytdlp(args: string[]): Promise<string> {
    log(`Executing yt-dlp with args: ["${args.map(a => a.replace('"', '\\"')).join('", "')}"]`);
    let errorMsg = "";

    return new Promise<string>((resolve, reject) => {
        ytdlpProcess = spawn("yt-dlp", args, {
            cwd: getdir(),
        });

        ytdlpProcess.stdout.on("data", data => appendOut(data));
        ytdlpProcess.stderr.on("data", data => {
            appendOut(data);
            error(`yt-dlp encountered an error: ${data}`);
            errorMsg += data;
        });
        ytdlpProcess.on("exit", code => {
            ytdlpProcess = null;
            code === 0 ? resolve(stdout_global) : reject(new Error(errorMsg || `yt-dlp exited with code ${code}`));
        });
    });
}

function ffmpeg(args: string[]): Promise<string> {
    log(`Executing ffmpeg with args: ["${args.map(a => a.replace('"', '\\"')).join('", "')}"]`);
    let errorMsg = "";

    return new Promise<string>((resolve, reject) => {
        ffmpegProcess = spawn("ffmpeg", args, {
            cwd: getdir(),
        });

        ffmpegProcess.stdout.on("data", data => appendOut(data));
        ffmpegProcess.stderr.on("data", data => {
            appendOut(data);
            error(`ffmpeg encountered an error: ${data}`);
            errorMsg += data;
        });
        ffmpegProcess.on("exit", code => {
            ffmpegProcess = null;
            code === 0 ? resolve(stdout_global) : reject(new Error(errorMsg || `ffmpeg exited with code ${code}`));
        });
    });
}

export async function start(_: IpcMainInvokeEvent, _workdir: string | undefined) {
    _workdir ||= fs.mkdtempSync(path.join(os.tmpdir(), "vencord_YTdownloader_"));
    if (!fs.existsSync(_workdir)) fs.mkdirSync(_workdir, { recursive: true });
    workdir = _workdir;
    log("Using workdir: ", workdir);
    return workdir;
}

export async function stop(_: IpcMainInvokeEvent) {
    if (workdir) {
        log("Cleaning up workdir");
        fs.rmSync(workdir, { recursive: true });
        workdir = null;
    }
}

async function metadata(options: DownloadOptions) {
    try {
        stdout_global = "";
        const output = await ytdlp(["-J", options.url, "--no-warnings"]);
        const metadata = JSON.parse(output);

        if (metadata.is_live) throw new Error("Live streams are not supported.");

        stdout_global = "";
        return { videoTitle: metadata.title || "video" };
    } catch (err) {
        throw err;
    }
}

function genFormat({ videoTitle }: { videoTitle: string; }, { format, quality }: DownloadOptions) {
    let format_string = "";

    // Default qualities
    const videoHeight = quality && !isNaN(parseInt(quality)) ? parseInt(quality) : 1080;
    const audioBitrate = quality && !isNaN(parseInt(quality)) ? parseInt(quality) : 320;

    if (format === "audio") {
        // Audio format string: prefer higher bitrate audio
        format_string = "bestaudio[abr>=320]/bestaudio[abr>=256]/bestaudio[abr>=192]/bestaudio[abr>=128]/bestaudio/best";
        log(`Audio format selected. Target bitrate: ${audioBitrate}k`);
    } else {
        // Video format string: best video up to height + best audio
        // If ffmpeg is available, we can merge video+audio, otherwise we prefer single file
        if (ffmpegAvailable) {
            format_string = `bestvideo[height<=${videoHeight}]+bestaudio/best[height<=${videoHeight}]`;
        } else {
            format_string = `best[height<=${videoHeight}][ext=mp4]/best[height<=${videoHeight}]`;
        }
        log(`Video format selected. Max height: ${videoHeight}p`);
    }

    log("Format string calculated as ", format_string);
    return { format: format_string, videoTitle, audioBitrate, videoHeight };
}

async function download({ format, videoTitle }: { format: string; videoTitle: string; }, { url, format: usrFormat, audioBitrate }: DownloadOptions & { audioBitrate?: number; }) {
    cleanVideoFiles();
    const baseArgs = ["-f", format, "-o", "download.%(ext)s", "--force-overwrites", "-I", "1"];

    const customArgs: string[] = [];

    if (usrFormat === "audio") {
        // Extract to mp3. If ffmpeg is missing, this might fail or download original format
        if (ffmpegAvailable) {
            customArgs.push("--extract-audio", "--audio-format", "mp3", "--audio-quality", `${audioBitrate}K`);
        } else {
            log("FFmpeg not available, downloading original audio format.");
        }
    }

    try {
        await ytdlp([url, ...baseArgs, ...customArgs]);
    } catch (err) {
        console.error("Error during yt-dlp execution:", err);
        throw err;
    }

    const file = fs.readdirSync(getdir()).find(f => f.startsWith("download."));
    if (!file) throw "No video file was found!";
    return { file, videoTitle };
}

async function remux({ file, videoTitle }: { file: string; videoTitle: string; }, { format, maxFileSize }: DownloadOptions) {
    const sourceExtension = file.split(".").pop();
    if (!ffmpegAvailable) return log("Skipping remux, ffmpeg is unavailable."), { file, videoTitle, extension: sourceExtension };

    // Discord likes mp4 and webm
    const acceptableFormats = ["mp4", "webm", "mp3"];
    const fileSize = fs.statSync(p(file)).size;

    const isFormatAcceptable = acceptableFormats.includes(sourceExtension ?? "");
    const isFileSizeAcceptable = (!maxFileSize || fileSize <= maxFileSize);

    // If audio, we already converted it in the download step via yt-dlp if possible
    // If video, we ensure it's mp4
    if (isFormatAcceptable && isFileSizeAcceptable && format === "audio") {
        return { file, videoTitle, extension: sourceExtension };
    }

    if (format === "video" && (!isFormatAcceptable || !isFileSizeAcceptable)) {
        const duration = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", p(file)]).toString());
        if (isNaN(duration)) throw "Failed to get video duration.";

        // Target size calculation (reduce slightly to be safe)
        const targetBits = maxFileSize ? (maxFileSize * 0.9) : 50000000;
        const kilobits = ~~(targetBits / duration);

        // Re-encode to mp4 if not acceptable
        const ext = "mp4";
        const baseArgs = ["-i", p(file), "-c:v", "libx264", "-c:a", "aac", "-b:a", "192k", "-b:v", `${kilobits}k`, "-maxrate", `${kilobits}k`, "-bufsize", "1M", "-movflags", "+faststart", "-y", `remux.${ext}`];

        await ffmpeg(baseArgs);
        return { file: `remux.${ext}`, videoTitle, extension: ext };
    }

    return { file, videoTitle, extension: sourceExtension };
}

function upload({ file, videoTitle, extension }: { file: string; videoTitle: string; extension: string | undefined; }) {
    if (!extension) throw "Invalid extension.";
    const buffer = fs.readFileSync(p(file));
    return { buffer, title: `${videoTitle}.${extension}` };
}

export async function execute(
    _: IpcMainInvokeEvent,
    opt: DownloadOptions
): Promise<{
    buffer: Buffer;
    title: string;
    logs: string;
} | {
    error: string;
    logs: string;
}> {
    logs_global = "";
    try {
        const videoMetadata = await metadata(opt);
        const videoFormat = genFormat(videoMetadata, opt);
        const videoDownload = await download(videoFormat, opt);
        const videoRemux = await remux(videoDownload, opt);
        const videoUpload = upload(videoRemux);
        return { logs: logs_global, ...videoUpload };
    } catch (e: any) {
        return { error: e.toString(), logs: logs_global };
    }
}

export function checkffmpeg(_?: IpcMainInvokeEvent) {
    try {
        execFileSync("ffmpeg", ["-version"]);
        execFileSync("ffprobe", ["-version"]);
        ffmpegAvailable = true;
        return true;
    } catch (e) {
        ffmpegAvailable = false;
        return false;
    }
}

export async function checkytdlp(_?: IpcMainInvokeEvent) {
    try {
        execFileSync("yt-dlp", ["--version"]);
        ytdlpAvailable = true;
        return true;
    } catch (e) {
        ytdlpAvailable = false;
        return false;
    }
}

export async function checkdeno(_?: IpcMainInvokeEvent) {
    try {
        execFileSync("deno", ["--version"]);
        denoAvailable = true;
        return true;
    } catch (e) {
        denoAvailable = false;
        return false;
    }
}

export async function interrupt(_: IpcMainInvokeEvent) {
    log("Interrupting...");
    ytdlpProcess?.kill();
    ffmpegProcess?.kill();
    cleanVideoFiles();
}

export const getStdout = () => stdout_global;
export const isYtdlpAvailable = () => ytdlpAvailable;
export const isFfmpegAvailable = () => ffmpegAvailable;
export const isDenoAvailable = () => denoAvailable;
