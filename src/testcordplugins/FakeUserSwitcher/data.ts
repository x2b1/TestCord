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

export const logger = new Logger("FakeUserSwitcherV3");

export interface CachedTarget {
    id: string;
    user: User;
    profile: any;
    fetchedAt: number;
}

let cached: CachedTarget | null = null;
const subscribers = new Set<() => void>();

export function notify() {
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

export function getSavedUsers(): { id: string; name: string; username?: string; avatar: string | null; }[] {
    try { return JSON.parse(settings.store.savedUsers || "[]"); } catch { return []; }
}

export function setSavedUsers(list: { id: string; name: string; username?: string; avatar: string | null; }[]) {
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
        hidden: true,
    },
    manualMode: {
        type: OptionType.BOOLEAN,
        description: "Use a custom username and avatar instead of cloning a user ID.",
        default: false,
        hidden: true,
    },
    manualUsername: {
        type: OptionType.STRING,
        description: "Custom username for manual mode.",
        default: "FakeUser",
        hidden: true,
    },
    manualAvatar: {
        type: OptionType.STRING,
        description: "Custom avatar URL for manual mode.",
        default: "",
        hidden: true,
    },
    manualBio: {
        type: OptionType.STRING,
        description: "Custom bio / About Me in manual mode.",
        default: "",
        hidden: true,
    },
    manualPronouns: {
        type: OptionType.STRING,
        description: "Custom pronouns in manual mode.",
        default: "",
        hidden: true,
    },
    manualBanner: {
        type: OptionType.STRING,
        description: "Custom banner image URL or solid color hex in manual mode.",
        default: "",
        hidden: true,
    },
    manualStatus: {
        type: OptionType.SELECT,
        description: "Spoofed status in manual mode.",
        default: "online",
        options: [
            { label: "Online", value: "online", default: true },
            { label: "Idle", value: "idle" },
            { label: "Do Not Disturb", value: "dnd" },
            { label: "Offline", value: "offline" }
        ],
        hidden: true,
    },
    manualActivityName: {
        type: OptionType.STRING,
        description: "Spoofed activity name in manual mode.",
        default: "",
        hidden: true,
    },
    manualActivityType: {
        type: OptionType.SELECT,
        description: "Spoofed activity type in manual mode.",
        default: 0,
        options: [
            { label: "Playing", value: 0, default: true },
            { label: "Streaming", value: 1 },
            { label: "Listening to", value: 2 },
            { label: "Watching", value: 3 },
            { label: "Custom Status", value: 4 },
            { label: "Competing in", value: 5 }
        ],
        hidden: true,
    },
    manualActivityState: {
        type: OptionType.STRING,
        description: "Spoofed activity state (e.g. In Match, Chilling).",
        default: "",
        hidden: true,
    },
    manualActivityDetails: {
        type: OptionType.STRING,
        description: "Spoofed activity details (e.g. Playing Solo, Level 42).",
        default: "",
        hidden: true,
    },
    uiMode: {
        type: OptionType.SELECT,
        description: "Which user profile spoofing UI mode to use.",
        default: "modern",
        options: [
            { label: "legacy", value: "legacy" },
            { label: "modern", value: "modern", default: true }
        ],
    },
    disableAnimations: {
        type: OptionType.BOOLEAN,
        description: "Disable all transitions and animations in the visual settings switcher.",
        default: false,
    },
    configExpanded: {
        type: OptionType.BOOLEAN,
        description: "Whether the configuration accordion is expanded.",
        default: true,
        hidden: true,
    },
    manualExpanded: {
        type: OptionType.BOOLEAN,
        description: "Whether the manual spoofing accordion is expanded.",
        default: false,
        hidden: true,
    },
});
