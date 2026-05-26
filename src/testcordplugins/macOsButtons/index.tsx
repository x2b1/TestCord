/*
 * Equicord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin, { PluginNative } from "@utils/types";

const Native = VencordNative.pluginHelpers.MacOsButtons as PluginNative<typeof import("./native")>;

const CSS = `
#macos-window-controls {
    position: fixed;
    top: 0;
    right: 0;
    height: 32px;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 16px;
    -webkit-app-region: no-drag !important;
    pointer-events: all !important;
}

.macos-btn {
    width: 13px;
    height: 13px;
    border-radius: 50%;
    border: none;
    cursor: pointer !important;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    outline: none;
    padding: 0;
    position: relative;
    -webkit-app-region: no-drag;
    pointer-events: all;
}

.macos-btn-icon {
    opacity: 0;
    transition: opacity 0.1s ease;
    position: absolute;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
}

#macos-window-controls:hover .macos-btn-icon {
    opacity: 1;
}

.macos-btn-close  { background: #ff5f57; box-shadow: 0 0 0 0.5px rgba(0,0,0,0.2); }
.macos-btn-min    { background: #febc2e; box-shadow: 0 0 0 0.5px rgba(0,0,0,0.2); }
.macos-btn-max    { background: #28c840; box-shadow: 0 0 0 0.5px rgba(0,0,0,0.2); }

.macos-btn:hover  { filter: brightness(0.88); }
.macos-btn:active { filter: brightness(0.70); }

.macos-unfocused .macos-btn-close,
.macos-unfocused .macos-btn-min,
.macos-unfocused .macos-btn-max {
    background: #cccccc;
}

.macos-sep {
    width: 1px;
    height: 16px;
    background: rgba(255,255,255,0.15);
    flex-shrink: 0;
    margin-right: 4px;
}

/* Cache les boutons Windows natifs */
[class*="winButtons"],
[class*="winButton"] {
    display: none !important;
}
`;

function injectMacOsButtons() {
    if (document.getElementById("macos-window-controls")) return;

    const style = document.createElement("style");
    style.id = "macos-buttons-style";
    style.textContent = CSS;
    document.head.appendChild(style);

    const container = document.createElement("div");
    container.id = "macos-window-controls";
    document.body.appendChild(container);
    container.style.zIndex = "2147483647";
    container.style.pointerEvents = "all";
    container.style.webkitAppRegion = "no-drag";

    const sep = document.createElement("div");
    sep.className = "macos-sep";

    // Rouge — Close
    const btnClose = document.createElement("button");
    btnClose.className = "macos-btn macos-btn-close";
    btnClose.title = "Close";
    btnClose.innerHTML = `<span class="macos-btn-icon"><svg width="6" height="6" viewBox="0 0 6 6" fill="none"><path d="M1 1L5 5M5 1L1 5" stroke="#4d0000" stroke-width="1.3" stroke-linecap="round"/></svg></span>`;
    btnClose.addEventListener("click", (e) => { e.stopPropagation(); Native.closeWindow(); });

    // Jaune — Minimiser
    const btnMin = document.createElement("button");
    btnMin.className = "macos-btn macos-btn-min";
    btnMin.title = "Minimiser";
    btnMin.innerHTML = `<span class="macos-btn-icon"><svg width="7" height="2" viewBox="0 0 7 2" fill="none"><path d="M0.5 1H6.5" stroke="#6d4c00" stroke-width="1.3" stroke-linecap="round"/></svg></span>`;
    btnMin.addEventListener("click", (e) => { e.stopPropagation(); Native.minimizeWindow(); });

    // Vert — Maximiser
    const btnMax = document.createElement("button");
    btnMax.className = "macos-btn macos-btn-max";
    btnMax.title = "Maximiser / Restaurer";
    btnMax.innerHTML = `<span class="macos-btn-icon"><svg width="7" height="7" viewBox="0 0 7 7" fill="none"><path d="M1 6L6 1M1 3.5V1H3.5M3.5 6H6V3.5" stroke="#0a3a00" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
    btnMax.addEventListener("click", (e) => { e.stopPropagation(); Native.maximizeWindow(); });

    container.appendChild(btnClose);
    container.appendChild(btnMin);
    container.appendChild(btnMax);

    // Pousser les icônes Discord à gauche pour ne pas se chevaucher
    // On cherche le vrai trailing container et on lui ajoute du padding-right
    pushToolbarLeft();

    // Focus / unfocus
    window.addEventListener("focus", () => container.classList.remove("macos-unfocused"));
    window.addEventListener("blur", () => container.classList.add("macos-unfocused"));
    if (!document.hasFocus()) container.classList.add("macos-unfocused");
}

function pushToolbarLeft() {
    // Largeur occupée par nos boutons : sep(1) + gap(8) + 3×btn(13) + gaps(16) + padding(24) ≈ 90px
    const W = 90;
    // Cherche tous les containers de la titlebar qui sont en haut à droite
    // et leur ajoute du padding-right pour ne pas se chevaucher avec nos boutons
    const styleId = "macos-toolbar-push";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    // On injecte une règle CSS qui pousse le trailing via padding
    // Le trailing dans Discord a toujours un aria ou un class "trailing"
    style.textContent = `
        [class*="trailing"] {
            padding-right: ${W}px !important;
            margin-top: 4px !important;
        }
    `;
    document.head.appendChild(style);
}

function removeMacOsButtons() {
    document.getElementById("macos-window-controls")?.remove();
    document.getElementById("macos-buttons-style")?.remove();
    document.getElementById("macos-toolbar-push")?.remove();
}

export default definePlugin({
    name: "MacOsButtons",
    enabledByDefault: true,
    description: "Replaces Windows buttons with macOS-style buttons — red, yellow, green.",
    authors: [{ name: "Nightcord", id: 0n }],
    required: false,
    patches: [],

    start() {
        injectMacOsButtons();
        (this as any)._obs = new MutationObserver(() => {
            const controls = document.getElementById("macos-window-controls");
            if (!controls) {
                injectMacOsButtons();
            } else if (controls.parentElement !== document.body) {
                // S'il a été déplacé par un changement de layer, on le remet en haut
                document.body.appendChild(controls);
            }
        });
        (this as any)._obs.observe(document.body, { childList: true, subtree: true });
    },

    stop() {
        removeMacOsButtons();
        (this as any)._obs?.disconnect();
    },
} as any);
