/*
Made with ❤️ by neoarz
I am not responsible for any damage caused by this plugin; use at your own risk
Vencord does not endorse/support this plugin (Works with Equicord as well)
dm @neoarz if u need help or have any questions
https://github.com/neoarz/NitroSniper
*/

import { Devs } from "@utils/constants";
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
    description: "Automatically redeems Nitro gift links sent in chat",
    authors: [Devs.neoarz],

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

