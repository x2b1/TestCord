/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { User } from "discord-types/general";
import type { ComponentType } from "react";

export interface UserSummaryItemProps {
    guildId?: string;
    className?: string;
    users?: User[];
    renderUser?: (...props: any[]) => any;
    renderMoreUsers?: (...props: any[]) => any;
    max?: number;
    showUserPopout?: boolean;
    renderIcon?: boolean;
    showDefaultAvatarsForNullUsers?: boolean;
    size?: number;
}

export type UserSummaryItem = ComponentType<UserSummaryItemProps>;
