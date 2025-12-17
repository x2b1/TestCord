/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs, TestcordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

import FriendCodesPanel from "./components/FriendCodesPanel";

export default definePlugin({
    name: "FriendCodes",
    description: "Generate FriendCodes to easily add friends",
    authors: [TestcordDevs.x2b],
    patches: [
        {
            find: ".Messages.ADD_FRIEND}),(",
            replacement: {
                match: /\.Fragment[^]*?children:\[[^]*?}\)/,
                replace: "$&,$self.FriendCodesPanel"
            }
        }
    ],

    get FriendCodesPanel() {
        return <FriendCodesPanel />;
    }
});





