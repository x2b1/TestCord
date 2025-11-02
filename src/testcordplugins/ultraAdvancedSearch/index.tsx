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
        description: "Nombre maximum de résultats à afficher",
        default: 100
    },
    searchTimeout: {
        type: OptionType.NUMBER,
        description: "Délai avant la recherche (ms)",
        default: 300
    },
    minResultsForAPI: {
        type: OptionType.NUMBER,
        description: "Nombre minimum de résultats avant d'utiliser l'API (0 = toujours utiliser l'API)",
        default: 5
    },
    apiRequestDelay: {
        type: OptionType.NUMBER,
        description: "Délai entre les requêtes API (ms) pour éviter le rate limit",
        default: 200
    }
});

// Fonction pour ouvrir le modal de recherche
function openSearchModal() {
    openModal(modalProps => React.createElement(SearchModal, { modalProps }));
}

// Observer pour intercepter le bouton une fois qu'il est rendu dans le DOM
let observer: MutationObserver | null = null;

function setupButtonInterceptor() {
    // Nettoyer l'ancien observer s'il existe
    if (observer) {
        observer.disconnect();
    }

    // Fonction pour intercepter le bouton
    const interceptButton = () => {
        // Chercher le bouton par son texte ou ses classes
        const buttons = document.querySelectorAll('button[class*="button__201d5"], button[class*="lookFilled"], button');
        
        buttons.forEach((button: HTMLButtonElement) => {
            const text = button.textContent || button.innerText || "";
            
            // Vérifier si c'est le bouton de recherche
            if (text.includes("Rechercher") || text.includes("rechercher") || text.includes("lancer une conversation")) {
                // Vérifier si on a déjà intercepté ce bouton
                if (button.dataset.ultraSearchIntercepted === "true") {
                    return;
                }
                
                // Marquer comme intercepté
                button.dataset.ultraSearchIntercepted = "true";
                
                // Sauvegarder le onClick original
                const originalOnClick = button.onclick;
                
                // Remplacer le onClick
                button.onclick = (e: MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openSearchModal();
                    return false;
                };
                
                // Ajouter aussi un addEventListener pour être sûr
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
    description: "Recherche avancée similaire à Discord mobile - Recherche dans toutes les conversations, messages privés, images, etc.",
    authors: [{ name: "Bash", id: 1327483363518582784n }],
    isModified: true,

    settings,
    
    styles,

    patches: [
        // Patch pour intercepter le bouton "Rechercher/lancer une conversation"
        {
            find: "Rechercher/lancer une conversation",
            replacement: {
                match: /onClick:(\i[^,}]*),/,
                replace: (match, onClickHandler) => {
                    return `onClick: (...args) => { const e = args[0]; if (e) { e.preventDefault?.(); e.stopPropagation?.(); } $self.openSearchModal(); },`
                }
            }
        },
        // Patch alternatif basé sur les classes CSS mentionnées
        {
            find: "button__201d5 lookFilled__201d5 colorPrimary__201d5",
            replacement: {
                match: /(button__201d5 lookFilled__201d5 colorPrimary__201d5[^}]*)(onClick:\s*(\i[^,}]*),)/,
                replace: (match, prefix, onClickPart) => {
                    return prefix + `onClick: (...args) => { const e = args[0]; if (e) { e.preventDefault?.(); e.stopPropagation?.(); } $self.openSearchModal(); },`
                }
            }
        },
        // Patch pour intercepter via le texte "Rechercher"
        {
            find: "Rechercher",
            replacement: {
                match: /(onClick:\s*(\i[^,}]*),.{0,500}Rechercher[^}]*lancer[^}]*conversation)/,
                replace: (match) => {
                    return match.replace(/(onClick:\s*)(\i[^,}]*)/, `onClick: (...args) => { const e = args[0]; if (e) { e.preventDefault?.(); e.stopPropagation?.(); } $self.openSearchModal(); }`)
                }
            }
        }
    ],

    openSearchModal,

    start() {
        console.log("[Ultra Advanced Search] Plugin démarré");
        
        // Attendre que le DOM soit prêt
        if (document.body) {
            setupButtonInterceptor();
        } else {
            // Si le body n'est pas encore prêt, attendre
            const checkInterval = setInterval(() => {
                if (document.body) {
                    clearInterval(checkInterval);
                    setupButtonInterceptor();
                }
            }, 100);
            
            // Nettoyer après 10 secondes si le body n'est toujours pas là
            setTimeout(() => clearInterval(checkInterval), 10000);
        }
    },

    stop() {
        console.log("[Ultra Advanced Search] Plugin arrêté");
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        
        // Nettoyer les intercepteurs
        const buttons = document.querySelectorAll('button[data-ultra-search-intercepted="true"]');
        buttons.forEach((button: HTMLButtonElement) => {
            delete button.dataset.ultraSearchIntercepted;
        });
    }
});

