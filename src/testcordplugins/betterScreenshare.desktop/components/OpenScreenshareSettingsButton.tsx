/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@webpack/common";
import React from "react";

import { openScreenshareModal } from "../modals";

export interface OpenScreenshareSettingsButtonProps {
    title?: string;
}

export const OpenScreenshareSettingsButton = (props: OpenScreenshareSettingsButtonProps) => {
    return (
        <Button
            size={Button.Sizes.SMALL}
            color={Button.Colors.PRIMARY}
            onClick={openScreenshareModal}
        >
            {props.title ? props.title : "Screenshare Settings"}
        </Button>
    );
};
