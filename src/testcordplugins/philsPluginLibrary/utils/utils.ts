/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { UserStore } from "@webpack/common";
import { User } from "discord-types/general";

export const createDummyUser = (props: Partial<User>) => new (UserStore.getCurrentUser().constructor as any)(props);
export const openURL = (url: string) => VencordNative.native.openExternal(url);
export const validateNumberInput = (value: string) => parseInt(value) ? parseInt(value) : undefined;
export const validateTextInputNumber = (value: string) => /^[0-9\b]+$/.test(value) || value === "";
export const replaceObjectValuesIfExist =
    (target: Object, replace: Object) => Object.entries(target).forEach(([key, value]) => replace[key] && (target[key] = replace[key]));
