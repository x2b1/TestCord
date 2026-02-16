/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton } from "@api/ChatButtons";
import {
    addMessagePreSendListener,
    MessageSendListener,
    removeMessagePreSendListener,
} from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import { TestcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

// Kaomoji arrays for different tones
const kaomojis: Record<string, string[]> = {
    happy: ["ヽ(´▽`)/", "<(￣︶￣)>", "o(≧▽≦)o", "(─‿‿─)♡", "(*≧ω≦*)"],
    sad: ["ಥ_ಥ", "(´・ω・`)", "(╥_╥)", "｡ﾟ･ (>﹏<) ･ﾟ｡", "(ノ_<。)"],
    angry: ["ヽ(｀Д´)ﾉ", "ヽ(ｏ`皿′ｏ)ﾉ", "(╬ Ò﹏Ó)", "┌∩┐(◣_◢)┌∩┐", "┻━┻ ︵ヽ(`Д´)ﾉ︵ ┻━┻"],
    confused: ["(•ิ_•ิ)?", "(◎_◎;)", "(－ω－)", "(・_・ヂ", "(?_?)"],
    loving: ["(⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)", "ღゝ◡╹)ノ♡", "♥‿♥", "(´∀`)♡", "(◕‿◕)♡"],
    smug: ["ಠ_ಠ", "(￣ー￣)", "(~_~)", "(↼_↼)", "¬_¬"],
    excited: ["(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧", "✌(◕‿-)✌", "(≧◡≦)", "o(*≧▽≦)o", "ヾ(^▽^*)"],
    sleepy: ["(ᴗ_ᴗ)", "(－ω－) zzZ", "(。-ω-)zzz", "(-.-)Zzz...", "(˘ω˘)"],
    crying: ["(ಥ﹏ಥ)", "o(╥﹏╥)o", "(;_;)", "(ノ_<。)", "(T_T)"],
    default: ["(◕‿◕)", "( ˘ᴗ˘ )", "(｡•̀ᴗ-)✧", "(*ᴗ͈ˬᴗ͈)", "( ˘◡˘ )"]
};

// Emoji arrays for different tones
const emojis: Record<string, string[]> = {
    happy: ["😊", "😄", "🥰", "✨", "💕"],
    sad: ["😢", "💔", "😞", "🥺", "💧"],
    angry: ["😠", "😤", "💢", "🔥", "😡"],
    confused: ["😕", "🤔", "😵‍💫", "❓", "😬"],
    loving: ["🥰", "💕", "😍", "❤️", "💖"],
    smug: ["😏", "😌", "😎", "😼", "💅"],
    excited: ["🎉", "🤩", "🙌", "💯", "🔥"],
    sleepy: ["😴", "💤", "😪", "🥱", "😇"],
    crying: ["😭", "😿", "💔", "🥺", "😩"],
    default: ["✨", "👍", "❤️", "😊", "💫"]
};

// Simple word replacement dictionary for autocorrect
const wordReplacements: Record<string, string> = {
    "teh": "the",
    "thier": "their",
    "recieve": "receive",
    "occured": "occurred",
    "seperate": "separate",
    "definately": "definitely",
    "accomodate": "accommodate",
    "occurence": "occurrence",
    "untill": "until",
    "becuase": "because",
    "writting": "writing",
    "truely": "truly",
    "happend": "happened",
    "wierd": "weird",
    "thats": "that's",
    "dont": "don't",
    "cant": "can't",
    "wont": "won't",
    "im": "I'm",
    "ive": "I've",
    "youre": "you're",
    "theyre": "they're",
    "were": "we're",
    "shouldve": "should've",
    "couldve": "could've",
    "wouldve": "would've",
    "doesnt": "doesn't",
    "isnt": "isn't",
    "wasnt": "wasn't",
    "hasnt": "hasn't",
    "havent": "haven't",
    "hadnt": "hadn't",
    "wouldnt": "wouldn't",
    "couldnt": "couldn't",
    "shouldnt": "shouldn't",
    "didnt": "didn't",
    "arent": "aren't",
    "aint": "ain't",
    "gonna": "gon na",
    "wanna": "want to",
    "gotta": "got to",
    "kinda": "kind of",
    "sorta": "sort of",
    "outta": "out of",
    "lemme": "let me",
    "gimme": "give me"
};

// Detect message tone based on keywords
function detectTone(content: string): string {
    const lowerContent = content.toLowerCase();

    if (/\b(happy|glad|excited|love|amazing|awesome|great|wonderful|fantastic|joy|yay|woohoo)\b/i.test(lowerContent)) {
        return "happy";
    }
    if (/\b(sad|cry|tears|miss|lonely|unhappy|upset|depressed|unfortunately|sorry)\b/i.test(lowerContent)) {
        return "sad";
    }
    if (/\b(angry|mad|furious|hate|annoying|stupid|idiot|worst|rage)\b/i.test(lowerContent)) {
        return "angry";
    }
    if (/\b(confused|confusing|what|why|how|question|don't understand)\b/i.test(lowerContent)) {
        return "confused";
    }
    if (/\b(love|love you|love you so much|crush|heart|valentine|babe)\b/i.test(lowerContent)) {
        return "loving";
    }
    if (/\b(satisfy|proud|nice|perfect|better|well|obviously|of course)\b/i.test(lowerContent)) {
        return "smug";
    }
    if (/\b(excited|wow|omg|holy|amazing|incredible|can't wait|soon)\b/i.test(lowerContent)) {
        return "excited";
    }
    if (/\b(tired|sleepy|exhausted|sleep|bed|goodnight|night|zzz)\b/i.test(lowerContent)) {
        return "sleepy";
    }
    if (/\b(cry|crying|sob|tears|sobs)\b/i.test(lowerContent)) {
        return "crying";
    }

    return "default";
}

function getRandomItem<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function applyAutocorrect(content: string): string {
    let corrected = content;

    Object.entries(wordReplacements).forEach(([wrong, right]) => {
        const regex = new RegExp(`\\b${wrong}\\b`, "gi");
        corrected = corrected.replace(regex, right);
    });

    if (corrected.length > 0 && /[a-z]/i.test(corrected[0])) {
        corrected = corrected[0].toUpperCase() + corrected.slice(1);
    }

    if (corrected.length > 0 && !/[.!?]$/.test(corrected.trim())) {
        corrected = corrected.trim() + ".";
    }

    corrected = corrected.replace(/([.!?])\s+([a-z])/g, (match, punct, letter) => {
        return punct + " " + letter.toUpperCase();
    });

    return corrected;
}

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Enable ChatGPT Writing plugin",
        defaultValue: false
    },
    useKaomoji: {
        type: OptionType.BOOLEAN,
        description: "Add a kaomoji at the end of your messages",
        defaultValue: false
    },
    useEmoji: {
        type: OptionType.BOOLEAN,
        description: "Add an emoji at the end of your messages (matching message tone)",
        defaultValue: false
    },
    autocorrect: {
        type: OptionType.BOOLEAN,
        description: "Automatically fix grammar and punctuation",
        defaultValue: false
    }
});

