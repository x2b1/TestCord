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
import { FluxDispatcher, React } from "@webpack/common";
import virtualMerge from "virtual-merge";

import { getCachedTarget, isActive, isCurrentUser, logger, settings, subscribe } from "./data";
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
    if (!t || !settings.store.enabled) return null;
    return t.user;
}

function getTargetProfile(): any {
    const t = getCachedTarget();
    if (!t || !settings.store.enabled) return null;
    return t.profile;
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
            onClick={() => openModal(modalProps => <FakeUserProfileModal modalProps={modalProps} />)}
            onContextMenu={() => {
                if (!target) {
                    openModal(modalProps => <FakeUserProfileModal modalProps={modalProps} />);
                    return;
                }
                settings.store.enabled = !settings.store.enabled;
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
            badges.push({
                id: "fakeUserProfile-nitro",
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

    start() {
        addProfileBadge(dynamicBadge);

        const { targetId } = settings.store;
        if (targetId) {
            void import("./data").then(({ loadTarget }) => {
                loadTarget(targetId).catch(e => logger.warn("Failed to restore cached target", e));
            });
        }
    },

    stop() {
        removeProfileBadge(dynamicBadge);
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
                replace: "$self.bannerHook(arguments[0])||$&"
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

    getAvatarDecorationURL({ user, avatarDecoration, canAnimate }: { user?: User; avatarDecoration?: any; canAnimate?: boolean; }) {
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

        if (settings.store.spoofActivities) {
            if (targetProfile.connectedAccounts) overrides.connectedAccounts = targetProfile.connectedAccounts;
            if (targetProfile.legacyApplications) overrides.legacyApplications = targetProfile.legacyApplications;
            if (targetProfile.applicationRoleConnections) overrides.applicationRoleConnections = targetProfile.applicationRoleConnections;
            if (targetProfile.userProfile) overrides.userProfile = targetProfile.userProfile;
        }

        const merged = original ? virtualMerge(original, overrides) : { userId, ...overrides };
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
