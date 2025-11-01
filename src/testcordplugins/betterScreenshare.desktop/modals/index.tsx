/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { openModalLazy } from "@utils/modal";

import Plugin from "..";
import { ScreenshareSettingsModal } from "../components";
import { PluginInfo } from "../constants";
import { screenshareAudioStore, screenshareStore } from "../stores";

const onScreenshareModalDone = () => {
    const { screenshareAudioPatcher, screensharePatcher } = Plugin;

    if (screensharePatcher) {
        screensharePatcher.forceUpdateTransportationOptions();
        screensharePatcher.forceUpdateDesktopSourceOptions();
    }
    if (screenshareAudioPatcher)
        screenshareAudioPatcher.forceUpdateTransportationOptions();
};

const onScreenshareAudioModalDone = () => {
    const { screenshareAudioPatcher } = Plugin;

    if (screenshareAudioPatcher)
        screenshareAudioPatcher.forceUpdateTransportationOptions();
};

export const openScreenshareModal =
    () => openModalLazy(async () => {
        return props =>
            <ScreenshareSettingsModal
                onAudioDone={onScreenshareAudioModalDone}
                onDone={onScreenshareModalDone}
                screenshareStore={screenshareStore}
                screenshareAudioStore={screenshareAudioStore}
                author={PluginInfo.AUTHOR}
                contributors={Object.values(PluginInfo.CONTRIBUTORS)}
                {...props} />;
    });
