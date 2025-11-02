/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { React } from "@webpack/common";

import { SearchModal } from "./SearchModal";
import styles from "./styles.css?managed";

export const settings = definePluginSettings({
    maxResults: {
        type: OptionType.NUMBER,
        description: "Maximum number of results to display",
        default: 100
    },
    searchTimeout: {
        type: OptionType.NUMBER,
        description: "Delay before search (ms)",
        default: 300
    },
    minResultsForAPI: {
        type: OptionType.NUMBER,
        description: "Minimum number of results before using API (0 = always use API)",
        default: 5
    },
    apiRequestDelay: {
        type: OptionType.NUMBER,
        description: "Delay between API requests (ms) to avoid rate limit",
        default: 200
    }
});

// Function to open the search modal
function openSearchModal() {
    openModal(modalProps => React.createElement(SearchModal, { modalProps }));
}

// Observer to intercept the button once it is rendered in the DOM
let observer: MutationObserver | null = null;

function setupButtonInterceptor() {
    // Clean up old observer if it exists
    if (observer) {
        observer.disconnect();
    }

    // Function to intercept the button
    const interceptButton = () => {
        // Find the button by its text or classes
        const buttons = document.querySelectorAll('button[class*="button__201d5"], button[class*="lookFilled"], button');

        buttons.forEach((button: HTMLButtonElement) => {
            const text = button.textContent || button.innerText || "";

            // Check if it's the search button
            if (text.includes("Rechercher") || text.includes("rechercher") || text.includes("lancer une conversation")) {
                // Check if we have already intercepted this button
                if (button.dataset.ultraSearchIntercepted === "true") {
                    return;
                }

                // Mark as intercepted
                button.dataset.ultraSearchIntercepted = "true";

                // Save original onClick
                const originalOnClick = button.onclick;

                // Replace onClick
                button.onclick = (e: MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openSearchModal();
                    return false;
                };

                // Also add an addEventListener to be sure
                button.addEventListener("click", (e: MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openSearchModal();
                }, true);
            }
        });
    };

    // Exécuter immédiatement
    interceptButton();

    // Observer les changements dans le DOM
    observer = new MutationObserver(() => {
        interceptButton();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    });
}

export default definePlugin({
    name: "Ultra Advanced Search",
    description: "Advanced search similar to Discord mobile - Search in all conversations, private messages, images, etc.",
    authors: [{ name: "Bash", id: 1327483363518582784n }],
    isModified: true,

    settings,

    styles,

    patches: [
        // Patch to intercept the "Rechercher/lancer une conversation" button
        {
            find: "Rechercher/lancer une conversation",
            replacement: {
                match: /onClick:(\i[^,}]*),/,
                replace: (match, onClickHandler) => {
                    return "onClick: (...args) => { const e = args[0]; if (e) { e.preventDefault?.(); e.stopPropagation?.(); } $self.openSearchModal(); },";
                }
            }
        },
        // Alternative patch based on mentioned CSS classes
        {
            find: "button__201d5 lookFilled__201d5 colorPrimary__201d5",
            replacement: {
                match: /(button__201d5 lookFilled__201d5 colorPrimary__201d5[^}]*)(onClick:\s*(\i[^,}]*),)/,
                replace: (match, prefix, onClickPart) => {
                    return prefix + "onClick: (...args) => { const e = args[0]; if (e) { e.preventDefault?.(); e.stopPropagation?.(); } $self.openSearchModal(); },";
                }
            }
        },
        // Patch to intercept via "Rechercher" text
        {
            find: "Rechercher",
            replacement: {
                match: /(onClick:\s*(\i[^,}]*),.{0,500}Rechercher[^}]*lancer[^}]*conversation)/,
                replace: match => {
                    return match.replace(/(onClick:\s*)(\i[^,}]*)/, "onClick: (...args) => { const e = args[0]; if (e) { e.preventDefault?.(); e.stopPropagation?.(); } $self.openSearchModal(); }");
                }
            }
        }
    ],

    openSearchModal,

    start() {
        console.log("[Ultra Advanced Search] Plugin started");

        // Wait for DOM to be ready
        if (document.body) {
            setupButtonInterceptor();
        } else {
            // If body is not ready yet, wait
            const checkInterval = setInterval(() => {
                if (document.body) {
                    clearInterval(checkInterval);
                    setupButtonInterceptor();
                }
            }, 100);

            // Clean up after 10 seconds if body is still not there
            setTimeout(() => clearInterval(checkInterval), 10000);
        }
    },

    stop() {
        console.log("[Ultra Advanced Search] Plugin stopped");
        if (observer) {
            observer.disconnect();
            observer = null;
        }

        // Clean up interceptors
        const buttons = document.querySelectorAll('button[data-ultra-search-intercepted="true"]');
        buttons.forEach((button: HTMLButtonElement) => {
            delete button.dataset.ultraSearchIntercepted;
        });
    }
});

