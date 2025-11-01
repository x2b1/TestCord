/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from "react";

export interface SettingsModalRowProps extends Pick<React.ComponentProps<"div">,
    | "children"
    | "style"> {
    gap?: string;
}

export const SettingsModalCardRow = ({ children, style, gap }: SettingsModalRowProps) => {
    return (
        <div style={{ display: "flex", gap: gap ?? "1em", ...style }}>{children}</div>
    );
};
