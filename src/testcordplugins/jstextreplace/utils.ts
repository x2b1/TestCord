/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 nin0
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@api/Styles";

export function ds(key: string) {
    return `JSTEXTREPLACE_${key}`;
}
export const cl = classNameFactory("vc-jstr-");

export type Rule = Record<"find" | "replace" | "onlyIfIncludes", string>;

export const makeEmptyRule: () => Rule = () => ({
    find: "",
    replace: "",
    onlyIfIncludes: ""
});
export const makeEmptyRuleArray = () => [makeEmptyRule()];

export const words = [
    "blink", "crush", "glimp", "swoon", "twirl",
    "spark", "shine", "flick", "glint", "drift",
    "blush", "quirk", "charm", "fluff", "gloom",
    "whirl", "groan", "snarl", "bloop", "grasp",
    "mirth", "twine", "hush", "peach", "crack",
    "fuzzy", "gleam", "snack", "float", "briar"
];
export const getRandomWord = () => words[Math.floor(Math.random() * words.length)];
