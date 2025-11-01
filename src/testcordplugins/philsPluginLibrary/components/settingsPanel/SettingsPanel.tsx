/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { React } from "@webpack/common";

import { panelClasses } from "../../discordModules";


export interface SettingsPanelProps {
    children: React.ComponentProps<"div">["children"];
}

export const SettingsPanel = ({ children }: SettingsPanelProps) => {
    return (
        <div
            className={panelClasses.container}>
            {children}
        </div>
    );
};
