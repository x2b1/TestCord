import { definePluginSettings } from "@api/Settings";
import { TestcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { UserStore } from "@webpack/common";

import "./styles.css";

const fontOptions = [
    { label: "gg sans", value: "gg-sans", default: true },
    { label: "Tempo", value: "tempo" },
    { label: "Sakura", value: "sakura" },
    { label: "Jellybean", value: "jellybean" },
    { label: "Modern", value: "modern" },
    { label: "Medieval", value: "medieval" },
    { label: "8Bit", value: "8bit" },
    { label: "Vampyre", value: "vampyre" }
];

const fontMap: Record<string, string> = {
    "gg-sans": "'GG Sans', sans-serif",
    "tempo": "'Zilla Slab', serif",
    "sakura": "'Cherry Bomb One', cursive",
    "jellybean": "'Chicle', cursive",
    "modern": "'MuseoModerno', sans-serif",
    "medieval": "'Neo Castel', serif",
    "8bit": "'Pixelify Sans', monospace",
    "vampyre": "'Sinistre', cursive"
};

const settings = definePluginSettings({
    font: {
        type: OptionType.SELECT,
        description: "Font style for your username",
        options: fontOptions
    }
});

export default definePlugin({
    name: "NameStyleChanger",
    description: "Changes the font of your username in chat",
    authors: [TestcordDevs.x2b],
    settings,

    observer: null as MutationObserver | null,
    currentFont: "",

    start() {
        this.currentFont = settings.store.font;
        this.applyFont();
        this.setupObserver();
    },

    stop() {
        this.observer?.disconnect();
        this.observer = null;
    },

    setupObserver() {
        this.observer = new MutationObserver(() => {
            if (this.currentFont !== settings.store.font) {
                this.currentFont = settings.store.font;
            }
            this.applyFont();
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    },

    applyFont() {
        const currentUser = UserStore.getCurrentUser();
        if (!currentUser) return;

        const fontFamily = fontMap[settings.store.font] ?? fontMap["gg-sans"];
        const userId = currentUser.id;

        const elements = document.querySelectorAll<HTMLElement>(
            `[data-user-id="${userId}"]`
        );

        for (const el of elements) {
            el.style.fontFamily = fontFamily;
        }
    }
});
