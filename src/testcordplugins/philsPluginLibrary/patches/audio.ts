/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { lodash } from "@webpack/common";

import { MicrophoneProfile, MicrophoneStore } from "../../betterMicrophone.desktop/stores";
import { ProfilableStore, replaceObjectValuesIfExist, types } from "../../philsPluginLibrary";

export function getDefaultAudioTransportationOptions(connection: types.Connection) {
    return {
        audioEncoder: {
            ...connection.getCodecOptions("opus").audioEncoder,
        },
        encodingVoiceBitRate: 64000
    };
}

export function getReplaceableAudioTransportationOptions(connection: types.Connection, get: ProfilableStore<MicrophoneStore, MicrophoneProfile>["get"]) {
    const { currentProfile } = get();
    const {
        channels,
        channelsEnabled,
        freq,
        freqEnabled,
        pacsize,
        pacsizeEnabled,
        rate,
        rateEnabled,
        voiceBitrate,
        voiceBitrateEnabled
    } = currentProfile;

    return {
        ...(voiceBitrateEnabled && voiceBitrate
            ? {
                encodingVoiceBitRate: voiceBitrate * 1000
            }
            : {}
        ),
        audioEncoder: {
            ...connection.getCodecOptions("opus").audioEncoder,
            ...(rateEnabled && rate ? { rate } : {}),
            ...(pacsizeEnabled && pacsize ? { pacsize } : {}),
            ...(freqEnabled && freq ? { freq } : {}),
            ...(channelsEnabled && channels ? { channels } : {})
        }
    };
}

export function patchConnectionAudioTransportOptions(
    connection: types.Connection,
    get: ProfilableStore<MicrophoneStore, MicrophoneProfile>["get"],
    logger?: Logger
) {
    const oldSetTransportOptions = connection.conn.setTransportOptions;

    connection.conn.setTransportOptions = function (this: any, options: Record<string, any>) {
        replaceObjectValuesIfExist(options, getReplaceableAudioTransportationOptions(connection, get));

        return Reflect.apply(oldSetTransportOptions, this, [options]);
    };

    const forceUpdateTransportationOptions = () => {
        const transportOptions = lodash.merge({ ...getDefaultAudioTransportationOptions(connection) }, getReplaceableAudioTransportationOptions(connection, get));

        logger?.info("Overridden Transport Options", transportOptions);

        oldSetTransportOptions(transportOptions);
    };

    return { oldSetTransportOptions, forceUpdateTransportationOptions };
}
