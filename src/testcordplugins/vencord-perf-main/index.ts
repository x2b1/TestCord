/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";

export default definePlugin({
    name: "perf",
description: "[RISKY]Collection of small performance improvements[RISKY]",
    authors: [
        {
            id: 579731384868798464n,
            name: "void",
        },
    ],
    patches: [{
        // This module does a bunch of nasty spreads, so we kill parts of reactivity to save on performance
        // We disallow calling get games and get usersPlaying to make sure they are not used ( i cant find any references anywhere )
        // since their reactivity is broken
        // Optionally we could still allow calling them, but if they get memoized its over
        find: "=\"NowPlayingStore\"",
        replacement: [{
            match: /get games\(\)\{return \w+?\}/,
            replace: "get games(){throw new Error('Vencord: perf: Not implemented')}",
        }, {
            match: /get usersPlaying\(\)\{return \w+?\}/,
            replace: "get usersPlaying(){throw new Error('Vencord: perf: Not implemented')}",
        }, {
            match: /(\.gameId;return null!=\w\[\w\]&&\().+?,(.+?,)\w={\.\.\.\w\},/,
            replace: (_, prev1, prev2) => prev1 + prev2,
        }, {
            match: /(startedPlaying:\w};return )\w=(\w),\w=(\w),(\w)=.+?(\w)=.+?!0/,
            replace: (_, prev, gameId, activity, perGameId, perUser) => prev +
                `${perGameId}[${gameId}] = { ...${perGameId}[${gameId}], [${activity}.userId]: ${activity} },` +
                `${perUser}[${activity}.userId] = { gameId: ${gameId}, startedPlaying: ${activity}.startedPlaying }`,
        }]
    }, {
        // The tooltip module uses flushSync to immediately push state changes which is kinda unnecessary
        // We bypass this by directly setting the state in a normal variable but still use setState to control the rendering
        find: "this.state.shouldShowTooltip!==",
        replacement: [{
            match: /\w.flushSync\(\(\)=>\{this\.setState\(\{shouldShowTooltip:(\w)\}\)\}\)/,
            replace: (_, param) => "this.__open=" + param + ",this.setState({shouldShowTooltip:" + param + "})",
        }, {
            match: /if\(this\.state\.shouldShowTooltip!==(\w)\)/,
            replace: "if(this.__open!==$1)",
        }]
    }, {
        // cache getters
        // not sure if this one does a whole lot tbh
        find: "this.rebuildFavoriteEmojisWithoutFetchingLatest()",
        replacement: [{
            match: /(\w)=>\{let \w=(\w)\[null==\w\?(\w)\.kod:\w\];null!=\w&&\((\w)\(\)\.each\(\w\.usableEmojis,(\w)\),\w\(\)\.each\(\w\.emoticons,(\w)\)\)\};/,
            replace: (_, e, q, k, a, n, r) => `${e} => {` +
                `const t = ${q}[null == ${e} ? ${k}.kod : ${e}];` +
                "const usableEmojis = t?.usableEmojis;" +
                "const emoticons = t?.emoticons;" +
                `null != t && (${a}().each(usableEmojis, ${n}), ${a}().each(emoticons, ${r}))` +
                "};",
        }]
    }, {
        // Kill loading spinner
        find: /\w\.\w\.getAppSpinnerSources\(\)/,
        replacement: [{
            match: /let \w=\w\.\w\.getAppSpinnerSources\(\).+?;(\w\.\w).+?\)\}/,
            replace: "$1 = () => null;",
        }]
    }, {
        // Remove canvas that renders stuff like confetti etc
        find: "\"SpriteCanvas-module_spriteCanvasHidden",
        replacement: {
            match: /,\w\.createElement\("canvas",{.+?\)}\)/,
            replace: "",
        }
    }, {
        // Remove analytics from gateway, this cost me upwards of 100ms because they JSON.stringify the entire thing
        find: "getDispatchHandler needs to be passed in first!",
        replacement: {
            match: /(\.flush\(\w,\w\),"READY"===\w\)\{).+?;(.+?\)),.+?\}/,
            replace: (_, pre, mid) => pre + mid + "}",
        }
    }]
});
