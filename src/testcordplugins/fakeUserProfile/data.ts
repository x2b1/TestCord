/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { fetchUserProfile } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { OptionType } from "@utils/types";
import type { User } from "@vencord/discord-types";
import { UserProfileStore, UserStore, UserUtils } from "@webpack/common";

export const logger = new Logger("FakeUserProfile");

export interface CachedTarget {
    id: string;
    user: User;
    profile: any;
    fetchedAt: number;
}

let cached: CachedTarget | null = null;
const subscribers = new Set<() => void>();

function notify() {
    for (const fn of subscribers) {
        try { fn(); } catch (e) { logger.error("subscriber failed", e); }
    }
}

export function subscribe(fn: () => void) {
    subscribers.add(fn);
    return () => { subscribers.delete(fn); };
}

export function getCachedTarget() {
    return cached;
}

export function clearTarget() {
    cached = null;
    settings.store.targetId = "";
    settings.store.enabled = false;
    notify();
}

export async function loadTarget(targetId: string): Promise<CachedTarget> {
    let user = UserStore.getUser(targetId);
    if (!user) {
        try {
            user = await UserUtils.getUser(targetId);
        } catch (e) {
            logger.error("Failed to fetch user", e);
            throw new Error("Could not load that user. Check the ID.");
        }
    }
    if (!user) throw new Error("Could not load that user. Check the ID.");

    let profile: any = null;
    try {
        profile = await fetchUserProfile(targetId, undefined, false);
    } catch (e) {
        logger.warn("Failed to fetch profile, falling back to user only", e);
        profile = UserProfileStore.getUserProfile(targetId);
    }

    cached = {
        id: targetId,
        user,
        profile,
        fetchedAt: Date.now(),
    };
    settings.store.targetId = targetId;
    notify();
    return cached;
}

export function isCurrentUser(userId: string | undefined): boolean {
    if (!userId) return false;
    const me = UserStore.getCurrentUser();
    return !!me && me.id === userId;
}

export function isActive(): boolean {
    return !!settings.store.enabled && !!cached;
}

export function setEnabled(value: boolean) {
    settings.store.enabled = value;
    notify();
}

export const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Whether the spoof is currently active.",
        default: false,
    },
    targetId: {
        type: OptionType.STRING,
        description: "User ID to impersonate visually.",
        default: "",
    },
    fakeMessages: {
        type: OptionType.BOOLEAN,
        description: "When sending a message, post a local fake one as the target user instead of really sending it.",
        default: true,
    },
    sendRealToo: {
        type: OptionType.BOOLEAN,
        description: "Also send the real message to the channel (in addition to the fake one). Off means client-side only.",
        default: false,
    },
    spoofBadges: {
        type: OptionType.BOOLEAN,
        description: "Mirror the target's badges onto your client-side profile.",
        default: true,
    },
    spoofActivities: {
        type: OptionType.BOOLEAN,
        description: "Mirror the target's connected accounts and game collection.",
        default: true,
    },
});
