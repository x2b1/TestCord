/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { enableStyle, disableStyle, setStyleClassNames } from "@api/Styles";
import { TestcordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findCssClassesLazy } from "@webpack";

import style from "./style.css?managed";

const classes = findCssClassesLazy("messageListItem");

export default definePlugin({
    name: "LazyMessageRender",
    description: "Skips layout and paint for offscreen messages using CSS content-visibility, reducing lag in large servers.",
    authors: [TestcordDevs.x2b],

    start() {
        setStyleClassNames(style, { messageListItem: classes.messageListItem });
        enableStyle(style);
    },

    stop() {
        disableStyle(style);
    }
});
