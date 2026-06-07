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
import { UserProfileStore, UserStore, UserUtils, SnowflakeUtils } from "@webpack/common";

export const logger = new Logger("FakeUserProfile");

export const manualBadgeFlags = {
    DiscordStaff: 1 << 0,
    PartneredServerOwner: 1 << 1,
    HypeSquadEvents: 1 << 2,
    DiscordBugHunter: 1 << 3,
    HypeSquadBravery: 1 << 6,
    HypeSquadBrilliance: 1 << 7,
    HypeSquadBalance: 1 << 8,
    EarlySupporter: 1 << 9,
    GoldenDiscordBugHunter: 1 << 14,
    EarlyVerifiedBotDeveloper: 1 << 17,
    ModeratorProgramsAlumni: 1 << 18,
    ActiveDeveloper: 1 << 22,
} as const;

export interface ManualProfileData {
    id: string;
    username: string;
    globalName: string;
    discriminator: string;
    bio: string;
    pronouns: string;
    accentColor: string;
    accentColor2: string;
    avatarDataUrl: string;
    bannerDataUrl: string;
    avatarHash: string;
    bannerHash: string;
    publicFlags: number;
    premiumType: number;
    bot: boolean;
    nitroLevel: number;
    boostMonths: number;
    avatarDecoration: string;
    createdAt: string;
    email: string;
    phone: string;
    customBadgeIds: string[];
    oldName: string;
}

export interface CachedTarget {
    id: string;
    user: User;
    profile: any;
    fetchedAt: number;
    manual?: boolean;
    manualProfile?: ManualProfileData;
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

function makeDateForUser(userId: string, totalMonths: number): Date {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
    }
    const seed = Math.abs(hash);
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() - totalMonths, 1);
    const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(((seed % maxDay) + 1));
    return target;
}

function getDefaultManualProfile(): ManualProfileData {
    return {
        id: "",
        username: "",
        globalName: "",
        discriminator: "0",
        bio: "",
        pronouns: "",
        accentColor: "",
        accentColor2: "",
        avatarDataUrl: "",
        bannerDataUrl: "",
        avatarHash: "manual-avatar",
        bannerHash: "manual-banner",
        publicFlags: 0,
        premiumType: 0,
        bot: false,
        nitroLevel: -1,
        boostMonths: -1,
        avatarDecoration: "",
        createdAt: "",
        email: "",
        phone: "",
        customBadgeIds: [],
        oldName: "",
    };
}

export function getManualProfile(): ManualProfileData {
    return {
        ...getDefaultManualProfile(),
        ...(settings.store.manualProfile as Partial<ManualProfileData> | undefined),
    };
}

function createManualUser(profile: ManualProfileData): User {
    const me = UserStore.getCurrentUser();
    const id = profile.id || me?.id || "";
    const username = profile.username || me?.username || "unknown";
    const base = me && id === me.id ? me : (UserStore.getUser(id) || me);

    const user = {
        id,
        username: profile.username || (base as any)?.username || "unknown",
        globalName: profile.globalName || (base as any)?.globalName || null,
        discriminator: profile.discriminator || (base as any)?.discriminator || "0",
        avatar: profile.avatarDataUrl ? profile.avatarHash : ((base as any)?.avatar ?? null),
        banner: profile.bannerDataUrl ? profile.bannerHash : ((base as any)?.banner ?? null),
        publicFlags: profile.publicFlags || (base as any)?.publicFlags || 0,
        flags: profile.publicFlags || (base as any)?.flags || 0,
        premiumType: profile.premiumType || (base as any)?.premiumType || 0,
        accentColor: profile.accentColor ? Number(profile.accentColor) : ((base as any)?.accentColor ?? null),
        usernameNormalized: (profile.username || (base as any)?.username || "").toLowerCase(),
        bot: profile.bot || (base as any)?.bot || false,
        avatarDecorationData: profile.avatarDecoration
            ? { asset: profile.avatarDecoration, skuId: profile.avatarDecoration }
            : ((base as any)?.avatarDecorationData ?? undefined),
        createdAt: profile.createdAt
            ? new Date(profile.createdAt + "T12:00:00Z")
            : (base as any)?.createdAt ?? new Date(SnowflakeUtils.extractTimestamp(id)),
        premiumSince: profile.premiumType > 0
            ? makeDateForUser(id, [1, 2, 3, 6, 12, 24, 36, 72][profile.nitroLevel] ?? 1)
            : ((base as any)?.premiumSince ?? undefined),
        premiumGuildSince: profile.boostMonths >= 0
            ? makeDateForUser(id, [1, 2, 3, 6, 9, 12, 15, 18, 24][profile.boostMonths] ?? 1)
            : ((base as any)?.premiumGuildSince ?? undefined),
    } as unknown as User;

    return user;
}

