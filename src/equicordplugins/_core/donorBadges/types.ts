/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface DonorBadge {
    /** Discord user IDs that receive this badge */
    ids: readonly string[];
    /** tooltip shown on hover */
    name: string;
    /** badge image as a data URI (base64 PNG or inline SVG) */
    image: string;
    /** ring color behind the image */
    ring?: string;
}
