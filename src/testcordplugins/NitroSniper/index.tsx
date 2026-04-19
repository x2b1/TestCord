/*
Made with ❤️ by neoarz
I am not responsible for any damage caused by this plugin; use at your own risk
Vencord does not endorse/support this plugin (Works with Equicord as well)
dm @neoarz if u need help or have any questions
https://github.com/neoarz/NitroSniper
*/

import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { NavigationRouter, UserStore } from "@webpack/common";
import { findByPropsLazy } from "@webpack";

const logger = new Logger("NitroSniper");
const GiftActions = findByPropsLazy("redeemGiftCode");

let startTime = 0;
let claiming = false;
const codeQueue: string[] = [];

const settings = definePluginSettings({
    notifyOnRedeem: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show a notification when successfully redeeming a nitro code."
    },
    notifyOnFail: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show a notification when failing to redeem a nitro code."
    }
});

function processQueue() {
    if (claiming || !codeQueue.length) return;

    claiming = true;
    const code = codeQueue.shift()!;

    GiftActions.redeemGiftCode({
        code,
        onRedeemed: (gift: any) => {
            logger.log(`Successfully redeemed code: ${code}`);

            if (settings.store.notifyOnRedeem) {
                const user = UserStore.getCurrentUser();
                const giftType = gift?.subscription_plan?.name || "Nitro";

                showNotification({
                    title: "Nitro Sniped! 🎉",
                    body: `Successfully redeemed ${giftType} code`,
                    color: "#5865F2",
                    icon: user.getAvatarURL(),
                    onClick: () => {
                        NavigationRouter.transitionTo("/settings/inventory");
                    }
                });
            }

            claiming = false;
            processQueue();
        },
        onError: (err: Error) => {
            logger.error(`Failed to redeem code: ${code}`, err);
            
            if (settings.store.notifyOnFail) {
                const user = UserStore.getCurrentUser();
                
                showNotification({
                    title: "Nitro Redeem Failed ❌",
                    body: `Failed to redeem code: ${code}`,
                    color: "#ED4245",
                    icon: user.getAvatarURL(),
                });
            }
            
            claiming = false;
            processQueue();
        }
    });
}

export default definePlugin({
    name: "NitroSniper",
    description: "Automatically redeems Nitro gift links sent in chat",
    tags: ["Utility", "Fun"],
    authors: [
        { name: "neoarz", id: 1015372540937502851n },
        { name: "irritably", id: 928787166916640838n }
    ],

    settings,

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

