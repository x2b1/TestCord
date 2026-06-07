/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addProfileBadge, BadgePosition, type ProfileBadge, removeProfileBadge } from "@api/Badges";
import { UserAreaButton, UserAreaRenderProps } from "@api/UserArea";
import BadgeAPIPlugin from "@plugins/_api/badges";
import { TestcordDevs } from "@utils/constants";
import { openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import type { User } from "@vencord/discord-types";
import { FluxDispatcher, IconUtils, PresenceStore, React, SnowflakeUtils, UsernameUtils, UserStore } from "@webpack/common";

import { getCachedTarget, getManualProfile, isActive, isCurrentUser, loadTarget, logger, restoreStoredTarget, setEnabled, settings, subscribe } from "./data";
import { FakeUserProfileModal } from "./modal";

const FLAG_BADGES: { flag: number; image: string; description: string; }[] = [
    { flag: 1 << 0, image: "https://cdn.discordapp.com/badge-icons/5e74e9b61934fc1f67c65515d1f7e60d.png", description: "Discord Staff" },
    { flag: 1 << 1, image: "https://cdn.discordapp.com/badge-icons/3f9748e53446a137a052f3454e2de41e.png", description: "Partnered Server Owner" },
    { flag: 1 << 2, image: "https://cdn.discordapp.com/badge-icons/bf01d1073931f921909045f3a39fd264.png", description: "HypeSquad Events" },
    { flag: 1 << 3, image: "https://cdn.discordapp.com/badge-icons/2717692c7dca7289b35297368a940dd0.png", description: "Discord Bug Hunter" },
    { flag: 1 << 6, image: "https://cdn.discordapp.com/badge-icons/8a88d63823d8a71cd5e390baa45efa02.png", description: "HypeSquad Bravery" },
    { flag: 1 << 7, image: "https://cdn.discordapp.com/badge-icons/011940fd013da3f7fb926e4a1cd2e618.png", description: "HypeSquad Brilliance" },
    { flag: 1 << 8, image: "https://cdn.discordapp.com/badge-icons/3aa41de486fa12454c3761e8e223442e.png", description: "HypeSquad Balance" },
    { flag: 1 << 9, image: "https://cdn.discordapp.com/badge-icons/7060786766c9c840eb3019e725d2b358.png", description: "Early Supporter" },
    { flag: 1 << 14, image: "https://cdn.discordapp.com/badge-icons/848f79194d4be5ff5f81505cbd0ce1e6.png", description: "Golden Discord Bug Hunter" },
    { flag: 1 << 17, image: "https://cdn.discordapp.com/badge-icons/6df5892e0f35b051f8b61eace34f4967.png", description: "Early Verified Bot Developer" },
    { flag: 1 << 18, image: "https://cdn.discordapp.com/badge-icons/fee1624003e2fee35cb398e125dc479b.png", description: "Moderator Programs Alumni" },
    { flag: 1 << 22, image: "https://cdn.discordapp.com/badge-icons/6bdc42827a38498929a4920da12695d9.png", description: "Active Developer" },
];

const SNOWFLAKE_EPOCH = 1420070400000n;
function makeSnowflake(): string {
    return ((BigInt(Date.now()) - SNOWFLAKE_EPOCH) << 22n).toString();
}

function getTargetUser(): User | null {
    const t = getCachedTarget();
    if (!t) return null;
    return t.user;
}

function getTargetProfile(): any {
    const t = getCachedTarget();
    if (!t) return null;
    return t.profile;
}

function getManualAvatarDataUrl(): string | null {
    const target = getCachedTarget();
    if (!target?.manual) return null;
    return target.manualProfile?.avatarDataUrl || getManualProfile().avatarDataUrl || null;
}

function getManualBannerDataUrl(): string | null {
    const target = getCachedTarget();
    if (!target?.manual) return null;
    return target.manualProfile?.bannerDataUrl || getManualProfile().bannerDataUrl || null;
}

function buildOverrides(target: any): Record<string, unknown> {
    const profile = getTargetProfile();
    const banner = target.banner ?? profile?.banner ?? null;
    const overrides: Record<string, unknown> = {
        username: target.username,
        globalName: target.globalName,
        discriminator: target.discriminator,
        avatar: target.avatar,
        banner,
        publicFlags: target.publicFlags ?? target.flags ?? 0,
        flags: target.flags ?? 0,
        premiumType: target.premiumType ?? 0,
        premiumSince: target.premiumSince ?? profile?.premiumSince ?? null,
        premiumGuildSince: target.premiumGuildSince ?? profile?.premiumGuildSince ?? null,
        accentColor: target.accentColor ?? profile?.accentColor ?? null,
        usernameNormalized: typeof target.username === "string" ? target.username.toLowerCase() : undefined,
        bot: target.bot ?? false,
    };
    if (target.primaryGuild !== undefined) overrides.primaryGuild = target.primaryGuild;
    if (target.avatarDecorationData !== undefined) overrides.avatarDecorationData = target.avatarDecorationData;
    if (target.clan !== undefined) overrides.clan = target.clan;
    if (target.collectibles !== undefined) overrides.collectibles = target.collectibles;
    if (target.displayNameStyles !== undefined) overrides.displayNameStyles = target.displayNameStyles;
    if (target.createdAt !== undefined) overrides.createdAt = target.createdAt;
    overrides.tag = `${target.username}${target.discriminator && target.discriminator !== "0" ? `#${target.discriminator}` : ""}`;
    return overrides;
}

function mergeUser(base: any, overrides: Record<string, unknown>): any {
    const wrap = Object.create(Object.getPrototypeOf(base));
    for (const key of Object.getOwnPropertyNames(base)) {
        const desc = Object.getOwnPropertyDescriptor(base, key);
        if (desc) {
            try {
                Object.defineProperty(wrap, key, desc);
            } catch { /* ignore */ }
        }
    }
    for (const sym of Object.getOwnPropertySymbols(base)) {
        const desc = Object.getOwnPropertyDescriptor(base, sym);
        if (desc) {
            try {
                Object.defineProperty(wrap, sym, desc);
            } catch { /* ignore */ }
        }
    }
    for (const key of Object.keys(overrides)) {
        try {
            Object.defineProperty(wrap, key, {
                value: overrides[key],
                writable: true,
                enumerable: true,
                configurable: true,
            });
        } catch { /* ignore */ }
    }
    return wrap;
}

let cachedWrap: { base: any; target: any; wrap: any; } | null = null;

function wrapUser(base: any): any {
    const target = getTargetUser();
    if (!base || !target || !isActive()) return base;
    if (cachedWrap && cachedWrap.base === base && cachedWrap.target === target) return cachedWrap.wrap;
    const wrap = mergeUser(base, buildOverrides(target));
    try {
        const manual = getCachedTarget()?.manualProfile;
        const createdAt = manual?.createdAt
            ? new Date(manual.createdAt + "T12:00:00Z")
            : new Date(SnowflakeUtils.extractTimestamp(target.id));
        Object.defineProperty(wrap, "createdAt", {
            get() { return createdAt; },
            enumerable: true,
            configurable: true,
        });
    } catch { /* ignore */ }
    cachedWrap = { base, target, wrap };
    return wrap;
}

function clearWrapCache() {
    cachedWrap = null;
}

let originalGetUser: typeof UserStore.getUser | null = null;
let originalGetCurrentUser: typeof UserStore.getCurrentUser | null = null;
let originalGetUserAvatarURL: typeof IconUtils.getUserAvatarURL | null = null;
let originalGetUserBannerURL: typeof IconUtils.getUserBannerURL | null = null;
let originalGetName: typeof UsernameUtils.getName | null = null;
let originalGetGlobalName: typeof UsernameUtils.getGlobalName | null = null;
let originalGetFormattedName: typeof UsernameUtils.getFormattedName | null = null;
let originalGetUserTag: typeof UsernameUtils.getUserTag | null = null;
let originalUseName: typeof UsernameUtils.useName | null = null;
let originalUseUserTag: typeof UsernameUtils.useUserTag | null = null;
let originalGetStatus: typeof PresenceStore.getStatus | null = null;
let originalGetClientStatus: typeof PresenceStore.getClientStatus | null = null;
let originalGetActivities: typeof PresenceStore.getActivities | null = null;
let originalGetPrimaryActivity: typeof PresenceStore.getPrimaryActivity | null = null;
let originalGetUnfilteredActivities: typeof PresenceStore.getUnfilteredActivities | null = null;
let originalFindActivity: typeof PresenceStore.findActivity | null = null;
let originalGetApplicationActivity: typeof PresenceStore.getApplicationActivity | null = null;

let storePatched = false;
let utilsPatched = false;
let presencePatched = false;

function patchStore() {
    if (storePatched) return;
    storePatched = true;

    originalGetUser = UserStore.getUser;
    originalGetCurrentUser = UserStore.getCurrentUser;

    UserStore.getUser = function (userId: string) {
        const u = originalGetUser!.call(this, userId);
        if (!isActive() || !u) return u;
        if (!isCurrentUser(userId)) return u;
        return wrapUser(u);
    };

    UserStore.getCurrentUser = function () {
        const u = originalGetCurrentUser!.call(this);
        if (!isActive()) return u;
        return wrapUser(u);
    };
}

function unpatchStore() {
    if (!storePatched) return;
    if (originalGetUser) UserStore.getUser = originalGetUser;
    if (originalGetCurrentUser) UserStore.getCurrentUser = originalGetCurrentUser;
    storePatched = false;
}

function patchUtils() {
    if (utilsPatched) return;
    utilsPatched = true;

    originalGetUserAvatarURL = IconUtils.getUserAvatarURL;
    originalGetUserBannerURL = IconUtils.getUserBannerURL;
    originalGetName = UsernameUtils.getName;
    originalGetGlobalName = UsernameUtils.getGlobalName;
    originalGetFormattedName = UsernameUtils.getFormattedName;
    originalGetUserTag = UsernameUtils.getUserTag;
    originalUseName = UsernameUtils.useName;
    originalUseUserTag = UsernameUtils.useUserTag;

    IconUtils.getUserAvatarURL = function (user: any, animated?: any, size?: any, format?: any) {
        if (isActive() && user && isCurrentUser(user.id)) {
            const manualAvatar = getManualAvatarDataUrl();
            if (manualAvatar) return manualAvatar;
            const t = getTargetUser();
            if (t) return originalGetUserAvatarURL!.call(this, t, animated, size, format);
        }
        return originalGetUserAvatarURL!.call(this, user, animated, size, format);
    };

    IconUtils.getUserBannerURL = function (params: any) {
        if (isActive() && params && isCurrentUser(params.id)) {
            const manualBanner = getManualBannerDataUrl();
            if (manualBanner) return manualBanner;
            const t = getTargetUser() as any;
            const targetBanner = params.banner ?? t?.banner ?? getTargetProfile()?.banner;
            if (t && targetBanner) {
                return originalGetUserBannerURL!.call(this, { ...params, id: t.id, banner: targetBanner });
            }
        }
        return originalGetUserBannerURL!.call(this, params);
    };

    UsernameUtils.getName = function (user: User) {
        if (isActive() && user && isCurrentUser(user.id)) {
            const t = getTargetUser();
            if (t) return originalGetName!.call(this, t);
        }
        return originalGetName!.call(this, user);
    };

    UsernameUtils.getGlobalName = function (user: User) {
        if (isActive() && user && isCurrentUser(user.id)) {
            const t = getTargetUser();
            if (t) return originalGetGlobalName!.call(this, t);
        }
        return originalGetGlobalName!.call(this, user);
    };

    UsernameUtils.getFormattedName = function (user: User, useTag?: boolean) {
        if (isActive() && user && isCurrentUser(user.id)) {
            const t = getTargetUser();
            if (t) return originalGetFormattedName!.call(this, t, useTag);
        }
        return originalGetFormattedName!.call(this, user, useTag);
    };

    UsernameUtils.getUserTag = function (user: User, options?: any) {
        if (isActive() && user && isCurrentUser(user.id)) {
            const t = getTargetUser();
            if (t) return originalGetUserTag!.call(this, t, options);
        }
        return originalGetUserTag!.call(this, user, options);
    };

    UsernameUtils.useName = function (user: User) {
        if (isActive() && user && isCurrentUser(user.id)) {
            const t = getTargetUser();
            if (t) return originalUseName!.call(this, t);
        }
        return originalUseName!.call(this, user);
    };

    UsernameUtils.useUserTag = function (user: User, options?: any) {
        if (isActive() && user && isCurrentUser(user.id)) {
            const t = getTargetUser();
            if (t) return originalUseUserTag!.call(this, t, options);
        }
        return originalUseUserTag!.call(this, user, options);
    };
}

function unpatchUtils() {
    if (!utilsPatched) return;
    if (originalGetUserAvatarURL) IconUtils.getUserAvatarURL = originalGetUserAvatarURL;
    if (originalGetUserBannerURL) IconUtils.getUserBannerURL = originalGetUserBannerURL;
    if (originalGetName) UsernameUtils.getName = originalGetName;
    if (originalGetGlobalName) UsernameUtils.getGlobalName = originalGetGlobalName;
    if (originalGetFormattedName) UsernameUtils.getFormattedName = originalGetFormattedName;
    if (originalGetUserTag) UsernameUtils.getUserTag = originalGetUserTag;
    if (originalUseName) UsernameUtils.useName = originalUseName;
    if (originalUseUserTag) UsernameUtils.useUserTag = originalUseUserTag;
    utilsPatched = false;
}

function patchPresence() {
    if (presencePatched) return;
    presencePatched = true;

    originalGetStatus = PresenceStore.getStatus;
    originalGetClientStatus = PresenceStore.getClientStatus;
    originalGetActivities = PresenceStore.getActivities;
    originalGetPrimaryActivity = PresenceStore.getPrimaryActivity;
    originalGetUnfilteredActivities = PresenceStore.getUnfilteredActivities;
    originalFindActivity = PresenceStore.findActivity;
    originalGetApplicationActivity = PresenceStore.getApplicationActivity;

    PresenceStore.getStatus = function (userId: string, guildId?: string | null, defaultStatus?: any): any {
        if (isActive() && isCurrentUser(userId)) {
            const target = getTargetUser();
            if (target) return originalGetStatus!.call(this, target.id, guildId, defaultStatus);
        }
        return originalGetStatus!.call(this, userId, guildId, defaultStatus);
    };

    PresenceStore.getClientStatus = function (userId: string): any {
        if (isActive() && isCurrentUser(userId)) {
            const target = getTargetUser();
            if (target) return originalGetClientStatus!.call(this, target.id);
        }
        return originalGetClientStatus!.call(this, userId);
    };

    PresenceStore.getActivities = function (userId: string, guildId?: string): any {
        if (isActive() && isCurrentUser(userId) && settings.store.spoofActivities) {
            const target = getTargetUser();
            if (target) return originalGetActivities!.call(this, target.id, guildId);
        }
        return originalGetActivities!.call(this, userId, guildId);
    };

    PresenceStore.getPrimaryActivity = function (userId: string, guildId?: string): any {
        if (isActive() && isCurrentUser(userId) && settings.store.spoofActivities) {
            const target = getTargetUser();
            if (target) return originalGetPrimaryActivity!.call(this, target.id, guildId);
        }
        return originalGetPrimaryActivity!.call(this, userId, guildId);
    };

    PresenceStore.getUnfilteredActivities = function (userId: string, guildId?: string): any {
        if (isActive() && isCurrentUser(userId) && settings.store.spoofActivities) {
            const target = getTargetUser();
            if (target) return originalGetUnfilteredActivities!.call(this, target.id, guildId);
        }
        return originalGetUnfilteredActivities!.call(this, userId, guildId);
    };

    PresenceStore.findActivity = function (userId: string, predicate: any, guildId?: string): any {
        if (isActive() && isCurrentUser(userId) && settings.store.spoofActivities) {
            const target = getTargetUser();
            if (target) return originalFindActivity!.call(this, target.id, predicate, guildId);
        }
        return originalFindActivity!.call(this, userId, predicate, guildId);
    };

    PresenceStore.getApplicationActivity = function (userId: string, applicationId: string, guildId?: string): any {
        if (isActive() && isCurrentUser(userId) && settings.store.spoofActivities) {
            const target = getTargetUser();
            if (target) return originalGetApplicationActivity!.call(this, target.id, applicationId, guildId);
        }
        return originalGetApplicationActivity!.call(this, userId, applicationId, guildId);
    };
}

function unpatchPresence() {
    if (!presencePatched) return;
    if (originalGetStatus) PresenceStore.getStatus = originalGetStatus;
    if (originalGetClientStatus) PresenceStore.getClientStatus = originalGetClientStatus;
    if (originalGetActivities) PresenceStore.getActivities = originalGetActivities;
    if (originalGetPrimaryActivity) PresenceStore.getPrimaryActivity = originalGetPrimaryActivity;
    if (originalGetUnfilteredActivities) PresenceStore.getUnfilteredActivities = originalGetUnfilteredActivities;
    if (originalFindActivity) PresenceStore.findActivity = originalFindActivity;
    if (originalGetApplicationActivity) PresenceStore.getApplicationActivity = originalGetApplicationActivity;
    presencePatched = false;
}

// Redirect custom Testcord badges (managed by /badge, NOT the hardcoded admin/owner/dev/contributor
// ones — those have their own shouldShow() against fixed user-id lists, so they remain unspoofable).
let originalGetTestcordCustomBadges: any = null;
let badgesPatched = false;

function patchBadges() {
    if (badgesPatched) return;
    if (typeof BadgeAPIPlugin?.getTestCordCustomBadges !== "function") return;
    badgesPatched = true;
    originalGetTestcordCustomBadges = BadgeAPIPlugin.getTestCordCustomBadges.bind(BadgeAPIPlugin);
    BadgeAPIPlugin.getTestCordCustomBadges = function (userId: string) {
        if (settings.store.spoofBadges && isActive() && isCurrentUser(userId)) {
            const target = getTargetUser();
            if (target) return originalGetTestcordCustomBadges(target.id);
        }
        return originalGetTestcordCustomBadges(userId);
    };
}

function unpatchBadges() {
    if (!badgesPatched) return;
    if (originalGetTestcordCustomBadges) BadgeAPIPlugin.getTestCordCustomBadges = originalGetTestcordCustomBadges;
    badgesPatched = false;
}

function notifyUpdate() {
    clearWrapCache();
    const me = originalGetCurrentUser ? originalGetCurrentUser.call(UserStore) : UserStore.getCurrentUser();
    if (!me) return;
    try {
        FluxDispatcher.dispatch({ type: "USER_UPDATE", user: me });
    } catch (e) {
        logger.warn("USER_UPDATE dispatch failed", e);
    }
}

function syncSpoofState() {
    clearWrapCache();
    notifyUpdate();
}

function FakeUserProfileIcon({ className, style }: { className?: string; style?: React.CSSProperties; }) {
    return (
        <svg className={className} style={style} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.24-8 5v2h16v-2c0-2.76-3.58-5-8-5Zm5.5-3.5 2.3 2.3a1 1 0 0 1-1.42 1.42L16.08 12l-2.3 2.3a1 1 0 1 1-1.42-1.42l2.3-2.3-2.3-2.3a1 1 0 0 1 1.42-1.42l2.3 2.3 2.3-2.3a1 1 0 0 1 1.42 1.42L17.5 10.5Z" />
        </svg>
    );
}

function FakeUserProfileButton({ iconForeground, hideTooltips, nameplate }: UserAreaRenderProps) {
    const [, force] = React.useReducer(x => x + 1, 0);
    React.useEffect(() => subscribe(() => force()), []);

    const target = getCachedTarget();
    const active = isActive();

    const tooltip = hideTooltips
        ? undefined
        : target
            ? (active ? `Spoofing as ${target.user.username} — click to manage` : `Click to spoof as ${target.user.username}`)
            : "Fake User Profile";

    return (
        <UserAreaButton
            tooltipText={tooltip}
            icon={<FakeUserProfileIcon className={iconForeground} />}
            role="button"
            plated={nameplate != null}
            redGlow={active}
            onClick={() => openModal(modalProps => <FakeUserProfileModal modalProps={modalProps as any} />)}
            onContextMenu={() => {
                if (!target) {
                    openModal(modalProps => <FakeUserProfileModal modalProps={modalProps as any} />);
                    return;
                }
                setEnabled(!settings.store.spoofActive);
                force();
            }}
        />
    );
}

const dynamicBadge: ProfileBadge = {
    id: "fakeUserProfile-target",
    description: "Fake User Profile",
    position: BadgePosition.END,
    shouldShow: ({ userId }) => settings.store.spoofBadges && isActive() && isCurrentUser(userId),
    getBadges: () => {
        const target = getTargetUser();
        const manual = getCachedTarget()?.manualProfile;
        if (!target) return [];

        const flags = (target as any).publicFlags ?? (target as any).flags ?? 0;
        const badges: ProfileBadge[] = [];

        for (const fb of FLAG_BADGES) {
            if ((flags & fb.flag) === fb.flag) {
                badges.push({
                    id: `fakeUserProfile-flag-${fb.flag}`,
                    description: fb.description,
                    iconSrc: fb.image,
                    position: BadgePosition.END,
                });
            }
        }

        const premium = (target as any).premiumType ?? 0;
        if (premium >= 1) {
            const NITRO_ICONS = [
                "https://cdn.discordapp.com/badge-icons/2ba85e8026a8614b640c2837bcdfe21b.png",
                "https://cdn.discordapp.com/badge-icons/4f33c4a9c64ce221936bd256c356f91f.png",
                "https://cdn.discordapp.com/badge-icons/4514fab914bdbfb4ad2fa23df76121a6.png",
                "https://cdn.discordapp.com/badge-icons/2895086c18d5531d499862e41d1155a6.png",
                "https://cdn.discordapp.com/badge-icons/0334688279c8359120922938dcb1d6f8.png",
                "https://cdn.discordapp.com/badge-icons/0d61871f72bb9a33a7ae568c1fb4f20a.png",
                "https://cdn.discordapp.com/badge-icons/11e2d339068b55d3a506cff34d3780f3.png",
                "https://cdn.discordapp.com/badge-icons/cd5e2cfd9d7f27a8cdcd3e8a8d5dc9f4.png",
                "https://cdn.discordapp.com/badge-icons/5b154df19c53dce2af92c9b61e6be5e2.png",
            ];
            const NITRO_TIER_NAMES = ["", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Emerald", "Ruby", "Opal"];
            const nitroLevel = manual?.nitroLevel ?? -1;
            const icon = nitroLevel >= 0 && nitroLevel < NITRO_ICONS.length ? NITRO_ICONS[nitroLevel] : NITRO_ICONS[0];
            const tierName = nitroLevel >= 0 && nitroLevel < NITRO_TIER_NAMES.length ? NITRO_TIER_NAMES[nitroLevel] : "";
            const description = tierName ? `Nitro ${tierName}` : "Discord Nitro";
            badges.push({
                id: "fakeUserProfile-nitro",
                description,
                iconSrc: icon,
                position: BadgePosition.END,
            });
        }

        // Boost badge
        const boostMonths = manual?.boostMonths ?? -1;
        if (boostMonths >= 0) {
            const BOOST_ICONS = [
                "https://cdn.discordapp.com/badge-icons/51040c70d4f20a921ad6674ff86fc95c.png",
                "https://cdn.discordapp.com/badge-icons/0e4080d1d333bc7ad29ef6528b6f2fb7.png",
                "https://cdn.discordapp.com/badge-icons/72bed924410c304dbe3d00a6e593ff59.png",
                "https://cdn.discordapp.com/badge-icons/df199d2050d3ed4ebf84d64ae83989f8.png",
                "https://cdn.discordapp.com/badge-icons/996b3e870e8a22ce519b3a50e6bdd52f.png",
                "https://cdn.discordapp.com/badge-icons/991c9f39ee33d7537d9f408c3e53141e.png",
                "https://cdn.discordapp.com/badge-icons/cb3ae83c15e970e8f3d410bc62cb8b99.png",
                "https://cdn.discordapp.com/badge-icons/7142225d31238f6387d9f09efaa02759.png",
                "https://cdn.discordapp.com/badge-icons/ec92202290b48d0879b7413d2dde3bab.png",
            ];
            if (boostMonths < BOOST_ICONS.length) {
                const BOOST_M = [1, 2, 3, 6, 9, 12, 15, 18, 24];
                const userId = target.id;
                let hash = 0;
                for (let i = 0; i < userId.length; i++) {
                    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
                }
                const seed = Math.abs(hash);
                const now = new Date();
                const boostDate = new Date(now.getFullYear(), now.getMonth() - (BOOST_M[boostMonths] ?? 1), 1);
                const maxDay = new Date(boostDate.getFullYear(), boostDate.getMonth() + 1, 0).getDate();
                boostDate.setDate(((seed % maxDay) + 1));
                const dateStr = `${boostDate.getMonth() + 1}/${boostDate.getDate()}/${String(boostDate.getFullYear()).slice(-2)}`;
                badges.push({
                    id: "fakeUserProfile-boost",
                    description: `Server Booster\nServer boosting since ${dateStr}`,
                    iconSrc: BOOST_ICONS[boostMonths],
                    position: BadgePosition.END,
                });
            }
        }

        // Custom badges (quest, orbs, oldname)
        if (manual?.customBadgeIds) {
            if (manual.customBadgeIds.includes("quest")) {
                badges.push({
                    id: "fakeUserProfile-quest",
                    description: "Completed a quest",
                    iconSrc: "https://cdn.discordapp.com/badge-icons/7d9ae358c8c5e118768335dbe68b4fb8.png",
                    position: BadgePosition.END,
                });
            }
            if (manual.customBadgeIds.includes("orbs")) {
                badges.push({
                    id: "fakeUserProfile-orbs",
                    description: "Orbs — Apprentice",
                    iconSrc: "https://cdn.discordapp.com/badge-icons/83d8a1eb09a8d64e59233eec5d4d5c2d.png",
                    position: BadgePosition.END,
                });
            }
            if (manual.customBadgeIds.includes("oldname")) {
                const OLD_NAME_ICON = "https://cdn.discordapp.com/badge-icons/6de6d34650760ba5551a79732e98ed60.png";
                const oldNameText = manual.oldName ? `Old username\u00a0: ${manual.oldName}` : "Old username";
                badges.push({
                    id: "fakeUserProfile-oldname",
                    description: oldNameText,
                    iconSrc: OLD_NAME_ICON,
                    position: BadgePosition.END,
                });
            }
        }

        return badges;
    },
};

function buildFakeMessage(channelId: string, content: string, replyMessageReference: any) {
    const target = getCachedTarget();
    if (!target) return null;

    const u = target.user as any;
    const id = makeSnowflake();

    return {
        type: "MESSAGE_CREATE" as const,
        channelId,
        message: {
            attachments: [],
            author: {
                id: u.id,
                username: u.username,
                avatar: u.avatar,
                discriminator: u.discriminator,
                public_flags: u.publicFlags ?? u.flags ?? 0,
                premium_type: u.premiumType ?? 0,
                flags: u.flags ?? 0,
                banner: u.banner,
                accent_color: u.accentColor ?? null,
                global_name: u.globalName ?? null,
                avatar_decoration_data: u.avatarDecorationData
                    ? { asset: u.avatarDecorationData.asset, sku_id: u.avatarDecorationData.skuId }
                    : null,
                banner_color: null,
                bot: u.bot ?? false,
            },
            channel_id: channelId,
            components: [],
            content,
            edited_timestamp: null,
            embeds: [],
            flags: 0,
            id,
            mention_everyone: false,
            mention_roles: [],
            mentions: [],
            nonce: id,
            pinned: false,
            timestamp: new Date().toISOString(),
            tts: false,
            type: replyMessageReference ? 19 : 0,
            message_reference: replyMessageReference ?? undefined,
        },
        optimistic: false,
        isPushNotification: false,
    };
}

let unsub: (() => void) | null = null;

export default definePlugin({
    name: "fakeUserProfile",
    description: "Click a user area button to visually spoof your client as another Discord user. Avatar, banner, badges, bio, pronouns, decorations, activities, and outgoing messages all appear as them locally.",
    tags: ["Customisation", "Privacy", "Fun"],
    authors: [TestcordDevs.x2b],
    dependencies: ["UserAreaAPI", "BadgeAPI", "MessageEventsAPI"],

    settings,

    userAreaButton: {
        icon: FakeUserProfileIcon,
        render: (props: UserAreaRenderProps) => <FakeUserProfileButton {...props} />,
    },

    async start() {
        addProfileBadge(dynamicBadge);
        patchStore();
        patchUtils();
        patchBadges();
        patchPresence();

        unsub = subscribe(syncSpoofState);

        const { targetId } = settings.store;
        if (restoreStoredTarget()) {
            if (settings.store.spoofActive) syncSpoofState();
            return;
        }

        if (targetId) {
            try {
                await loadTarget(targetId);
                if (settings.store.spoofActive) syncSpoofState();
            } catch (e) {
                logger.warn("Failed to restore cached target", e);
            }
        }
    },

    stop() {
        clearWrapCache();
        unpatchPresence();
        unpatchBadges();
        unpatchUtils();
        unpatchStore();
        removeProfileBadge(dynamicBadge);
        if (unsub) { unsub(); unsub = null; }
        notifyUpdate();
    },

    flux: {
        CONNECTION_OPEN() {
            if (settings.store.spoofActive && getCachedTarget()) {
                syncSpoofState();
            }
        },
    },

    patches: [
        {
            find: ",getUserTag:",
            replacement: {
                match: /if\(\i\((\i)\.global_name\)\)return(?=.{0,100}return"\?\?\?")/,
                replace: "const vcFupName=$self.getUsername($1);if(vcFupName)return vcFupName;$&"
            }
        },
        {
            find: "getUserAvatarURL:",
            replacement: {
                match: /(getUserAvatarURL:)(\i),/,
                replace: "$1$self.wrapAvatar($2),"
            }
        },
        {
            find: "getAvatarDecorationURL:",
            replacement: {
                match: /(?<=function \i\(\i\){)(?=let{avatarDecoration)/,
                replace: "const vcFupDeco=$self.getAvatarDecorationURL(arguments[0]);if(vcFupDeco)return vcFupDeco;"
            }
        },
        {
            find: "UserProfileStore",
            replacement: {
                match: /(?<=getUserProfile\(\i\){return )(.+?)(?=})/,
                replace: "$self.profileHook(arguments[0],$1)"
            }
        },
        {
            find: ".banner)==null",
            replacement: {
                match: /(?<=void 0:)\i\.getPreviewBanner\(\i,\i,\i\)/,
                replace: "($self.bannerHook(arguments[0])??($&))"
            }
        },
        {
            find: ":\"SHOULD_LOAD\");",
            replacement: {
                match: /\i(?:\?)?\.getPreviewBanner\(\i,\i,\i\)(?=.{0,100}"COMPLETE")/,
                replace: "($self.bannerHook(arguments[0])??($&))"
            }
        },
    ],

    getUsername(user: User) {
        if (!isActive() || !isCurrentUser(user?.id)) return undefined;
        const t = getTargetUser();
        if (!t) return undefined;
        return t.globalName || t.username;
    },

    wrapAvatar(original: any) {
        return (user: User, animated: boolean, size: number) => {
            if (isActive() && isCurrentUser(user?.id)) {
                const t = getTargetUser();
                if (t) return original(t, animated, size);
            }
            return original(user, animated, size);
        };
    },

    getAvatarDecorationURL({ user, canAnimate }: { user?: User; avatarDecoration?: any; canAnimate?: boolean; }) {
        if (!isActive()) return undefined;
        const targetUserId = user?.id;
        if (!isCurrentUser(targetUserId)) return undefined;
        const t = getTargetUser() as any;
        const deco = t?.avatarDecorationData;
        if (!deco?.asset) return undefined;
        const asset = canAnimate && deco.asset.startsWith("a_") ? deco.asset : deco.asset.replace(/^a_/, "");
        return `https://cdn.discordapp.com/avatar-decoration-presets/${asset}.png${canAnimate && deco.asset.startsWith("a_") ? "" : "?passthrough=false"}`;
    },

    profileHook(userId: string, original: any) {
        if (!isActive() || !isCurrentUser(userId)) return original;
        const targetProfile = getTargetProfile();
        const target = getTargetUser();
        if (!targetProfile || !target) return original;
        const manual = getCachedTarget()?.manualProfile;

        const overrides: any = {};
        if (targetProfile.bio != null) overrides.bio = targetProfile.bio;
        if (targetProfile.pronouns != null) overrides.pronouns = targetProfile.pronouns;
        if (targetProfile.themeColors) overrides.themeColors = targetProfile.themeColors;
        // Always override banner / accentColor so a target without one actually clears ours.
        overrides.banner = targetProfile.banner ?? (target as any).banner ?? null;
        overrides.accentColor = targetProfile.accentColor ?? (target as any).accentColor ?? null;
        if (targetProfile.profileEffect) overrides.profileEffect = targetProfile.profileEffect;
        if (targetProfile.popoutAnimationParticleType != null) overrides.popoutAnimationParticleType = targetProfile.popoutAnimationParticleType;
        if (targetProfile.profileEffectExpiresAt != null) overrides.profileEffectExpiresAt = targetProfile.profileEffectExpiresAt;
        if (targetProfile.premiumType != null) overrides.premiumType = targetProfile.premiumType;
        if (targetProfile.premiumSince != null) overrides.premiumSince = targetProfile.premiumSince;
        if (targetProfile.premiumGuildSince != null) overrides.premiumGuildSince = targetProfile.premiumGuildSince;

        // Gradient theme colors from accentColor2 in manual mode
        if (manual?.accentColor2 && overrides.accentColor != null) {
            overrides.themeColors = [overrides.accentColor, Number(manual.accentColor2)];
        }

        // Mirror the userProfile sub-object so the popout's display-name section reflects the target.
        const targetUserProfile = (targetProfile as any).userProfile ?? {};
        const spoofedDisplayName = targetUserProfile.displayName
            ?? targetUserProfile.display_name
            ?? (target as any).globalName
            ?? (target as any).username;
        overrides.userProfile = {
            ...(original?.userProfile ?? {}),
            ...targetUserProfile,
            displayName: spoofedDisplayName,
        };

        if (settings.store.spoofBadges) {
            if (targetProfile.badges && targetProfile.badges.length) {
                overrides.badges = targetProfile.badges;
            } else {
                const flags = (target as any).publicFlags ?? (target as any).flags ?? 0;
                const computed: any[] = [];
                for (const fb of FLAG_BADGES) {
                    if ((flags & fb.flag) === fb.flag) {
                        computed.push({
                            id: `fakeUserProfile-flag-${fb.flag}`,
                            description: fb.description,
                            icon: fb.image,
                        });
                    }
                }
                if (((target as any).premiumType ?? 0) >= 1) {
                    computed.push({
                        id: "fakeUserProfile-nitro",
                        description: "Discord Nitro",
                        icon: "https://cdn.discordapp.com/badge-icons/2ba85e8026a8614b640c2837bcdfe21b.png",
                    });
                }
                // Manual custom badges
                if (manual?.customBadgeIds) {
                    const OLD_NAME_ICON = "https://cdn.discordapp.com/badge-icons/6de6d34650760ba5551a79732e98ed60.png";
                    if (manual.customBadgeIds.includes("quest")) {
                        computed.push({
                            id: "fakeUserProfile-quest",
                            description: "Completed a quest",
                            icon: "https://cdn.discordapp.com/badge-icons/7d9ae358c8c5e118768335dbe68b4fb8.png",
                        });
                    }
                    if (manual.customBadgeIds.includes("orbs")) {
                        computed.push({
                            id: "fakeUserProfile-orbs",
                            description: "Orbs — Apprentice",
                            icon: "https://cdn.discordapp.com/badge-icons/83d8a1eb09a8d64e59233eec5d4d5c2d.png",
                        });
                    }
                    if (manual.customBadgeIds.includes("oldname")) {
                        const oldNameText = manual.oldName ? `Old username\u00a0: ${manual.oldName}` : "Old username";
                        computed.push({
                            id: "fakeUserProfile-oldname",
                            description: oldNameText,
                            icon: OLD_NAME_ICON,
                        });
                    }
                }
                if (computed.length) overrides.badges = computed;
            }
        }

        if (settings.store.spoofActivities) {
            if (targetProfile.connectedAccounts) overrides.connectedAccounts = targetProfile.connectedAccounts;
            if (targetProfile.legacyApplications) overrides.legacyApplications = targetProfile.legacyApplications;
            if (targetProfile.applicationRoleConnections) overrides.applicationRoleConnections = targetProfile.applicationRoleConnections;
            if (targetProfile.userProfile) {
                overrides.userProfile = {
                    ...overrides.userProfile,
                    ...targetProfile.userProfile,
                    displayName: spoofedDisplayName,
                };
            }
        }

        const merged = original
            ? Object.assign(Object.create(Object.getPrototypeOf(original)), original, overrides)
            : { userId, ...overrides };
        return merged;
    },

    bannerHook({ displayProfile, user }: any) {
        if (!isActive()) return undefined;
        const id = displayProfile?.userId ?? user?.id;
        if (!isCurrentUser(id)) return undefined;
        const manualBanner = getManualBannerDataUrl();
        if (manualBanner) return manualBanner;
        const target = getTargetUser() as any;
        if (target?.banner) {
            const animated = target.banner.startsWith("a_");
            const ext = animated ? "gif" : "png";
            return `https://cdn.discordapp.com/banners/${target.id}/${target.banner}.${ext}?size=600`;
        }
        // Spoofing as someone with no banner — return empty string so the `??` patches
        // suppress the user's real banner instead of falling through to it.
        return "";
    },

    onBeforeMessageSend(channelId, msg, options) {
        if (!isActive() || !settings.store.fakeMessages) return;
        const target = getCachedTarget();
        if (!target) return;

        const replyRef = options?.replyOptions?.messageReference;
        const fake = buildFakeMessage(channelId, msg.content, replyRef);
        if (!fake) return;

        try {
            FluxDispatcher.dispatch(fake);
        } catch (e) {
            logger.error("Failed to dispatch fake message", e);
        }

        if (settings.store.sendRealToo) return;
        return { cancel: true };
    },
});
