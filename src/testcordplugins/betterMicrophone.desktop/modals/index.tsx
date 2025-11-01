/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { openModalLazy } from "@utils/modal";

import { MicrophoneSettingsModal } from "../components";
import { PluginInfo } from "../constants";
import Plugin from "../index";
import { microphoneStore } from "../stores";

const onMicrophoneModalDone = () => {
    const { microphonePatcher } = Plugin;

    if (microphonePatcher)
        microphonePatcher.forceUpdateTransportationOptions();
};

export const openMicrophoneSettingsModal =
    () => openModalLazy(async () => {
        return props =>
            <MicrophoneSettingsModal
                onDone={onMicrophoneModalDone}
                showInfo
                microphoneStore={microphoneStore}
                author={PluginInfo.AUTHOR}
                contributors={Object.values(PluginInfo.CONTRIBUTORS)}
                {...props} />;
    });
