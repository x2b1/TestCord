/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Flex } from "@components/Flex";
import { React } from "@webpack/common";
import { Settings } from "Vencord";

import { SettingsModalCard, SettingsModalCardItem } from "../../philsPluginLibrary";
import Plugin from "..";
import { AudioSourceSelect, OpenScreenshareSettingsButton } from "../components";
import { PluginInfo } from "../constants";
import { screenshareStore } from "../stores";

const ReplacedStreamSettings = () => {
    const { use } = screenshareStore;

    const { audioSourceEnabled, setAudioSourceEnabled } = use();

    const cardProps = { style: { border: "1px solid var(--primary-800)" } };

    return (
        <div style={{ margin: "1em", display: "flex", flexDirection: "column", gap: "1em" }}>
            <SettingsModalCard cardProps={cardProps} title="Stream Settings">
                <SettingsModalCardItem>
                    <Flex flexDirection="column">
                        <OpenScreenshareSettingsButton title="Advanced Settings" />
                    </Flex>
                </SettingsModalCardItem>
            </SettingsModalCard>
            <SettingsModalCard
                cardProps={cardProps}
                switchEnabled
                switchProps={{
                    checked: audioSourceEnabled ?? false,
                    onChange: status => setAudioSourceEnabled(status)
                }}
                title="Audio Source">
                <SettingsModalCardItem>
                    <AudioSourceSelect isDisabled={!audioSourceEnabled} />
                </SettingsModalCardItem>
            </SettingsModalCard>
        </div>
    );
};

export function replacedSubmitFunction(fn) { // This is used to hook over the new OnSubmit function instead of implementing an OnClick function
    return (...args) => {
        const { screensharePatcher, screenshareAudioPatcher } = Plugin;

        if (screensharePatcher) {
            screensharePatcher.forceUpdateTransportationOptions();
            if (screensharePatcher.connection?.connectionState === "CONNECTED")
                screensharePatcher.forceUpdateDesktopSourceOptions();
        }

        if (screenshareAudioPatcher)
            screenshareAudioPatcher.forceUpdateTransportationOptions();
        return fn(...args);
    };
}

export function GoLivePanelWrapper({ children }: { children: React.JSX.Element; }) {
    if (!children)
        return;

    const { hideDefaultSettings } = Settings.plugins[PluginInfo.PLUGIN_NAME];
    if (hideDefaultSettings)
        return <ReplacedStreamSettings />;

    children.props.children.push(<ReplacedStreamSettings />);

    return children;

}
