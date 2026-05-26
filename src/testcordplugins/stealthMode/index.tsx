/*
 * Nightcord - StealthMode plugin
 * Cache tous les boutons de plugins (barre du haut, zone texte, zone utilisateur)
 * Toggle : Ctrl+Shift+H ou bouton dans Nightcord Settings.
 *
 * NOTE: La logique réelle (keydown, DOM hide, toggle) est dans src/api/HeaderBar.tsx
 * et s'exécute au chargement du module webpack, AVANT le démarrage des plugins.
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
    enabledByDefault: true,
    description: "Hides all plugin buttons without disabling them. Shortcut: Ctrl+Shift+H. The toggle is in Nightcord Settings.",
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
