/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { showNotification } from "@api/Notifications";
import { addMessagePreSendListener, MessageSendListener, removeMessagePreSendListener } from "@api/MessageEvents";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Activer le plugin Abreviation",
        default: true
    },
    showNotifications: {
        type: OptionType.BOOLEAN,
        description: "Afficher les notifications lors de l'expansion",
        default: false
    },
    caseSensitive: {
        type: OptionType.BOOLEAN,
        description: "Respecter la casse des abréviations",
        default: false
    },
    debugMode: {
        type: OptionType.BOOLEAN,
        description: "Mode débogage (logs détaillés)",
        default: false
    },
    toggleKeybind: {
        type: OptionType.STRING,
        description: "Raccourci clavier pour activer/désactiver le plugin (ex: ctrl+shift+a)",
        default: "ctrl+shift+a"
    },
    showToggleNotification: {
        type: OptionType.BOOLEAN,
        description: "Afficher une notification lors du toggle via keybind",
        default: true
    },
    abbreviations: {
        type: OptionType.STRING,
        description: "Abréviations (format: abrév1=texte complet1|abrév2=texte complet2)",
        default: "btw=by the way|omg=oh my god|brb=be right back|afk=away from keyboard|imo=in my opinion|tbh=to be honest|lol=laughing out loud|wtf=what the f*ck|nvm=never mind|thx=thanks|pls=please|u=you|ur=your|bc=because|rn=right now|irl=in real life|fyi=for your information|asap=as soon as possible|ttyl=talk to you later|gtg=got to go|idk=I don't know|ikr=I know right|smh=shaking my head|dm=direct message|gm=good morning|gn=good night|gl=good luck|hf=have fun|wp=well played|gg=good game|ez=easy|op=overpowered|nerf=reduce power|buff=increase power|meta=most effective tactics available|fdp=fils de pute"
    },
    customAbbreviations: {
        type: OptionType.STRING,
        description: "Abréviations personnalisées (même format que ci-dessus)",
        default: ""
    }
});

// État du plugin (peut être différent du setting pour le toggle temporaire)
let isPluginActive = true;

