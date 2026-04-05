/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Settings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import { findByCodeLazy } from "@webpack";

import { CustomTheme, DiscordTheme } from "./types";

const logger = new Logger("AutoThemeSwitcher", "#BBBBBB");

/**
 * Check if a theme is the Nitro custom theme or not
 * @param input Any object that needs to be checked for the type customTheme
 * @returns A boolean; true if it is a custom Nitro theme, false if otherwise
 */
const isOfTypeCustomTheme = (input: any): input is CustomTheme => input.theme !== undefined && input.customUserThemeSettings !== undefined;

/**
 * Formatting of the request to send to the settings update payload to change the theme
 */
interface SaveThemeRequest {
    theme: string;
    backgroundGradientPresetId?: number;
}

/**
 * Method to update the theme using the settings update payload.
 * @param theme A Discord theme request
 */
const saveClientTheme: (theme: Object) => void = findByCodeLazy('type:"UNSYNCED_USER_SETTINGS_UPDATE', '"system"===');

/**
 * @param theme A Discord theme
 * @returns An HTML ID-friendly identifier for the theme
 */
export function themeToString(theme: DiscordTheme) {
    return theme.theme + "-" + theme.id;
}

/**
 * Changes the Discord theme to the specified one.
 * @param theme The identifier of the Discord theme to set, as returned by {@link themeToString}, or passed directly as a properly formatted theme (for the custom Nitro theme)
 */
export function changeDiscordTheme(theme: string | CustomTheme) {

    // Operate differently depending on if this is a pre-set theme (Nitro or not) or if this is a custom Nitro theme
    if (typeof theme === "string") {
        const themeComponents = theme.split("-");
        const saveThemeRequest: SaveThemeRequest = { theme: themeComponents[0] };

        const themeId = parseInt(themeComponents[1]);
        if (!isNaN(themeId)) {
            saveThemeRequest.backgroundGradientPresetId = themeId;
        }
        saveClientTheme(saveThemeRequest);
        logger.info("Discord Theme changed to", saveThemeRequest);
    }

    else if (isOfTypeCustomTheme(theme)) {
        saveClientTheme(theme);
        logger.info("Discord Theme changed to", theme);
    }
    // If anything else, it is an error
    else {
        throw new Error("Invalid theme request.");
    }
}

/**
 * Changes the "Theme Links" setting of Vencord to the provided CSS URLs.
 * @param urls The new CSS URLs (1 per line)
 */
export function changeCustomCssUrls(urls: string) {
    Settings.themeLinks = [...new Set(
        urls
            .trim()
            .split(/\n+/)
            .map(s => s.trim())
            .filter(Boolean)
    )];

    logger.info("Vencord Theme Links changed to", Settings.themeLinks);
}
