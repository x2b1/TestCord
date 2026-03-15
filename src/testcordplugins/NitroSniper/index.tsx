/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { TestcordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";

const logger = new Logger("NitroSniper");
const GiftActions = findByPropsLazy("redeemGiftCode");

let startTime = 0;
let claiming = false;
const codeQueue: string[] = [];

function processQueue() {
    if (claiming || !codeQueue.length) return;

    claiming = true;
    const code = codeQueue.shift()!;

    GiftActions.redeemGiftCode({
        code,
        onRedeemed: () => {
            logger.log(`Successfully redeemed code: ${code}`);
            claiming = false;
            processQueue();
        },
        onError: (err: Error) => {
            logger.error(`Failed to redeem code: ${code}`, err);
            claiming = false;
            processQueue();
        }
    });
}

export default definePlugin({
    name: "NitroSniper",
    description: "Automatically redeems Nitro gift links sent in chat, originally made by neoarz but i fixed it a bit",
    authors: [TestcordDevs.x2b, TestcordDevs.neoarz],

    start() {
        startTime = Date.now();
        codeQueue.length = 0;
        claiming = false;
    },

    flux: {
        MESSAGE_CREATE({ message }) {
            if (!message.content) return;

            const match = message.content.match(/(?:discord\.gift\/|discord\.com\/gifts?\/)([a-zA-Z0-9]{16,24})/);
            if (!match) return;

            if (new Date(message.timestamp).getTime() < startTime) return;

            codeQueue.push(match[1]);
            processQueue();
        }
    }
});
