/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Bitrate, Framerate, Resolution } from "../../";
import { Connection } from "./";

export type VideoQualityManager = VideoQualityManager_ & {
    connection: Connection;
    contextType: string;
    isMuted: boolean;
    isStreamContext: boolean;
    ladder: Ladder;
    options: Options;
    qualityOverwrite: QualityOverwrite;
    __proto__: VideoQualityManager_;
};

export interface VideoQualityManager_ {
    applyQualityConstraints: (...args: any[]) => any;
    getDesktopQuality: (...args: any[]) => any;
    getQuality: (...args: any[]) => any;
    getVideoQuality: (...args: any[]) => any;
    setQuality: (...args: any[]) => any;
}

export interface QualityOverwrite {
    bitrateMax?: number;
    bitrateMin?: number;
    bitrateTarget?: number;
    capture?: Resolution & Framerate;
    encode?: Resolution & Framerate;
}

export interface Options {
    videoBudget: VideoBudget;
    videoCapture: VideoBudget;
    videoBitrate: VideoBitrate;
    desktopBitrate: DesktopBitrate;
    videoBitrateFloor: number;
}

export type DesktopBitrate = Bitrate;

export type VideoBitrate = Omit<Bitrate, "target">;

export type VideoBudget = Resolution & Framerate;

export interface Ladder {
    pixelBudget: number;
    ladder: {
        [key: number]: LadderValue;
    };
    orderedLadder: OrderedLadder[];
}

export interface OrderedLadder extends Resolution, Framerate {
    pixelCount: number;
    wantValue: number;
    budgetPortion: number;
    mutedFramerate: Framerate;
}

export interface LadderValue extends Resolution, Framerate {
    budgetPortion: number;
    mutedFramerate: Framerate;
}
