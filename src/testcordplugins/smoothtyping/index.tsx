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

                /* 5. Position relative for absolute cursor positioning */
                position: relative !important;
            }

            /* Custom smooth cursor */
            .vc-custom-cursor {
                position: absolute;
                width: 3px;
                height: 1.2em;
                background: white;
                border-radius: 2px;
                transition: left 0.1s ease, top 0.1s ease;
                pointer-events: none;
                z-index: 1000;
                animation: blink 2s infinite;
            }

            .vc-custom-cursor.active {
                animation: none;
                opacity: 1;
            }

            @keyframes blink {
                0%, 80% { opacity: 1; }
                81%, 100% { opacity: 0; }
            }

            /* Highlight Selection Color to match VS Code Dark+ */
            ::selection {
                background: #264f78 !important;
                color: white !important;
            }
        `;
        document.head.appendChild(style);

        // Smooth cursor animation logic
        const charWidth = 9; // Approximate width for 15px monospace font

        function updateCursor(input: HTMLElement) {
            let cursor = input.querySelector(".vc-custom-cursor") as HTMLElement;
            if (!cursor) {
                cursor = document.createElement("div");
                cursor.className = "vc-custom-cursor";
                input.appendChild(cursor);
            }

            // Add active class to stop blinking while typing
            cursor.classList.add("active");
            clearTimeout((cursor as any).blinkTimeout);
            (cursor as any).blinkTimeout = setTimeout(() => {
                cursor.classList.remove("active");
            }, 1000); // Remove active after 1 second of no updates

            // Get padding to offset cursor position
            const style = getComputedStyle(input);
            const paddingLeft = parseFloat(style.paddingLeft) || 0;
            const paddingTop = parseFloat(style.paddingTop) || 0;

            if (input.tagName === "TEXTAREA" || input.tagName === "INPUT") {
                const inputEl = input as HTMLInputElement | HTMLTextAreaElement;
                const text = inputEl.value;
                const lines = text.split("\n");
                const cursorPos = inputEl.selectionStart || 0;
                let lineIndex = 0;
                let charIndex = cursorPos;
                for (let i = 0; i < lines.length; i++) {
                    if (charIndex <= lines[i].length) {
                        lineIndex = i;
                        break;
                    }
                    charIndex -= lines[i].length + 1; // +1 for \n
                }
                const left = charWidth * charIndex;
                const top = lineIndex * 22.5;
                cursor.style.left = `${left + paddingLeft}px`;
                cursor.style.top = `${top + paddingTop}px`;
            } else if (input.contentEditable === "true") {
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0 && selection.isCollapsed) {
                    const range = selection.getRangeAt(0);
                    const rect = range.getBoundingClientRect();
                    const inputRect = input.getBoundingClientRect();
                    cursor.style.left = `${rect.left - inputRect.left}px`;
                    cursor.style.top = `${rect.top - inputRect.top}px`;
                    cursor.style.display = "block";
                } else {
                    cursor.style.display = "none";
                }
            } else {
                // Fallback
                cursor.style.left = `${paddingLeft}px`;
                cursor.style.top = `${paddingTop}px`;
            }
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

        const keydownHandler = (e: KeyboardEvent) => {
            const input = e.target as HTMLElement;
            if (input.matches('div[role="textbox"], textarea, div[contenteditable="true"]')) {
                // Update cursor on keydown for smoother animation
                setTimeout(() => updateCursor(input), 0);
            }
        };

        const selectionChangeHandler = () => {
            const activeElement = document.activeElement as HTMLElement;
            if (activeElement && activeElement.matches('div[role="textbox"], textarea, div[contenteditable="true"]')) {
                updateCursor(activeElement);
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
        document.addEventListener("keydown", keydownHandler);
        document.addEventListener("keyup", keyupHandler);
        document.addEventListener("selectionchange", selectionChangeHandler);
        document.addEventListener("focusout", focusOutHandler);

        // Store handlers for removal
        (this as any).focusInHandler = focusInHandler;
        (this as any).inputHandler = inputHandler;
        (this as any).keydownHandler = keydownHandler;
        (this as any).selectionChangeHandler = selectionChangeHandler;
        (this as any).focusOutHandler = focusOutHandler;
    },

    stop() {
        const style = document.getElementById("vc-vscode-styles");
        if (style) style.remove();

        // Remove event listeners
        if ((this as any).focusInHandler) document.removeEventListener("focusin", (this as any).focusInHandler);
        if ((this as any).inputHandler) document.removeEventListener("input", (this as any).inputHandler);
        if ((this as any).keydownHandler) document.removeEventListener("keydown", (this as any).keydownHandler);
        if ((this as any).keyupHandler) document.removeEventListener("keyup", (this as any).keyupHandler);
        if ((this as any).selectionChangeHandler) document.removeEventListener("selectionchange", (this as any).selectionChangeHandler);
        if ((this as any).focusOutHandler) document.removeEventListener("focusout", (this as any).focusOutHandler);

        // Remove any remaining custom cursors
        document.querySelectorAll('div[role="textbox"] .vc-custom-cursor, textarea .vc-custom-cursor, div[contenteditable="true"] .vc-custom-cursor').forEach(cursor => cursor.remove());
    }
});
