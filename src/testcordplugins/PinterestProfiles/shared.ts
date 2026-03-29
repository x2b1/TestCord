/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { classNameFactory } from "@utils/css";
import { makeRange, OptionType, PluginNative } from "@utils/types";

export type SearchTarget = "IMAGE" | "ALL" | "AVATAR" | "BANNER";
export type SearchKind = Exclude<SearchTarget, "ALL">;
export type MediaFilter = "ALL" | "GIFS";

export interface PinterestGuide {
    label: string;
    query: string;
}

export interface PinterestImageResult {
    id: string;
    title: string;
    description: string;
    url: string;
    width: number;
    height: number;
    dominantColor: string | null;
    pinterestUrl: string | null;
    isGif: boolean;
}

export interface PinterestSearchPayload {
    query: string;
    guides: PinterestGuide[];
    results: PinterestImageResult[];
    bookmark: string[] | null;
}

export interface NativeMediaResult {
    data: ArrayBuffer;
    dataUrl: string;
    type: string;
    filename: string;
}

export interface SearchBucketState {
    data: PinterestSearchPayload | null;
    activeQuery: string;
    bookmark: string[] | null;
    page: number;
    loadingNextPage: boolean;
    error: string;
}

export interface PinterestPickerProps {
    onSelectItem: (item: { url: string; }) => void;
}

export interface ManaSearchBarProps {
    autoFocus?: boolean;
    placeholder?: string;
    query?: string;
    onChange?: (query: string) => void;
    onClear?: () => void;
}

export const cl = classNameFactory("vc-pinterest-profiles-");

export const settings = definePluginSettings({
    avatarSlots: {
        type: OptionType.SLIDER,
        description: "How many avatar results to show per page",
        markers: makeRange(1, 8),
        default: 4
    },
    bannerSlots: {
        type: OptionType.SLIDER,
        description: "How many banner results to show per page",
        markers: makeRange(1, 6),
        default: 2
    }
});

export const Native = VencordNative.pluginHelpers.PinterestSearch as PluginNative<typeof import("./native")>;
