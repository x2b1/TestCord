/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Connection, VideoQualityManager } from "./";

export type FramerateReducer = FramerateReducer_ & {
    connection: Connection;
    sinkWants: VideoQualityManager;
    framerateReductionTimeout?: number;
    handleSelfMute: (...args: any[]) => any;
    handleSpeaking: (...args: any[]) => any;
    __proto__: FramerateReducer_;
};

export interface FramerateReducer_ {
    destroy: (...args: any[]) => any;
    destroyFramerateScaleFactorTimers: (...args: any[]) => any;
    initialize: (...args: any[]) => any;
    updateRemoteWantsFramerate: (...args: any[]) => any;
    userSpeakingChange: (...args: any[]) => any;
}
