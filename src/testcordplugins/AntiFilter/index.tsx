/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { addMessagePreSendListener, removeMessagePreSendListener } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import { TestcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { React } from "@webpack/common";

// Light mode - using Mathematical Alphanumeric Symbols (nearly identical)
const lightCharMap: Record<string, string> = {
    // These look nearly identical to regular Latin letters
    a: "𝑎", b: "𝑏", c: "𝑐", d: "𝑑", e: "𝑒", f: "𝑓", g: "𝑔", h: "ℎ", i: "𝑖",
    j: "𝑗", k: "𝑘", l: "𝑙", m: "𝑚", n: "𝑛", o: "𝑜", p: "𝑝", q: "𝑞", r: "𝑟",
    s: "𝑠", t: "𝑡", u: "𝑢", v: "𝑣", w: "𝑤", x: "𝑥", y: "𝑦", z: "𝑧",
    A: "𝐴", B: "𝐵", C: "𝐶", D: "𝐷", E: "𝐸", F: "𝐹", G: "𝐺", H: "𝐻", I: "𝐼",
    J: "𝐽", K: "𝐾", L: "𝐿", M: "𝑀", N: "𝑁", O: "𝑂", P: "𝑃", Q: "𝑄", R: "𝑅",
    S: "𝑆", T: "𝑇", U: "𝑈", V: "𝑉", W: "𝑊", X: "𝑋", Y: "𝑌", Z: "𝑍",
};

const middleCharMap: Record<string, string> = {
    // Latin lowercase -> Cyrillic lookalikes
    a: "а", b: "ƅ", c: "с", d: "ԁ", e: "е", f: "ƒ", g: "ɡ", h: "һ", i: "і",
    j: "ј", k: "κ", l: "ӏ", m: "м", n: "ո", o: "ο", p: "р", q: "ԛ", r: "г",
    s: "ѕ", t: "т", u: "υ", v: "ν", w: "ш", x: "х", y: "у",
    // Latin uppercase -> Cyrillic/Greek lookalikes
    A: "А", B: "Β", C: "С", D: "D", E: "Ε", F: "F", G: "G", H: "Η", I: "Ι",
    J: "Ј", K: "Κ", L: "L", M: "Μ", N: "Ν", O: "Ο", P: "Ρ", Q: "Q", R: "R",
    S: "Ѕ", T: "Τ", U: "U", V: "V", W: "W", X: "Χ", Y: "Υ", Z: "Ζ",
};

const extendedCharMap: Record<string, string> = {
    a: "а", b: "ƅ", c: "с", d: "ԁ", e: "е", f: "ƒ", g: "ɡ", h: "һ", i: "і",
    j: "ј", k: "κ", l: "ӏ", m: "м", n: "ո", o: "ο", p: "р", q: "ԛ", r: "г",
    s: "ѕ", t: "т", u: "υ", v: "ν", w: "ш", x: "х", y: "у",
    A: "А", B: "Β", C: "С", E: "Ε", F: "F", G: "G", H: "Η",
    I: "Ι", J: "Ј", K: "Κ", L: "L", M: "Μ", N: "Ν", O: "Ο",
    P: "Ρ", R: "R", S: "Ѕ", T: "Τ", U: "U", V: "V", W: "W",
    X: "Χ", Y: "Υ",
};

// Zalgo combining characters
const zalgoChars = ["", "̀", "́", "̂", "̃", "̄", "̅", "̇", "̈"];

const mapCharacters = (text: string, map: Record<string, string>) =>
    text.split("").map(char => map[char] || char).join("");

const mapCharactersExtended = (text: string, map: Record<string, string>) => {
    return text.split("").map(char => {
        if (map[char]) return map[char];
        // Add subtle zalgo for unmapped alphanumeric
        if (char.match(/[a-zA-Z0-9]/)) {
            const zalgo = zalgoChars[Math.floor(Math.random() * 3)];
            return char + zalgo;
        }
        return char;
    }).join("");
};

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Enable AntiFilter bypass",
        default: false
    },
    isEnabled: {
        type: OptionType.BOOLEAN,
        description: "Toggle the feature on/off (button controls this)",
        default: false
    },
    mode: {
        type: OptionType.SELECT,
        description: "Bypass mode",
        options: [
            { label: "Light (Math symbols)", value: "light", default: true },
            { label: "Middle (Cyrillic)", value: "middle" },
            { label: "Extended (Cyrillic + Zalgo)", value: "extended" }
        ]
    }
});

function transformText(text: string, mode: string): string {
    switch (mode) {
        case "light":
            return mapCharacters(text, lightCharMap);
        case "middle":
            return mapCharacters(text, middleCharMap);
        case "extended":
            return mapCharactersExtended(text, extendedCharMap);
        default:
            return mapCharacters(text, lightCharMap);
    }
}

// Message pre-send handler
function handleMessageSend(channelId: string, messageObj: any, options: any): void | { cancel: boolean; } {
    if (!settings.store.enabled || !settings.store.isEnabled) return;

    if (messageObj.content) {
        messageObj.content = transformText(messageObj.content, settings.store.mode);
    }
}

const AntiFilterButton: ChatBarButtonFactory = ({ isMainChat }) => {
    const { enabled, isEnabled } = settings.use(["enabled", "isEnabled"]);

    if (!isMainChat) return null;

    if (!enabled) return null;

    return (
        <ChatBarButton
            tooltip={isEnabled ? "AntiFilter: ON" : "AntiFilter: OFF"}
            onClick={() => {
                settings.store.isEnabled = !settings.store.isEnabled;
            }}
        >
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                style={{ color: isEnabled ? "#da373c" : "currentColor" }}
            >
                {isEnabled ? (
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                ) : (
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
                )}
            </svg>
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "AntiFilter",
    description: "Bypass automod filters using lookalike Unicode characters",
    authors: [TestcordDevs.x2b, TestcordDevs.sirphantom89],
    settings: settings,
    dependencies: ["ChatInputButtonAPI"],

    start() {
        addMessagePreSendListener(handleMessageSend);
    },

    stop() {
        removeMessagePreSendListener(handleMessageSend);
    },

    renderChatBarButton: AntiFilterButton
});
