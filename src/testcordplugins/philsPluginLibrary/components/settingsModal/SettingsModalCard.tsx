/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Switch } from "@components/Switch";
import { Card, Forms } from "@webpack/common";
import React from "react";

export interface SettingsModalItemProps extends Pick<React.ComponentProps<"div">,
    | "children"> {
    title?: string;
    switchEnabled?: boolean;
    switchProps?: React.ComponentProps<typeof Switch>;
    flex?: number;
    cardProps?: React.ComponentProps<typeof Card>;
}

export const SettingsModalCard = ({ children, title, switchProps, switchEnabled, flex, cardProps }: SettingsModalItemProps) => {
    return (
        <Card
            {...cardProps}
            style={{
                padding: "1em",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                flex: flex ?? 1,
                ...(cardProps?.style ? cardProps.style : {})
            }}>
            {title && <Forms.FormTitle tag="h5" style={{ margin: 0 }}>{title}</Forms.FormTitle>}
            <div style={{
                display: "flex",
                gap: "1em",
                height: "100%",
                justifyContent: "center",
                alignItems: "center",
                paddingTop: "0.6em",
            }}>
                {children &&
                    <div style={{
                        display: "flex",
                        alignItems: "flex-end",
                        gap: "1em",
                        flex: 1
                    }}>
                        {children}
                    </div>
                }
                {switchEnabled &&
                    <div style={{
                        display: "flex",
                        height: "100%",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                    }}>
                        <Forms.FormTitle tag="h5">Status</Forms.FormTitle>
                        <Switch
                            checked={false}
                            onChange={() => void 0}
                            disabled={false}
                            {...switchProps}
                        />
                    </div>
                }
            </div>
        </Card >
    );
};
