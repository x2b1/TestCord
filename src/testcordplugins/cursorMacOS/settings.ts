/*
 * Nightcord – CursorMacOS plugin settings
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    style: {
        type: OptionType.SELECT,
        description: "macOS cursor style",
        options: [
            { label: "Modern with shadow (Sierra+)", value: "modern_shadow", default: true },
            { label: "Modern without shadow (Sierra+)", value: "modern_no_shadow" },
            { label: "Classic with shadow (El Capitan)", value: "classic_shadow" },
            { label: "Classic without shadow (El Capitan)", value: "classic_no_shadow" },
        ]
    },
    size: {
        type: OptionType.SELECT,
        description: "Cursor size",
        options: [
            { label: "Normal", value: "normal", default: true },
            { label: "Large", value: "large" },
            { label: "Extra Large", value: "xl" }
        ]
    }
});
