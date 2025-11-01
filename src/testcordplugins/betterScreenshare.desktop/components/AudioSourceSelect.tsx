/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Select, useEffect, useState } from "@webpack/common";
import React from "react";

import { MediaEngineStore, types } from "../../philsPluginLibrary";
import { screenshareStore } from "../stores";

export const AudioSourceSelect = (props?: React.ComponentProps<typeof Select>) => {
    const { use } = screenshareStore;
    const { audioSource, setAudioSource } = use();

    const [windowPreviews, setWindowPreviews] = useState<types.WindowPreview[]>([]);

    useEffect(() => {
        const intervalFn = async () => {
            const newPreviews = await MediaEngineStore.getMediaEngine().getWindowPreviews(1, 1);
            setWindowPreviews(oldPreviews =>
                [...oldPreviews, ...newPreviews].filter(
                    (preview, index, array) =>
                        array.findIndex(t => t.id === preview.id) === index
                )
            );
        };
        intervalFn();

        const intervals = [
            setInterval(async () => {
                intervalFn();
            }, 4000),
            setInterval(async () => {
                setWindowPreviews(await MediaEngineStore.getMediaEngine().getWindowPreviews(1, 1));
            }, 30000),
        ];

        return () => intervals.forEach(interval => clearInterval(interval));
    }, []);

    return (
        <Select
            options={windowPreviews.map(({ name, id }) => ({
                label: name,
                value: id,
            }))}
            isSelected={value => audioSource === value}
            select={value => setAudioSource(value)}
            serialize={() => ""}
            {...props}
        />
    );
};


// Set default props for AudioSourceSelect
AudioSourceSelect.defaultProps = {
    options: [],
    isSelected: () => false,
    select: () => { },
    serialize: () => "",
};
