/*
 * Nightcord - StealthMode plugin
 * Hides all plugin buttons (top bar, text area, user area)
 * Toggle: Ctrl+Shift+H or button in Nightcord Settings.
 *
 * NOTE: The actual logic (keydown, DOM hide, toggle) is in src/api/HeaderBar.tsx
 * and runs when the webpack module loads, BEFORE plugins start.
 */

import { isStealthModeEnabled, syncStealthBodyClass, toggleStealthMode } from "@api/HeaderBar";
import definePlugin from "@utils/types";

import style from "./style.css?managed";

export { toggleStealthMode as doToggle };

export function isStealthEnabled(): boolean {
    return isStealthModeEnabled();
}

export default definePlugin({
    name: "StealthMode",
    description: "Hides all plugin buttons without disabling them. Shortcut: Ctrl+Shift+H. The toggle is in Testcord Settings.",
    authors: [{ name: "Nightcord", id: 0n }],
    required: true,
    managedStyle: style,

    start() {
        syncStealthBodyClass();
    },

    stop() {
        document.body.classList.remove("nightcord-stealth");
    },
});
