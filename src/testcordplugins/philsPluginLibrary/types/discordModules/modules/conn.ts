/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface Conn {
    destroy: (...args: any[]) => any;
    setTransportOptions: (options: Record<string, any>) => any;
    setSelfMute: (...args: any[]) => any;
    setSelfDeafen: (...args: any[]) => any;
    mergeUsers: (...args: any[]) => any;
    destroyUser: (...args: any[]) => any;
    setLocalVolume: (...args: any[]) => any;
    setLocalMute: (...args: any[]) => any;
    setLocalPan: (...args: any[]) => any;
    setDisableLocalVideo: (...args: any[]) => any;
    setMinimumOutputDelay: (...args: any[]) => any;
    getEncryptionModes: (...args: any[]) => any;
    configureConnectionRetries: (...args: any[]) => any;
    setOnSpeakingCallback: (...args: any[]) => any;
    setOnSpeakingWhileMutedCallback: (...args: any[]) => any;
    setPingInterval: (...args: any[]) => any;
    setPingCallback: (...args: any[]) => any;
    setPingTimeoutCallback: (...args: any[]) => any;
    setRemoteUserSpeakingStatus: (...args: any[]) => any;
    setRemoteUserCanHavePriority: (...args: any[]) => any;
    setOnVideoCallback: (...args: any[]) => any;
    setVideoBroadcast: (...args: any[]) => any;
    setDesktopSource: (...args: any[]) => any;
    setDesktopSourceWithOptions: (...args: any[]) => any;
    clearDesktopSource: (...args: any[]) => any;
    setDesktopSourceStatusCallback: (...args: any[]) => any;
    setOnDesktopSourceEnded: (...args: any[]) => any;
    setOnSoundshare: (...args: any[]) => any;
    setOnSoundshareEnded: (...args: any[]) => any;
    setOnSoundshareFailed: (...args: any[]) => any;
    setPTTActive: (...args: any[]) => any;
    getStats: (...args: any[]) => any;
    getFilteredStats: (...args: any[]) => any;
    startReplay: (...args: any[]) => any;
    startSamplesPlayback: (...args: any[]) => any;
    stopSamplesPlayback: (...args: any[]) => any;
}