function createManualTarget(profile: ManualProfileData): CachedTarget {
    const user = createManualUser(profile);
    const me = UserStore.getCurrentUser();
    const id = profile.id || me?.id || "";
    const realProfile = (UserProfileStore.getUserProfile(id) ?? {}) as any;

    const accentColor = profile.accentColor ? Number(profile.accentColor) : (realProfile.accentColor ?? null);
    const accentColor2 = profile.accentColor2 ? Number(profile.accentColor2) : null;
    const themeColors = accentColor != null ? (accentColor2 != null ? [accentColor, accentColor2] : [accentColor]) : undefined;

    const hasNitro = profile.premiumType > 0 || (realProfile.premiumType ?? 0) > 0;
    const nitroLevel = profile.nitroLevel;
    const NITRO_M = [1, 2, 3, 6, 12, 24, 36, 72];
    const premiumSince = hasNitro
        ? (profile.premiumType > 0 ? makeDateForUser(id, NITRO_M[nitroLevel] ?? 1) : (realProfile.premiumSince ?? null))
        : null;

    const BOOST_M = [1, 2, 3, 6, 9, 12, 15, 18, 24];
    const premiumGuildSince = profile.boostMonths >= 0
        ? makeDateForUser(id, BOOST_M[profile.boostMonths] ?? 1)
        : (realProfile.premiumGuildSince ?? null);

    return {
        id,
        user,
        profile: {
            userId: id,
            bio: profile.bio || realProfile.bio || null,
            pronouns: profile.pronouns || realProfile.pronouns || null,
            accentColor,
            themeColors,
            banner: profile.bannerDataUrl ? profile.bannerHash : (realProfile.banner ?? (user as any).banner ?? null),
            premiumType: profile.premiumType || realProfile.premiumType || 0,
            premiumSince,
            premiumGuildSince,
            publicFlags: profile.publicFlags || (user as any).publicFlags || 0,
            badges: realProfile.badges ?? [],
            userProfile: {
                displayName: profile.globalName || (user as any).globalName || (user as any).username,
                bio: profile.bio || realProfile.bio || null,
                pronouns: profile.pronouns || realProfile.pronouns || null,
            },
        },
        fetchedAt: Date.now(),
        manual: true,
        manualProfile: profile,
    };
}

export function saveManualProfile(profile: ManualProfileData): CachedTarget {
    settings.store.manualProfile = profile;
    settings.store.targetMode = "manual";
    cached = createManualTarget(profile);
    settings.store.targetId = profile.id;
    notify();
    return cached;
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

    // fetchUserProfile dispatches USER_UPDATE which replaces the User instance in UserStore.
    // Re-fetch so we capture banner / accent_color / primaryGuild that just got populated.
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

export function restoreStoredTarget(): CachedTarget | null {
    if (settings.store.targetMode === "manual") {
        const profile = getManualProfile();
        if (!profile.id || !profile.username) return null;
        cached = createManualTarget(profile);
        return cached;
    }

    return null;
}

export function isCurrentUser(userId: string | undefined): boolean {
    if (!userId) return false;
    const me = UserStore.getCurrentUser();
    return !!me && me.id === userId;
}

export function isActive(): boolean {
    return !!settings.store.spoofActive && !!cached;
}

export function setEnabled(value: boolean) {
    settings.store.spoofActive = value;
    notify();
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
    targetMode: {
        type: OptionType.SELECT,
        description: "Whether to spoof a fetched Discord user or a fully manual profile.",
        options: [
            { label: "Lookup user", value: "lookup", default: true },
            { label: "Manual profile", value: "manual" },
        ],
    },
    manualProfile: {
        type: OptionType.COMPONENT,
        hidden: true,
        default: getDefaultManualProfile(),
        component: () => null,
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
