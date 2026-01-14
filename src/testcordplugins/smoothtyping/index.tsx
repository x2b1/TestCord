/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { TestcordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "VsCodeTyping",
    description: "Forces a thick VS Code Block Cursor, Monospace font, and smooth cursor animation that follows the text.",
    authors: [TestcordDevs.x2b],

    start() {
        if (document.getElementById("vc-vscode-styles")) return;

        const style = document.createElement("style");
        style.id = "vc-vscode-styles";
        style.innerHTML = `
            /* FORCE VS CODE STYLE ON ALL TEXT INPUTS */
            div[role="textbox"],
            textarea,
            div[contenteditable="true"] {

                /* 1. Monospace Font (Essential for the VS Code look) */
                font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
                font-size: 15px !important; /* Optional: slightly larger for readability */
                line-height: 1.5 !important; /* Smoother vertical spacing */

                /* 2. THE CURSOR: Thick Block Shape (VS Code style) */
                /* Note: 'block' makes it a filled rectangle, not a thin line. */
                caret-shape: block !important;

                /* 3. Cursor Color (VS Code Blue) - Hide native cursor */
                caret-color: transparent !important;

                /* 4. Remove annoying outlines */
                outline: none !important;
            }

            /* Custom smooth cursor */
            .vc-custom-cursor {
                position: absolute;
                width: 2px;
                height: 1.5em;
                background: #007acc;
                transition: left 0.1s ease, top 0.1s ease;
                pointer-events: none;
                z-index: 1000;
                animation: blink 1s infinite;
            }

            @keyframes blink {
                0%, 50% { opacity: 1; }
                51%, 100% { opacity: 0; }
            }

            /* Highlight Selection Color to match VS Code Dark+ */
            ::selection {
                background: #264f78 !important;
                color: white !important;
            }
        `;
        document.head.appendChild(style);

        // Smooth cursor animation logic
        const charWidth = 8; // Approximate width for 15px monospace font

        function updateCursor(input: HTMLElement) {
            let cursor = input.querySelector(".vc-custom-cursor") as HTMLElement;
            if (!cursor) {
                cursor = document.createElement("div");
                cursor.className = "vc-custom-cursor";
                input.appendChild(cursor);
            }

            const text = (input as HTMLInputElement).value || input.textContent || "";
            const lines = text.split("\n");
            const lastLine = lines[lines.length - 1];
            const left = charWidth * lastLine.length;
            const top = (lines.length - 1) * 22.5; // line-height 1.5 * 15px

            cursor.style.left = `${left}px`;
            cursor.style.top = `${top}px`;
        }

        const focusInHandler = (e: FocusEvent) => {
            const input = e.target as HTMLElement;
            if (input.matches('div[role="textbox"], textarea, div[contenteditable="true"]')) {
                updateCursor(input);
            }
        };

        const inputHandler = (e: Event) => {
            const input = e.target as HTMLElement;
            if (input.matches('div[role="textbox"], textarea, div[contenteditable="true"]')) {
                updateCursor(input);
            }
        };

        const focusOutHandler = (e: FocusEvent) => {
            const input = e.target as HTMLElement;
            if (input.matches('div[role="textbox"], textarea, div[contenteditable="true"]')) {
                const cursor = input.parentElement?.querySelector(".vc-custom-cursor");
                if (cursor) cursor.remove();
            }
        };

        document.addEventListener("focusin", focusInHandler);
        document.addEventListener("input", inputHandler);
        document.addEventListener("focusout", focusOutHandler);

        // Store handlers for removal
        (this as any).focusInHandler = focusInHandler;
        (this as any).inputHandler = inputHandler;
        (this as any).focusOutHandler = focusOutHandler;
    },

    stop() {
        const style = document.getElementById("vc-vscode-styles");
        if (style) style.remove();

        // Remove event listeners
        if ((this as any).focusInHandler) document.removeEventListener("focusin", (this as any).focusInHandler);
        if ((this as any).inputHandler) document.removeEventListener("input", (this as any).inputHandler);
        if ((this as any).focusOutHandler) document.removeEventListener("focusout", (this as any).focusOutHandler);

        // Remove any remaining custom cursors
        document.querySelectorAll('div[role="textbox"] .vc-custom-cursor, textarea .vc-custom-cursor, div[contenteditable="true"] .vc-custom-cursor').forEach(cursor => cursor.remove());
    }
});
