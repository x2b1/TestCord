/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
    defaultMicrophoneProfiles as defaultScreenshareAudioProfiles,
    MicrophoneProfile as ScreenshareAudioProfile,
    MicrophoneStore as ScreenshareAudioStore,
    microphoneStoreDefault as screenshareAudioStoreDefault
} from "../../betterMicrophone.desktop/stores";
import { createPluginStore, ProfilableStore, profileable } from "../../philsPluginLibrary";
import { PluginInfo } from "../constants";

export let screenshareAudioStore: ProfilableStore<ScreenshareAudioStore, ScreenshareAudioProfile>;

export const initScreenshareAudioStore = () =>
    screenshareAudioStore = createPluginStore(
        PluginInfo.PLUGIN_NAME,
        "ScreenshareAudioStore",
        profileable(
            screenshareAudioStoreDefault,
            { name: "" },
            Object.values(defaultScreenshareAudioProfiles)
        )
    );

export { defaultScreenshareAudioProfiles, ScreenshareAudioProfile, ScreenshareAudioStore, screenshareAudioStoreDefault };
