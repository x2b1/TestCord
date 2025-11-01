/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { UserStore } from "@webpack/common";

import { Emitter, MediaEngineStore, patchConnectionAudioTransportOptions, Patcher, types } from "../../philsPluginLibrary";
import { PluginInfo } from "../constants";
import { logger } from "../logger";
import { screenshareAudioStore } from "../stores/screenshareAudioStore";

export class ScreenshareAudioPatcher extends Patcher {
    private mediaEngineStore: types.MediaEngineStore;
    private mediaEngine: types.MediaEngine;
    public connection?: types.Connection;

    public oldSetTransportOptions: (...args: any[]) => void;
    public forceUpdateTransportationOptions: () => void;

    constructor() {
        super();
        this.mediaEngineStore = MediaEngineStore;
        this.mediaEngine = this.mediaEngineStore.getMediaEngine();

        this.forceUpdateTransportationOptions = () => void 0;
        this.oldSetTransportOptions = () => void 0;
    }

    public patch(): this {
        this.unpatch();

        const { get } = screenshareAudioStore;

        const connectionEventFunction =
            (connection: types.Connection) => {
                if (connection.context !== "stream" || connection.streamUserId !== UserStore.getCurrentUser().id) return;

                this.connection = connection;

                const {
                    forceUpdateTransportationOptions: forceUpdateTransportationOptionsAudio,
                    oldSetTransportOptions: oldSetTransportOptionsAudio
                } = patchConnectionAudioTransportOptions(connection, get, logger);

                this.forceUpdateTransportationOptions = forceUpdateTransportationOptionsAudio;
                this.oldSetTransportOptions = oldSetTransportOptionsAudio;

                Emitter.addListener(connection.emitter, "on", "connected", () => {
                    this.forceUpdateTransportationOptions();
                });

                Emitter.addListener(connection.emitter, "on", "destroy", () => {
                    this.forceUpdateTransportationOptions = () => void 0;
                });
            };

        Emitter.addListener(
            this.mediaEngine.emitter,
            "on",
            "connection",
            connectionEventFunction,
            PluginInfo.PLUGIN_NAME
        );

        return this;
    }

    public unpatch(): this {
        return this._unpatch();
    }
}
