/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { React } from "@webpack/common";
import { JSX } from "react";

import { SettingsPanel } from "../components";
import { IconComponent, SettingsPanelButton } from "../components/settingsPanel/SettingsPanelButton";
import { SettingsPanelRow } from "../components/settingsPanel/SettingsPanelRow";
import { SettingsPanelTooltipButton } from "../components/settingsPanel/SettingsPanelTooltipButton";

export interface PanelButton {
    name: string,
    tooltipText?: string,
    icon?: IconComponent;
    onClick?: () => void;
}

const settingsPanelButtonsSubscriptions = new Set<React.DispatchWithoutAction>();
export const settingsPanelButtons: PanelButton[] = new Proxy<PanelButton[]>([], {
    set: (target, p, newValue) => {
        target[p] = newValue;
        settingsPanelButtonsSubscriptions.forEach(fn => fn());
        return true;
    },
});

export const useButtons = () => {
    const [, forceUpdate] = React.useReducer(() => ({}), {});

    React.useEffect(() => {
        settingsPanelButtonsSubscriptions.add(forceUpdate);
        return () => void settingsPanelButtonsSubscriptions.delete(() => forceUpdate);
    }, []);

    return settingsPanelButtons;
};

export const ButtonsSettingsPanel = () => {
    const rawPanelButtons = useButtons();

    const convertRawPanelButtons = (buttons: PanelButton[]) => {
        const settingsPanelButtonsClone = [...buttons].sort();
        const groupedButtons: JSX.Element[][] = [];

        while (settingsPanelButtonsClone.length) {
            const splicedButtons =
                settingsPanelButtonsClone
                    .splice(0, 3)
                    .map(({ icon, tooltipText, onClick }, index) =>
                        tooltipText
                            ? <SettingsPanelTooltipButton
                                key={`tooltip-button-${index}`} // Add a unique key here
                                tooltipProps={{ text: tooltipText }}
                                icon={icon}
                                onClick={onClick}
                            />
                            : <SettingsPanelButton
                                key={`button-${index}`} // Add a unique key here
                                icon={icon}
                                onClick={onClick}
                            />
                    );

            groupedButtons.push(splicedButtons);
        }

        return groupedButtons;
    };

    return rawPanelButtons.length > 0
        ? <SettingsPanel>
            {convertRawPanelButtons(rawPanelButtons).map((value, index) => (
                <SettingsPanelRow key={`panel-row-${index}`}>
                    {value}
                </SettingsPanelRow>
            ))}
        </SettingsPanel>
        : null;
};

export function replacedUserPanelComponent(oldComponent) {
    return <ButtonsSettingsPanel />;
}

export function addSettingsPanelButton(settings: PanelButton) {
    settingsPanelButtons.push(settings);
}

export function removeSettingsPanelButton(name: string) {
    settingsPanelButtons.splice(0, settingsPanelButtons.length, ...settingsPanelButtons.filter(value => value.name !== name));
}