// Fonction de log avec préfixe
function log(message: string, level: "info" | "warn" | "error" = "info") {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[Abreviation ${timestamp}]`;

    switch (level) {
        case "warn":
            console.warn(prefix, message);
            break;
        case "error":
            console.error(prefix, message);
            break;
        default:
            console.log(prefix, message);
    }
}

// Log de débogage
function debugLog(message: string) {
    if (settings.store.debugMode) {
        log(`🔍 ${message}`, "info");
    }
}

// Fonction pour parser un keybind
function parseKeybind(keybind: string): { ctrl: boolean; shift: boolean; alt: boolean; key: string; } {
    const parts = keybind.toLowerCase().split('+');
    const result = {
        ctrl: false,
        shift: false,
        alt: false,
        key: ''
    };

    for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed === 'ctrl' || trimmed === 'control') {
            result.ctrl = true;
        } else if (trimmed === 'shift') {
            result.shift = true;
        } else if (trimmed === 'alt') {
            result.alt = true;
        } else {
            result.key = trimmed;
        }
    }

    return result;
}

// Fonction pour toggle l'état du plugin
function togglePlugin() {
    isPluginActive = !isPluginActive;

    const status = isPluginActive ? "activé" : "désactivé";
    const emoji = isPluginActive ? "✅" : "❌";

    log(`${emoji} Plugin ${status} via keybind`);

    if (settings.store.showToggleNotification) {
        showNotification({
            title: `${emoji} Abreviation ${status}`,
            body: isPluginActive ? "Les abréviations seront expansées" : "Les abréviations ne seront plus expansées",
            icon: undefined
        });
    }
}

// Gestionnaire d'événements clavier
function handleKeyDown(event: KeyboardEvent) {
    const keybind = parseKeybind(settings.store.toggleKeybind);

    // Vérifier si le keybind correspond
    if (
        event.ctrlKey === keybind.ctrl &&
        event.shiftKey === keybind.shift &&
        event.altKey === keybind.alt &&
        event.key.toLowerCase() === keybind.key
    ) {
        event.preventDefault();
        event.stopPropagation();
        togglePlugin();
    }
}

// Parseur d'abréviations
function parseAbbreviations(abbreviationsString: string): Map<string, string> {
    const abbrevMap = new Map<string, string>();

    if (!abbreviationsString.trim()) return abbrevMap;

    const pairs = abbreviationsString.split('|');

    for (const pair of pairs) {
        const [abbrev, expansion] = pair.split('=');
        if (abbrev && expansion) {
            const key = settings.store.caseSensitive ? abbrev.trim() : abbrev.trim().toLowerCase();
            abbrevMap.set(key, expansion.trim());
        }
    }

    return abbrevMap;
}

// Fonction pour obtenir toutes les abréviations
function getAllAbbreviations(): Map<string, string> {
    const defaultAbbrevs = parseAbbreviations(settings.store.abbreviations);
    const customAbbrevs = parseAbbreviations(settings.store.customAbbreviations);

    // Fusionner les deux maps (les personnalisées ont la priorité)
    const combined = new Map([...defaultAbbrevs, ...customAbbrevs]);

    return combined;
}

// Fonction pour expandre les abréviations dans un texte
function expandAbbreviations(text: string): { newText: string; expansions: Array<{ abbrev: string; expansion: string; }>; } {
    if (!text.trim()) {
        return { newText: text, expansions: [] };
    }

    const abbreviations = getAllAbbreviations();
    const expansions: Array<{ abbrev: string; expansion: string; }> = [];

    // Diviser le texte en mots, en préservant les espaces et la ponctuation
    const words = text.split(/(\s+)/);

    for (let i = 0; i < words.length; i++) {
        const word = words[i];

        // Ignorer les espaces
        if (/^\s+$/.test(word)) continue;

        // Extraire le mot sans ponctuation pour la vérification
        const cleanWord = word.replace(/[^\w]/g, '');
        if (!cleanWord) continue;

        // Vérifier si c'est une abréviation
        const searchKey = settings.store.caseSensitive ? cleanWord : cleanWord.toLowerCase();
        const expansion = abbreviations.get(searchKey);

        if (expansion) {
            // Préserver la ponctuation originale
            const punctuation = word.replace(cleanWord, '');
            words[i] = expansion + punctuation;

            expansions.push({
                abbrev: cleanWord,
                expansion: expansion
            });

            debugLog(`Expansion trouvée: "${cleanWord}" → "${expansion}"`);
        }
    }

    return {
        newText: words.join(''),
        expansions: expansions
    };
}

// Listener pour les messages avant envoi
const messagePreSendListener: MessageSendListener = (channelId, messageObj, extra) => {
    // Vérifier si le plugin est activé (état global ET état temporaire)
    if (!settings.store.enabled || !isPluginActive) {
        return;
    }

    const originalContent = messageObj.content;
    if (!originalContent || !originalContent.trim()) {
        return;
    }

    const { newText, expansions } = expandAbbreviations(originalContent);

    if (expansions.length > 0) {
        messageObj.content = newText;

        log(`✨ ${expansions.length} expansion(s) effectuée(s)`);

        for (const { abbrev, expansion } of expansions) {
            log(`   "${abbrev}" → "${expansion}"`);
        }

        if (settings.store.showNotifications) {
            const expansionText = expansions.map(e => `"${e.abbrev}" → "${e.expansion}"`).join(", ");
            showNotification({
                title: "📝 Abreviation",
                body: `Expansions: ${expansionText}`,
                icon: undefined
            });
        }
    }
};

export default definePlugin({
    name: "Abreviation",
    description: "Transforme automatiquement des abréviations en texte complet lors de l'envoi de messages",
    authors: [{
        name: "Bash",
        id: 1327483363518582784n
    }],
    dependencies: ["MessageEventsAPI"],
    settings,

    start() {
        log("🚀 Plugin Abreviation démarré");

        // Réinitialiser l'état actif
        isPluginActive = settings.store.enabled;

        const abbreviations = getAllAbbreviations();
        log(`📚 ${abbreviations.size} abréviations chargées`);
        log(`⌨️ Keybind configuré: ${settings.store.toggleKeybind}`);

        // Ajouter le listener pour les messages avant envoi
        addMessagePreSendListener(messagePreSendListener);

        // Ajouter le listener pour les événements clavier
        document.addEventListener('keydown', handleKeyDown, true);

        debugLog(`Mode débogage: ${settings.store.debugMode ? "ACTIVÉ" : "DÉSACTIVÉ"}`);

        if (settings.store.showNotifications) {
            showNotification({
                title: "📝 Abreviation activé",
                body: `${abbreviations.size} abréviations disponibles. Toggle: ${settings.store.toggleKeybind}`,
                icon: undefined
            });
        }
    },

    stop() {
        log("🛑 Plugin Abreviation arrêté");

        // Retirer les listeners
        removeMessagePreSendListener(messagePreSendListener);
        document.removeEventListener('keydown', handleKeyDown, true);

        if (settings.store.showNotifications) {
            showNotification({
                title: "📝 Abreviation désactivé",
                body: "Plugin arrêté",
                icon: undefined
            });
        }
    }
}); 