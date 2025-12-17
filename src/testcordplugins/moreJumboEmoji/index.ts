/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {definePluginSettings} from "@api/Settings";
import {Devs} from "@utils/constants";
import definePlugin, {makeRange, OptionType} from "@utils/types";

const settings = definePluginSettings({
    threshold: {
        description: "Number of emojis that are allowed to be jumbo",
        type: OptionType.SLIDER,
        markers: makeRange(0, 200, 10),
        default: 50,
        stickToMarkers: false,
        onChange(v) {
            settings.store.threshold = Math.round(v);
        }
    },
    unlimited: {
        description: "Unlimited jumbo emojis",
        type: OptionType.BOOLEAN,
        default: false,
    }
});

export default definePlugin({
    name: "MoreJumboEmoji",
    description: "Unlock the maximum amount of jumbo emoji",
    authors: [Devs.Sqaaakoi, EquicordDevs.x2b],
    tags: ["wumboji"],
    settings,
    patches: [{
        find: ".jumboable=",
        replacement: {
            match: /,(\i)>30\)/g,
            replace: ",$self.calculate($1))"
        }
    }],
    calculate(emojiCount: number) {
        return !(settings.store.unlimited || (emojiCount <= settings.store.threshold));
    }
});



