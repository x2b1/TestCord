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

export const logger = new Logger("FakeUserSwitcher");

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
    settings.store.spoofActive = false;
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

    user = UserStore.getUser(targetId) ?? user;

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
    if (settings.store.manualMode) return !!settings.store.spoofActive;
    return !!settings.store.spoofActive && !!cached;
}

export function setEnabled(value: boolean) {
    settings.store.spoofActive = value;
    notify();
}

export function getSavedUsers(): { id: string; name: string; avatar: string | null; }[] {
    try { return JSON.parse(settings.store.savedUsers || "[]"); } catch { return []; }
}
export function setSavedUsers(list: { id: string; name: string; avatar: string | null; }[]) {
    settings.store.savedUsers = JSON.stringify(list);
}

export const settings = definePluginSettings({
    spoofActive: {
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
    savedUsers: {
        type: OptionType.STRING,
        description: "Saved user IDs (JSON)",
        default: "[]",
        hidden: true
    },
    manualMode: {
        type: OptionType.BOOLEAN,
        description: "Use a custom username and avatar instead of cloning a user ID.",
        default: false,
        hidden: true
    },
    manualUsername: {
        type: OptionType.STRING,
        description: "Custom username for manual mode.",
        default: "FakeUser",
        hidden: true
    },
    manualAvatar: {
        type: OptionType.STRING,
        description: "Custom avatar URL for manual mode.",
        default: "",
        hidden: true
    },
});
