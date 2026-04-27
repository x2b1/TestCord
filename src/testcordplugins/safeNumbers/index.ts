/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addMessagePreEditListener, addMessagePreSendListener, MessageEditListener, MessageSendListener, removeMessagePreEditListener, removeMessagePreSendListener } from "@api/MessageEvents";
import { TestcordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

const DIGIT_MAP: Record<string, string> = {
    "0": "𝟶",
    "1": "𝟷",
    "2": "𝟸",
    "3": "𝟹",
    "4": "𝟺",
    "5": "𝟻",
    "6": "𝟼",
    "7": "𝟽",
    "8": "𝟾",
    "9": "𝟿",
};

function replaceDigits(content: string): string {
    return content.replace(/\d/g, d => DIGIT_MAP[d] ?? d);
}

const preSend: MessageSendListener = (_, msg) => {
    msg.content = replaceDigits(msg.content);
};

const preEdit: MessageEditListener = (_, __, msg) => {
    msg.content = replaceDigits(msg.content);
};

export default definePlugin({
    name: "SafeNumbers",
    description: "replace numbers in ur messages with a similiar math char shi so discord cant touch yo ass and ban for under. hope yall enjoy",
    tags: ["Privacy", "Chat"],
    authors: [TestcordDevs.x2b],
    dependencies: ["MessageEventsAPI"],

    start() {
        addMessagePreSendListener(preSend);
        addMessagePreEditListener(preEdit);
    },

    stop() {
        removeMessagePreSendListener(preSend);
        removeMessagePreEditListener(preEdit);
    },
});
