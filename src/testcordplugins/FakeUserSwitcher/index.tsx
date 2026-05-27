/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addProfileBadge, BadgePosition, type ProfileBadge, removeProfileBadge } from "@api/Badges";
import { UserAreaButton, UserAreaRenderProps } from "@api/UserArea";
import { TestcordDevs } from "@utils/constants";
import { openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import type { User } from "@vencord/discord-types";
import { FluxDispatcher, IconUtils, React, UsernameUtils, UserStore } from "@webpack/common";

import { getCachedTarget, isActive, isCurrentUser, loadTarget, logger, setEnabled, settings, subscribe } from "./data";
import { FakeUserSwitcherModal } from "./modal";

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

function getTargetUser(): any {
    if (settings.store.manualMode && settings.store.spoofActive) {
        return {
            id: "0",
            username: settings.store.manualUsername || "FakeUser",
            globalName: settings.store.manualUsername || "FakeUser",
            discriminator: "0",
            avatar: "manual",
        };
    }
    const t = getCachedTarget();
    if (!t || !settings.store.spoofActive) return null;
    return t.user;
}

function getTargetProfile(): any {
    if (settings.store.manualMode && settings.store.spoofActive) {
        return { bio: "", badges: [] };
    }
    const t = getCachedTarget();
    if (!t || !settings.store.spoofActive) return null;
    return t.profile;
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
        accentColor: target.accentColor ?? profile?.accentColor ?? null,
        usernameNormalized: typeof target.username === "string" ? target.username.toLowerCase() : undefined,
        bot: target.bot ?? false,
    };
    if (target.primaryGuild !== undefined) overrides.primaryGuild = target.primaryGuild;
    if (target.avatarDecorationData !== undefined) overrides.avatarDecorationData = target.avatarDecorationData;
    if (target.clan !== undefined) overrides.clan = target.clan;
    if (target.collectibles !== undefined) overrides.collectibles = target.collectibles;
    if (target.displayNameStyles !== undefined) overrides.displayNameStyles = target.displayNameStyles;
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

let storePatched = false;
let utilsPatched = false;

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
            const t = getTargetUser();
            if (t) return originalGetUserAvatarURL!.call(this, t, animated, size, format);
        }
        return originalGetUserAvatarURL!.call(this, user, animated, size, format);
    };

    IconUtils.getUserBannerURL = function (params: any) {
        if (isActive() && params && isCurrentUser(params.id)) {
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

function FakeUserSwitcherIcon({ className, style }: { className?: string; style?: React.CSSProperties; }) {
    const active = isActive();
    return (
        <svg className={className} style={style} width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path fill={active ? "var(--status-danger)" : "currentColor"} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2a7.2 7.2 0 0 1-6-3.22c.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08a7.2 7.2 0 0 1-6 3.22z" />
            {active && <path fill="var(--status-danger)" d="M22.7 2.7a1 1 0 0 0-1.4-1.4l-20 20a1 1 0 1 0 1.4 1.4Z" />}
        </svg>
    );
}

function FakeUserSwitcherButton({ iconForeground, hideTooltips, nameplate }: UserAreaRenderProps) {
    const [, force] = React.useReducer(x => x + 1, 0);
    React.useEffect(() => subscribe(() => force()), []);

    const target = getCachedTarget();
    const active = isActive();

    const tooltip = hideTooltips
        ? undefined
        : target
            ? (active ? `Spoofing as ${target.user.username} — click to manage` : `Click to spoof as ${target.user.username}`)
            : "Fake User Switcher";

    return (
        <UserAreaButton
            tooltipText={tooltip}
            icon={<FakeUserSwitcherIcon className={iconForeground} />}
            role="button"
            plated={nameplate != null}
            redGlow={active}
            onClick={() => openModal(modalProps => <FakeUserSwitcherModal modalProps={modalProps as any} />)}
            onContextMenu={() => {
                if (!target) {
                    openModal(modalProps => <FakeUserSwitcherModal modalProps={modalProps as any} />);
                    return;
                }
                setEnabled(!settings.store.spoofActive);
                force();
            }}
        />
    );
}

const dynamicBadge: ProfileBadge = {
    id: "fakeUserSwitcher-target",
    description: "Fake User Switcher",
    position: BadgePosition.END,
    shouldShow: ({ userId }) => settings.store.spoofBadges && isActive() && isCurrentUser(userId),
    getBadges: () => {
        const target = getTargetUser();
        if (!target) return [];

        const flags = (target as any).publicFlags ?? (target as any).flags ?? 0;
        const badges: ProfileBadge[] = [];

        for (const fb of FLAG_BADGES) {
            if ((flags & fb.flag) === fb.flag) {
                badges.push({
                    id: `fakeUserSwitcher-flag-${fb.flag}`,
                    description: fb.description,
                    iconSrc: fb.image,
                    position: BadgePosition.END,
                });
            }
        }

        const premium = (target as any).premiumType ?? 0;
        if (premium >= 1) {
            badges.push({
                id: "fakeUserSwitcher-nitro",
                description: "Discord Nitro",
                iconSrc: "https://cdn.discordapp.com/badge-icons/2ba85e8026a8614b640c2837bcdfe21b.png",
                position: BadgePosition.END,
            });
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
    name: "FakeUserSwitcher",
    description: "Visually impersonate any Discord user client-side. Merges the best of FakeAccountSwitcher and FakeUserProfile.",
    tags: ["Customisation", "Privacy", "Fun"],
    authors: [TestcordDevs.x2b, TestcordDevs.SirPhantom89],
    dependencies: ["UserAreaAPI", "BadgeAPI", "MessageEventsAPI"],

    settings,

    userAreaButton: {
        icon: FakeUserSwitcherIcon,
        render: (props: UserAreaRenderProps) => <FakeUserSwitcherButton {...props} />,
    },

    async start() {
        addProfileBadge(dynamicBadge);
        patchStore();
        patchUtils();

        unsub = subscribe(syncSpoofState);

        const { targetId } = settings.store;
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
                match: /if\(\i\((\i)\)\.global_name\)return(?=.{0,100}return"\?\?\?")/,
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
                replace: "$self.bannerHook(arguments[0])||$&"
            }
        },
        {
            find: ":\"SHOULD_LOAD\");",
            replacement: {
                match: /\i(?:\?)?\.getPreviewBanner\(\i,\i,\i\)(?=.{0,100}"COMPLETE")/,
                replace: "$self.bannerHook(arguments[0])||$&"
            }
        }
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
                if (settings.store.manualMode && settings.store.manualAvatar) {
                    return settings.store.manualAvatar;
                }
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

        const overrides: any = {};
        if (targetProfile.bio != null) overrides.bio = targetProfile.bio;
        if (targetProfile.pronouns != null) overrides.pronouns = targetProfile.pronouns;
        if (targetProfile.themeColors) overrides.themeColors = targetProfile.themeColors;
        if (targetProfile.accentColor != null) overrides.accentColor = targetProfile.accentColor;
        if (targetProfile.banner) overrides.banner = targetProfile.banner;
        if (targetProfile.profileEffect) overrides.profileEffect = targetProfile.profileEffect;
        if (targetProfile.popoutAnimationParticleType != null) overrides.popoutAnimationParticleType = targetProfile.popoutAnimationParticleType;
        if (targetProfile.profileEffectExpiresAt != null) overrides.profileEffectExpiresAt = targetProfile.profileEffectExpiresAt;
        if (targetProfile.premiumType != null) overrides.premiumType = targetProfile.premiumType;
        if (targetProfile.premiumSince != null) overrides.premiumSince = targetProfile.premiumSince;
        if (targetProfile.premiumGuildSince != null) overrides.premiumGuildSince = targetProfile.premiumGuildSince;

        if (settings.store.spoofBadges) {
            if (targetProfile.badges && targetProfile.badges.length) {
                overrides.badges = targetProfile.badges;
            } else {
                const flags = (target as any).publicFlags ?? (target as any).flags ?? 0;
                const computed: any[] = [];
                for (const fb of FLAG_BADGES) {
                    if ((flags & fb.flag) === fb.flag) {
                        computed.push({
                            id: `fakeUserSwitcher-flag-${fb.flag}`,
                            description: fb.description,
                            icon: fb.image,
                        });
                    }
                }
                if (((target as any).premiumType ?? 0) >= 1) {
                    computed.push({
                        id: "fakeUserSwitcher-nitro",
                        description: "Discord Nitro",
                        icon: "https://cdn.discordapp.com/badge-icons/2ba85e8026a8614b640c2837bcdfe21b.png",
                    });
                }
                if (computed.length) overrides.badges = computed;
            }
        }

        if (settings.store.spoofActivities) {
            if (targetProfile.connectedAccounts) overrides.connectedAccounts = targetProfile.connectedAccounts;
            if (targetProfile.legacyApplications) overrides.legacyApplications = targetProfile.legacyApplications;
            if (targetProfile.applicationRoleConnections) overrides.applicationRoleConnections = targetProfile.applicationRoleConnections;
            if (targetProfile.userProfile) overrides.userProfile = targetProfile.userProfile;
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
        const target = getTargetUser() as any;
        if (target?.banner) {
            const animated = target.banner.startsWith("a_");
            const ext = animated ? "gif" : "png";
            return `https://cdn.discordapp.com/banners/${target.id}/${target.banner}.${ext}?size=600`;
        }
        return undefined;
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
