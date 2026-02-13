/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";
import { findByProps } from "@webpack";

export default definePlugin({
    name: "NSFWGateBypass",
    description: "Stable bypass for NSFW age gates.",
    authors: [{
        name: "dxrx99",
        id: 1463629522359423152n
    }],

    start() {
        const UserStore = findByProps("getCurrentUser");
        if (!UserStore) return;

        const patchInterval = setInterval(() => {
            const user = UserStore.getCurrentUser();
            if (user) {

                user.ageVerificationStatus = 3;
                user.nsfwAllowed = true;

                if (typeof user.flags === "number") {
                    user.flags |= 2;
                }

                clearInterval(patchInterval);
            }
        }, 1000);

        const ChannelNSFW = findByProps("isNSFW");
        if (ChannelNSFW) {
            Object.defineProperty(ChannelNSFW, "isNSFW", {
                get: () => () => false,
                configurable: true
            });
        }
    }
});
