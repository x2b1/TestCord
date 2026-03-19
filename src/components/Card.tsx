/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./Card.css";

import { classNameFactory } from "@utils/css";
import { classes } from "@utils/misc";
import { ComponentPropsWithRef } from "react";

const cl = classNameFactory("vc-card-");

export interface CardProps extends ComponentPropsWithRef<"div"> {
<<<<<<< HEAD
    variant?: "primary" | "warning" | "danger" | "success" | "brand";
    outline?: boolean;
=======
    variant?: "normal" | "warning" | "danger" | "info" | "success";
>>>>>>> cba0eb9897419432e68277b0b60c301a6f8323cf
    /** Add a default padding of 1em to the card. This is implied if no className prop is passed */
    defaultPadding?: boolean;
}

export function Card({ variant = "primary", outline = false, defaultPadding, children, className, ...restProps }: CardProps) {
    const addDefaultPadding = defaultPadding != null
        ? defaultPadding
        : !className;

    return (
        <div className={classes(cl("base", variant, outline && "outline", addDefaultPadding && "defaultPadding"), className)} {...restProps}>
            {children}
        </div>
    );
}
