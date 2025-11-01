/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Flex } from "@components/Flex";
import { Button, Tooltip } from "@webpack/common";
import React, { JSX } from "react";


export interface IconTooltipButtonProps {
    tooltipText?: string;
    icon?: JSX.Element;
}

export const IconTooltipButton = (props: React.ComponentProps<typeof Button> & IconTooltipButtonProps) => {
    return (
        <Tooltip text={props.tooltipText}>
            {tooltipProps => <Button
                size={Button.Sizes.ICON}
                {...props as any}
                style={{ aspectRatio: 1, maxHeight: "32px", boxSizing: "border-box", ...props.style }}
            >
                <Flex style={{ justifyContent: "center", alignItems: "center", width: 24, height: 24 }}>
                    {props.icon}
                </Flex>
                <span {...tooltipProps} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} />
            </Button>}
        </Tooltip >
    );
};
