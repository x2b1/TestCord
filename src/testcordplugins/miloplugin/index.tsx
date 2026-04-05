/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { addMessagePreSendListener, removeMessagePreSendListener } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import { TestcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { React } from "@webpack/common";

// Word replacements
const wordMapFiltered: Record<string, string> = {
    // Pronouns / fun replacements (keep all, as they include symbols or numbers)
    I: "nya",
    you: "nyou",
    he: "he 0-0",
    she: "she -w-",
    we: "we OwO",
    they: "thwey :3",
    me: "Mwee",
    him: "Him",
    us: "us OwO",
    my: "Kittens",
    your: "Nyours",
    his: "his -w-",
    our: "nyaour",
    their: "thwey",
    mine: "Kittens",
    yours: "Masters",

    // Demonstratives / determiners with symbols/numbers
    that: "Nyat",
    this: "dis",
    these: "theze",
    those: "thoze",

    // Verbs with symbols/numbers
    love: "luv~",
    like: "lyk~",
    play: "play~",
    run: "run~",
    walk: "walkies~",
    eat: "nom~",
    drink: "sip~",

    // Nouns with symbols/numbers
    man: "Daddy~",
    part: "pwart",
    eye: "eyenya",
    government: "gov~",
    company: "comp~",
    home: "home~",
    room: "room~",
    mother: "mommy~",
    father: "daddy~",
    friend: "friend~",
    family: "fam~",
    story: "story~",
    health: "health~",
    president: "pres~",
    x2b: "fatass",
    money: "mwoney :3",
    cat: "nyan~",
    dog: "woof~",
    food: "nom~",

    // Adjectives with flair
    own: "own~",
    different: "diff~",
    early: "early~",
    public: "public~",
    bad: "bad~",
    major: "majr~",
    clear: "clear~",
    special: "spec~",
    cute: "kawaii~",
    happy: "happy~",
    funny: "funny~",

    // Adverbs / connectors with flair
    as_if: "as if~",
    as_long_as: "as long as~",
    as_much_as: "as much as~",
    as_soon_as: "as soon as~",
    even_if: "even if~",
    even_though: "even tho~",
    if_only: "if only~",
    in_order_that: "so that~",
    once: "once~",
    provided_that: "provided~",
    rather_than: "rather~",
    until: "until~",
    when: "when~",
    whenever: "whenever~",
    nevertheless: "neverthless~",
    nonetheless: "nonetheless~",
    assuming: "assum~",
    supposing: "suppose~",

    // Fun extras
    yes: "yep~",
    no: "nop~",
    ok: "okie~",
    thanks: "thx~",
    welcome: "welc~",
    hey: "hewwo~",
    hello: "hewwo~",
    bye: "bai~",
    love: "luv~",
    friend: "buddy~",
    party: "party~",
    lol: "lol~",
    omg: "omg~",
    wow: "wow~",
};

const cuteFaces = ["OwO", "UwU", "-w-", ":3", ";3c", ";3", "qwq", "0w0", "'w'", "-3-"];

const mapWords = (text: string, wordMap: Record<string, string>) => {
    return text.replace(/\b\w+\b/g, word => wordMap[word] || word);
};

const addRandomFaces = (text: string, chance = 0.15) => {
    return text.split("").map(char => {
        if (Math.random() < chance) {
            const face = cuteFaces[Math.floor(Math.random() * cuteFaces.length)];
            return char + face;
        }
        return char;
    }).join("");
};

// tekst - DO NAPRAWY
const sillyKittenTransform = (text: string) => {
    const mapped = mapWords(text, wordMapFiltered);
    return addRandomFaces(mapped);
};

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Enable Silly Kitten mode!~~",
        default: false
    }
});

function handleMessageSend(channelId: string, messageObj: any): void | { cancel: boolean; } {
    if (!settings.store.enabled) return;
    if (messageObj.content) {
        messageObj.content = sillyKittenTransform(messageObj.content);
    }
}

// Chat bar button
const SillyKittenButton: ChatBarButtonFactory = ({ isMainChat }) => {
    if (!isMainChat) return null;
    const { enabled } = settings.use(["enabled"]);
    return (
        <ChatBarButton
            tooltip={enabled ? "Silly Kitten: ON" : "Silly Kitten: OFF"}
            onClick={() => { settings.store.enabled = !settings.store.enabled; }}
        >
            <svg width="20" height="20" viewBox="0 0 24 24" style={{ color: enabled ? "#da373c" : "currentColor" }}>
                {enabled ? (
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                ) : (
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
                )}
            </svg>
        </ChatBarButton>
    );
};

// Export plugin
export default definePlugin({
    name: "Silly Kitten",
    description: "Transform your messages into cute silly kitten text! >w<",
    authors: [TestcordDevs.x2b, TestcordDevs.sirphantom89, TestcordDevs.milo],
    settings: settings,
    dependencies: ["ChatInputButtonAPI"],
    start() {
        addMessagePreSendListener(handleMessageSend);
    },
    stop() {
        removeMessagePreSendListener(handleMessageSend);
    },
    renderChatBarButton: SillyKittenButton
});
