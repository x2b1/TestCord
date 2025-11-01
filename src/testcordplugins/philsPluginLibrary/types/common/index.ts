/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface Resolution {
    width: number;
    height: number;
}

export interface Framerate {
    framerate: number;
}

export interface Bitrate {
    min: number;
    target: number;
    max: number;
}

export type DeepPartial<T> = T extends Function
    ? T
    : T extends Array<infer InferredArrayMember>
    ? DeepPartialArray<InferredArrayMember>
    : T extends object
    ? DeepPartialObject<T>
    : T | undefined;

interface DeepPartialArray<T> extends Array<DeepPartial<T>> { }

type DeepPartialObject<T> = {
    [key in keyof T]?: DeepPartial<T[key]>;
};