const getPresend = (): MessageSendListener => {
    return (_, msg) => {
        if (!settings.store.enabled) return;

        const backticks = String.fromCharCode(96, 96, 96);
        if (msg.content.indexOf(backticks) !== -1) return;

        let content = msg.content.trim();
        if (!content) return;

        const tone = detectTone(content);

        if (settings.store.autocorrect) {
            content = applyAutocorrect(content);
        }

        if (settings.store.useKaomoji) {
            const kaomoji = getRandomItem(kaomojis[tone] || kaomojis.default);
            content += " " + kaomoji;
        }

        if (settings.store.useEmoji) {
            const emoji = getRandomItem(emojis[tone] || emojis.default);
            content += " " + emoji;
        }

        msg.content = content;
    };
};

export default definePlugin({
    name: "ChatGPTWriting",
    description: "Enhance your messages with kaomoji, emoji, and autocorrect",
    authors: [TestcordDevs.x2b],
    dependencies: ["MessageEventsAPI"],
    settings,

    start() {
        addMessagePreSendListener(getPresend());
    },

    stop() {
        removeMessagePreSendListener(getPresend());
    },

    renderChatBarButton: ({ isMainChat }) => {
        if (!isMainChat) return null;

        return (
            <ChatBarButton
                tooltip={settings.store.enabled ? "ChatGPT Writing (ON)" : "ChatGPT Writing (OFF)"}
                onClick={() => {
                    settings.store.enabled = !settings.store.enabled;
                }}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={settings.store.enabled ? "#5865F2" : "currentColor"}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
                    <path d="M8.5 8.5v.01" />
                    <path d="M16 15.5v.01" />
                    <path d="M12 12v.01" />
                    <path d="M11 17v.01" />
                    <path d="M7 14v.01" />
                </svg>
            </ChatBarButton>
        );
    }
});
