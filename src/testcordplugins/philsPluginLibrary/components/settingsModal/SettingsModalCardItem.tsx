/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Forms } from "@webpack/common";
import React from "react";

export interface SettingsModalCardItemProps extends Pick<React.ComponentProps<"div">,
    | "children"> {
    title?: string;
}

export const SettingsModalCardItem = ({ children, title }: SettingsModalCardItemProps) => {
    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.4em",
            width: "100%"
        }}>
            {title && <Forms.FormTitle tag="h5" style={{ margin: 0 }}>{title}</Forms.FormTitle>}
            {children}
        </div>
    );
};
