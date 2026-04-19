/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { TestcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { React, UserStore } from "@webpack/common";

const fontOptions = [
    { label: "gg sans", value: "gg-sans", default: true },
    { label: "Tempo", value: "tempo" },
    { label: "Sakura", value: "sakura" },
    { label: "Jellybean", value: "jellybean" },
    { label: "Modern", value: "modern" },
    { label: "Medieval", value: "medieval" },
    { label: "8Bit", value: "8bit" },
    { label: "Vampyre", value: "vampyre" }
];

const fontMap: Record<string, string> = {
    "gg-sans": "'GG Sans', sans-serif",
    "tempo": "'Zilla Slab', serif",
    "sakura": "'Cherry Bomb One', cursive",
    "jellybean": "'Chicle', cursive",
    "modern": "'MuseoModerno', sans-serif",
    "medieval": "'Neo Castel', serif",
    "8bit": "'Pixelify Sans', monospace",
    "vampyre": "'Sinistre', cursive"
};

const settings = definePluginSettings({
    font: {
        type: OptionType.SELECT,
        description: "Font style for your name",
        options: fontOptions
    }
});

export default definePlugin({
    name: "NameStyleChanger",
    description: "Change the font style of your own username and display name. (basically Display Name Styles but free)",
    tags: ["Customisation", "Appearance"],
    authors: [TestcordDevs.x2b],
    settings,

    start() {
        console.log("NameStyleChanger: Plugin loaded!");
    },

    patches: [
        {
            find: '="SYSTEM_TAG"',
            group: true,
            replacement: {
                match: /(?<=colorString:(\i),colorStrings:(\i).{0,900}?)style:.{0,120}?,(onClick:\i,onContextMenu:\i,children:)(.{0,250}?),"data-text":(\i\+\i)/,
                replace: "$3$self.getMessageNameElement({...arguments[0],colorString:$1,colorStrings:$2})??($4),\"data-text\":$5"
            }
        }
    ],

    getMessageNameElement(props: any) {
        const { author, children, message } = props;
        // Try to get author from props or message
        const authorId = author?.id ?? message?.author?.id;
        const currentUserId = UserStore.getCurrentUser()?.id;
        // Debug logging
        console.log("NameStyleChanger props:", { authorId, currentUserId, hasChildren: !!children, childrenType: typeof children });
        if (!authorId || authorId !== currentUserId) return null;
        if (!children) return null;

        const fontFamily = fontMap[settings.store.font] ?? fontMap["gg-sans"];

        // Handle different children types - may be string, array, or element
        return <span style={{ fontFamily }}>{children}</span>;
    }
});
