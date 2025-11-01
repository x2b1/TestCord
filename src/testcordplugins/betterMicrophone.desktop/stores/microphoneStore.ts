/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createPluginStore, ProfilableInitializer, ProfilableStore, profileable, ProfileableProfile } from "../../philsPluginLibrary";
import { PluginInfo } from "../constants";


export interface MicrophoneProfile {
    freq?: number,
    pacsize?: number,
    channels?: number,
    rate?: number,
    voiceBitrate?: number;
    freqEnabled?: boolean,
    pacsizeEnabled?: boolean;
    channelsEnabled?: boolean;
    rateEnabled?: boolean;
    voiceBitrateEnabled?: boolean;
}

export interface MicrophoneStore {
    simpleMode?: boolean;
    setSimpleMode: (enabled?: boolean) => void;
    setFreq: (freq?: number) => void;
    setPacsize: (pacsize?: number) => void;
    setChannels: (channels?: number) => void;
    setRate: (rate?: number) => void;
    setVoiceBitrate: (voiceBitrate?: number) => void;
    setFreqEnabled: (enabled?: boolean) => void;
    setPacsizeEnabled: (enabled?: boolean) => void;
    setChannelsEnabled: (enabled?: boolean) => void;
    setRateEnabled: (enabled?: boolean) => void;
    setVoiceBitrateEnabled: (enabled?: boolean) => void;
}

export const defaultMicrophoneProfiles = {
    normal: {
        name: "Normal",
        channels: 2,
        channelsEnabled: true,
        voiceBitrate: 96,
        voiceBitrateEnabled: true
    },
    high: {
        name: "High",
        channels: 2,
        channelsEnabled: true,
        voiceBitrate: 320,
        voiceBitrateEnabled: true
    },
} as const satisfies Record<string, MicrophoneProfile & ProfileableProfile>;

export const microphoneStoreDefault: ProfilableInitializer<MicrophoneStore, MicrophoneProfile> = (set, get) => ({
    simpleMode: true,
    setSimpleMode: enabled => get().simpleMode = enabled,
    setChannels: channels => get().currentProfile.channels = channels,
    setRate: rate => get().currentProfile.rate = rate,
    setVoiceBitrate: voiceBitrate => get().currentProfile.voiceBitrate = voiceBitrate,
    setPacsize: pacsize => get().currentProfile.pacsize = pacsize,
    setFreq: freq => get().currentProfile.freq = freq,
    setChannelsEnabled: enabled => get().currentProfile.channelsEnabled = enabled,
    setFreqEnabled: enabled => get().currentProfile.freqEnabled = enabled,
    setPacsizeEnabled: enabled => get().currentProfile.pacsizeEnabled = enabled,
    setRateEnabled: enabled => get().currentProfile.rateEnabled = enabled,
    setVoiceBitrateEnabled: enabled => get().currentProfile.voiceBitrateEnabled = enabled,
});

export let microphoneStore: ProfilableStore<MicrophoneStore, MicrophoneProfile>;

export const initMicrophoneStore = () =>
    microphoneStore = createPluginStore(
        PluginInfo.PLUGIN_NAME,
        "MicrophoneStore",
        profileable(
            microphoneStoreDefault,
            { name: "" },
            Object.values(defaultMicrophoneProfiles)
        )
    );
