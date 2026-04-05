/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { FluxStore } from "@vencord/discord-types/src/stores/FluxStore";

/**
 * The 2 themes that this plugin can toggle between: Light and Dark.
 */
export enum ToggledTheme {
    Light,
    Dark
}

/**
 * A vanilla Discord theme: light, dark, or Nitro themes.
 */
export interface DiscordTheme {
    getName(): string;
    theme: string;

    // Only defined for Nitro themes
    id?: number;
    angle?: number;
    colors?: Array<NitroThemeColor>;
    midpointPercentage?: number;
}

export interface NitroThemeColor {
    token: string;
    stop: number;
}

/**
 * Representation of the custom Nitro Discord theme.
 * As of coding this, there is only one customization per account, so didn't bother with an interface.
 */
export type CustomTheme = {
    theme: string;
    customUserThemeSettings: {
        colors: Array<string>;
        base_mix: 0;
        gradient_angle: 0;
        base_theme: string;
    };
};

/**
 * Custom Nitro theme store.
 */
export type CtStore = FluxStore & {
    getSavedCustomTheme: Function
};
