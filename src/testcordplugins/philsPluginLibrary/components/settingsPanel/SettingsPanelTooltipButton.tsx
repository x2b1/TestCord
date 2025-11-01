/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Tooltip } from "@webpack/common";
import React from "react";

import { SettingsPanelButton, SettingsPanelButtonProps } from "./SettingsPanelButton";

export interface SettingsPanelTooltipButtonProps extends SettingsPanelButtonProps {
    tooltipProps: Omit<React.ComponentProps<typeof Tooltip>, "children">;
}

export const SettingsPanelTooltipButton = (props: SettingsPanelTooltipButtonProps) => {
    return (
        <Tooltip {...props.tooltipProps}>
            {tooltipProps => <SettingsPanelButton {...tooltipProps} {...props} />}
        </Tooltip>
    );
};
