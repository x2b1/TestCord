/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addContextMenuPatch, NavContextMenuPatchCallback, removeContextMenuPatch } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { getUserSettingLazy } from "@api/UserSettings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Flex } from "@components/Flex";
import { TestcordDevs } from "@utils/constants";
import { fetchUserProfile } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { Margins } from "@utils/margins";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { findComponentByCodeLazy } from "@webpack";
import {
    Button,
    Constants,
    DisplayProfileUtils,
    FluxDispatcher,
    GuildStore,
    IconUtils,
    Menu,
    PermissionsBits,
    PermissionStore,
    PresenceStore,
    RestAPI,
    Select,
    showToast,
    Text,
    TextInput,
    Toasts,
    UserStore,
    useState
} from "@webpack/common";

const CustomizationSection = findComponentByCodeLazy(".DESCRIPTION", "hasBackground:");

const CustomStatusSetting = getUserSettingLazy<{
    text: string;
    emojiId: string;
    emojiName: string;
    expiresAtMs: string;
    createdAtMs?: string;
}>("status", "customStatus")!;

const logger = new Logger("ProfileCopyButton");

const CUSTOM_EMOJI_RE = /<(a?):([A-Za-z0-9_~]+):(\d+)>/g;
const ID_RE = /^\d{17,20}$/;

const settings = definePluginSettings({
    copyGameCollection: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Also copy the target user's profile game widgets (favourite game, currently playing, want to play, played, game stats). Applies immediately, not via Save."
    },
    clearMissingFields: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "If the target user doesn't have a profile effect, name style, banner, etc., clear those fields from your profile too."
    }
});

interface CustomStatusActivity {
    type: number;
    state?: string;
    emoji?: {
        animated?: boolean;
        id?: string;
        name?: string;
    };
}

interface DisplayNameStyles {
    font_id?: number;
    effect_id?: number;
    colors?: number[];
}

interface RawProfileResponse {
    user?: {
        display_name_styles?: DisplayNameStyles;
    };
    user_profile?: {
        profile_effect?: { sku_id?: string; };
        banner?: string | null;
        theme_colors?: number[] | null;
        accent_color?: number | null;
        pronouns?: string;
        bio?: string;
    };
    widgets?: unknown[];
}

interface ParsedEmoji {
    animated: boolean;
    name: string;
    id: string;
    full: string; // original match e.g. <a:name:id>
}

// ─── Emoji helpers ────────────────────────────────────────────────────────────

function parseEmojisFromBio(bio: string): ParsedEmoji[] {
    const found: ParsedEmoji[] = [];
    const seen = new Set<string>();
    for (const match of bio.matchAll(CUSTOM_EMOJI_RE)) {
        const [full, anim, name, id] = match;
        if (!seen.has(id)) {
            seen.add(id);
            found.push({ animated: anim === "a", name, id, full });
        }
    }
    return found;
}

/** Returns all emoji IDs the current user already has access to (across all guilds). */
function getOwnedEmojiMap(): Map<string, { id: string; name: string; animated: boolean; }> {
    const map = new Map<string, { id: string; name: string; animated: boolean; }>();
    for (const guild of Object.values(GuildStore.getGuilds())) {
        for (const emoji of (guild as any).emojis ?? []) {
            map.set(emoji.id, { id: emoji.id, name: emoji.name, animated: !!emoji.animated });
        }
    }
    return map;
}

/** Returns guilds where the current user can manage emojis, sorted by name. */
function getManageableGuilds() {
    return Object.values(GuildStore.getGuilds())
        .filter(g => PermissionStore.can(PermissionsBits.MANAGE_GUILD_EXPRESSIONS, g))
        .sort((a, b) => (a as any).name.localeCompare((b as any).name));
}

async function uploadEmojiToGuild(guildId: string, emoji: ParsedEmoji): Promise<string | null> {
    try {
        const ext = emoji.animated ? "gif" : "png";
        const url = `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}`;
        const dataUri = await urlToDataUri(url);
        if (!dataUri) return null;

        const res = await RestAPI.post({
            url: Constants.Endpoints.GUILD_EMOJIS(guildId),
            body: {
                name: emoji.name,
                image: dataUri,
                roles: []
            }
        });
        return res?.body?.id ?? null;
    } catch (err) {
        logger.error("Failed to upload emoji", emoji.name, err);
        return null;
    }
}

/** Opens a modal to pick a guild, uploads missing emojis, returns remapped bio. */
function resolveEmojisInBio(bio: string): Promise<string> {
    return new Promise(resolve => {
        const emojis = parseEmojisFromBio(bio);
        if (emojis.length === 0) { resolve(bio); return; }

        const ownedMap = getOwnedEmojiMap();
        const missing = emojis.filter(e => !ownedMap.has(e.id));

        if (missing.length === 0) {
            // All emojis already owned — nothing to upload
            resolve(bio);
            return;
        }

        openModal(props => (
            <EmojiGuildPickerModal
                modalProps={props}
                missingEmojis={missing}
                onConfirm={async (guildId: string | null) => {
                    if (!guildId) {
                        // User skipped — strip missing emojis from bio
                        let result = bio;
                        for (const e of missing) result = result.split(e.full).join("");
                        resolve(result.replace(/[ \t]+\n/g, "\n").trim());
                        return;
                    }

                    let result = bio;
                    for (const e of missing) {
                        const newId = await uploadEmojiToGuild(guildId, e);
                        if (newId) {
                            const prefix = e.animated ? "a" : "";
                            result = result.split(e.full).join(`<${prefix}:${e.name}:${newId}>`);
                        } else {
                            // Upload failed — strip that emoji
                            result = result.split(e.full).join("");
                        }
                    }
                    resolve(result.replace(/[ \t]+\n/g, "\n").trim());
                }}
            />
        ));
    });
}

// ─── Guild picker modal ───────────────────────────────────────────────────────

function EmojiGuildPickerModal({ modalProps, missingEmojis, onConfirm }: {
    modalProps: ModalProps;
    missingEmojis: ParsedEmoji[];
    onConfirm: (guildId: string | null) => void;
}) {
    const guilds = getManageableGuilds();
    const [selectedGuildId, setSelectedGuildId] = useState<string>(guilds[0]?.id ?? "");
    const [busy, setBusy] = useState(false);

    async function handleUpload() {
        if (!selectedGuildId || busy) return;
        setBusy(true);
        modalProps.onClose();
        await onConfirm(selectedGuildId);
    }

    function handleSkip() {
        modalProps.onClose();
        onConfirm(null);
    }

    const emojiList = missingEmojis.map(e => `${e.animated ? "(animated) " : ""}:${e.name}:`).join(", ");

    return (
        <ModalRoot {...modalProps} size={ModalSize.SMALL}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Upload missing emojis</Text>
                <ModalCloseButton onClick={handleSkip} />
            </ModalHeader>
            <ModalContent>
                <Text variant="text-sm/normal" className={Margins.bottom8}>
                    The bio contains {missingEmojis.length} custom emoji{missingEmojis.length !== 1 ? "s" : ""} you don't have access to:
                </Text>
                <Text variant="text-sm/normal" style={{ fontStyle: "italic" }} className={Margins.bottom16}>
                    {emojiList}
                </Text>
                <Text variant="text-sm/normal" className={Margins.bottom8}>
                    Select a server to upload them to, or skip to remove them from the bio.
                </Text>
                {guilds.length === 0
                    ? <Text variant="text-sm/normal" style={{ color: "var(--text-danger)" }}>
                        You don't have Manage Expressions permission in any server.
                    </Text>
                    : <Select
                        options={guilds.map(g => ({ label: (g as any).name, value: g.id }))}
                        select={setSelectedGuildId}
                        isSelected={v => v === selectedGuildId}
                        serialize={v => v}
                    />
                }
            </ModalContent>
            <ModalFooter>
                <Flex>
                    <Button color={Button.Colors.PRIMARY} onClick={handleSkip}>
                        Skip (remove from bio)
                    </Button>
                    <Button
                        onClick={handleUpload}
                        disabled={busy || guilds.length === 0 || !selectedGuildId}
                    >
                        {busy ? "Uploading..." : "Upload & Continue"}
                    </Button>
                </Flex>
            </ModalFooter>
        </ModalRoot>
    );
}

// ─── Core helpers ─────────────────────────────────────────────────────────────

async function fetchRawProfile(targetId: string): Promise<RawProfileResponse | null> {
    try {
        const res = await RestAPI.get({ url: `/users/${targetId}/profile?with_mutual_guilds=false` });
        return (res?.body ?? null) as RawProfileResponse | null;
    } catch (err) {
        logger.error("Failed to fetch raw profile", err);
        return null;
    }
}

async function urlToDataUri(url: string): Promise<string | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (err) {
        logger.error("Failed to fetch image", url, err);
        return null;
    }
}

function hasNitro() {
    const premium = UserStore.getCurrentUser()?.premiumType ?? 0;
    return premium >= 1;
}

function setPendingChange(payload: Record<string, unknown>) {
    FluxDispatcher.dispatch({ type: "USER_PROFILE_SETTINGS_SET_PENDING_CHANGES", ...payload });
}

function getCustomStatusActivity(userId: string): CustomStatusActivity | undefined {
    const activities = (PresenceStore.getActivities(userId) ?? []) as CustomStatusActivity[];
    return activities.find(a => a.type === 4);
}

function resolveTargetUserId(input: string): string | null {
    const trimmed = input.trim().replace(/^@/, "");
    if (!trimmed) return null;
    if (ID_RE.test(trimmed)) return trimmed;

    const fromTag = UserStore.findByTag(trimmed) ?? UserStore.findByTag(trimmed, null);
    if (fromTag) return fromTag.id;

    const lower = trimmed.toLowerCase();
    let matchId: string | null = null;
    UserStore.forEach(u => {
        if (
            u.username.toLowerCase() === lower
            || u.globalName?.toLowerCase() === lower
            || u.tag.toLowerCase() === lower
        ) {
            matchId = u.id;
            return false;
        }
    });
    return matchId;
}

// ─── Guild auto-join ──────────────────────────────────────────────────────────

async function tryAutoJoinGuild(guildId: string): Promise<void> {
    if (GuildStore.getGuild(guildId)) return; // already a member

    let inviteCode: string | null = null;
    let guildName = "the server";

    try {
        const vanityRes = await RestAPI.get({ url: `/guilds/${guildId}/vanity-url` });
        if (vanityRes?.body?.code) inviteCode = vanityRes.body.code;
    } catch { /* no vanity */ }

    if (!inviteCode) {
        try {
            const previewRes = await RestAPI.get({ url: `/guilds/${guildId}/preview` });
            if (previewRes?.body) {
                guildName = previewRes.body.name ?? guildName;
                if (previewRes.body.vanity_url_code) inviteCode = previewRes.body.vanity_url_code;
            }
        } catch { /* not discoverable */ }
    }

    if (!inviteCode) {
        showToast("Server is private — can't auto-join.", Toasts.Type.MESSAGE);
        return;
    }

    try {
        const joinRes = await RestAPI.post({ url: `/invites/${inviteCode}`, body: {} });
        guildName = joinRes?.body?.guild?.name ?? guildName;
        // Set as primary clan
        await RestAPI.patch({ url: "/users/@me", body: { primary_guild: guildId } });
        showToast(`Joined ${guildName} and set clan tag!`, Toasts.Type.SUCCESS);
    } catch (err) {
        showToast("Could not join the server (may be private).", Toasts.Type.MESSAGE);
    }
}

async function copyGameWidgets(targetId: string, rawProfile: RawProfileResponse | null): Promise<boolean> {
    const display = DisplayProfileUtils.getDisplayProfile(targetId);
    const widgets = display?.widgets ?? rawProfile?.widgets;
    const endpoint = Constants.Endpoints.USER_PROFILE_WIDGETS ?? "/users/@me/widgets";

    if (!widgets || (widgets as unknown[]).length === 0) {
        if (settings.store.clearMissingFields) {
            try { await RestAPI.put({ url: endpoint, body: { widgets: [] } }); } catch (err) {
                logger.error("Failed to clear game widgets", err);
            }
        }
        return false;
    }

    try {
        // Discord requires widgets in format: { id, type, data: { type, games: [{ game_id, comment, tags }] } }
        const sanitized = (widgets as any[]).map((w: any) => ({
            id: w.id,
            type: w.type,
            data: {
                type: w.type,
                games: (w.games ?? []).map((g: any) => ({
                    game_id: g.applicationId ?? g.game_id,
                    ...(g.comment != null && { comment: g.comment }),
                    tags: g.tags ?? []
                }))
            }
        }));
        await RestAPI.put({ url: endpoint, body: { widgets: sanitized } });
        return true;
    } catch (err) {
        logger.error("Failed to copy game widgets", err);
        return false;
    }
}

// ─── Main copy logic ──────────────────────────────────────────────────────────

export async function copyProfileFromId(targetId: string) {
    const [profile, rawProfile] = await Promise.all([
        fetchUserProfile(targetId, undefined, false).catch(err => {
            logger.error("Failed to fetch profile", err);
            return null;
        }),
        fetchRawProfile(targetId)
    ]);

    const targetUser = UserStore.getUser(targetId);
    if (!targetUser) {
        showToast("Could not load that user.", Toasts.Type.FAILURE);
        return;
    }

    const nitro = hasNitro();
    const clear = settings.store.clearMissingFields;
    let dispatched = 0;

    // Display name
    if (targetUser.globalName) {
        setPendingChange({ pendingGlobalName: targetUser.globalName });
        dispatched++;
    } else if (clear) {
        setPendingChange({ pendingGlobalName: "" });
    }

    // Pronouns
    if (profile?.pronouns) {
        setPendingChange({ pendingPronouns: profile.pronouns });
        dispatched++;
    } else if (clear) {
        setPendingChange({ pendingPronouns: "" });
    }

    // Bio — resolve custom emojis first
    const rawBio = profile?.bio ?? "";
    if (rawBio) {
        let bioToSet = nitro ? rawBio : rawBio.replace(CUSTOM_EMOJI_RE, "").replace(/[ \t]+\n/g, "\n").trim();
        if (nitro) {
            bioToSet = await resolveEmojisInBio(bioToSet);
        }
        setPendingChange({ pendingBio: bioToSet });
        dispatched++;
    } else if (clear) {
        setPendingChange({ pendingBio: "" });
    }

    if (nitro) {
        // Theme colors
        if (profile?.themeColors) {
            setPendingChange({ pendingThemeColors: [...profile.themeColors] });
            dispatched++;
        } else if (clear) {
            setPendingChange({ pendingThemeColors: null });
        }

        // Accent color
        if (profile?.accentColor != null) {
            setPendingChange({ pendingAccentColor: profile.accentColor });
            dispatched++;
        } else if (clear) {
            setPendingChange({ pendingAccentColor: null });
        }

        // Profile effect
        const effectSkuId = rawProfile?.user_profile?.profile_effect?.sku_id;
        if (effectSkuId) {
            setPendingChange({ pendingProfileEffectId: effectSkuId });
            dispatched++;
        } else if (clear) {
            setPendingChange({ pendingProfileEffectId: null });
        }

        // Display name styles
        const dns = rawProfile?.user?.display_name_styles;
        if (dns && (dns.font_id != null || dns.effect_id != null || dns.colors?.length)) {
            setPendingChange({
                pendingDisplayNameStyles: {
                    ...(dns.font_id != null && { fontId: dns.font_id }),
                    ...(dns.effect_id != null && { effectId: dns.effect_id }),
                    colors: dns.colors ? [...dns.colors] : []
                }
            });
            dispatched++;
        }
        // Note: we intentionally don't clear pendingDisplayNameStyles when missing
        // because setting it to null/empty crashes Discord's profile editor
    }

    // Avatar
    if (targetUser.avatar) {
        const url = IconUtils.getUserAvatarURL(targetUser, nitro, 512);
        const dataUri = url ? await urlToDataUri(url) : null;
        if (dataUri) {
            setPendingChange({
                pendingAvatar: {
                    assetOrigin: "NEW_ASSET",
                    imageUri: dataUri,
                    description: `profile-copy-${targetUser.id}`
                }
            });
            dispatched++;
        }
    }

    // Banner
    if (nitro && profile?.banner) {
        const display = DisplayProfileUtils.getDisplayProfile(targetId);
        const url = display?.getBannerURL({ canAnimate: true, size: 1024 })
            ?? IconUtils.getUserBannerURL({ id: targetUser.id, banner: profile.banner, canAnimate: true, size: 1024 });
        const dataUri = url ? await urlToDataUri(url) : null;
        if (dataUri) {
            setPendingChange({ pendingBanner: dataUri });
            dispatched++;
        }
    } else if (nitro && clear) {
        setPendingChange({ pendingBanner: null });
    }

    // Custom status
    const status = getCustomStatusActivity(targetId);
    if (status?.state || status?.emoji) {
        const { emoji } = status;
        const isUnicodeEmoji = !!emoji && !emoji.id;
        const isCustomEmoji = !!emoji?.id;

        let finalEmojiId = "0";
        let finalEmojiName = "";

        if (isUnicodeEmoji) {
            // Unicode emoji — always works, no upload needed
            finalEmojiName = emoji!.name ?? "";
        } else if (isCustomEmoji && emoji?.id) {
            const ownedMap = getOwnedEmojiMap();
            if (ownedMap.has(emoji.id)) {
                // Already own it
                finalEmojiId = emoji.id;
                finalEmojiName = emoji.name ?? "";
            } else if (nitro) {
                // Don't own it — upload it to a server (same flow as bio emojis)
                const parsedEmoji: ParsedEmoji = {
                    animated: !!(emoji as any).animated,
                    name: emoji.name ?? "status_emoji",
                    id: emoji.id,
                    full: `<${(emoji as any).animated ? "a" : ""}:${emoji.name}:${emoji.id}>`
                };
                const newId = await new Promise<string | null>(resolve => {
                    openModal(props => (
                        <EmojiGuildPickerModal
                            modalProps={props}
                            missingEmojis={[parsedEmoji]}
                            onConfirm={async (guildId: string | null) => {
                                if (!guildId) { resolve(null); return; }
                                const uploadedId = await uploadEmojiToGuild(guildId, parsedEmoji);
                                resolve(uploadedId);
                            }}
                        />
                    ));
                });
                if (newId) {
                    finalEmojiId = newId;
                    finalEmojiName = emoji.name ?? "";
                }
            }
        }

        CustomStatusSetting.updateSetting({
            text: status.state ?? "",
            emojiId: finalEmojiId,
            emojiName: finalEmojiName,
            expiresAtMs: "0",
            createdAtMs: String(Date.now())
        });
        dispatched++;
    }

    // Clan tag + guild join
    const clan = (rawProfile as any)?.user?.clan ?? (rawProfile as any)?.user?.primary_guild;
    const clanGuildId = clan?.identity_guild_id;
    if (clanGuildId) {
        try {
            if (GuildStore.getGuild(clanGuildId)) {
                // Already a member — just set the tag
                await RestAPI.patch({ url: "/users/@me", body: { primary_guild: clanGuildId } });
            } else {
                await tryAutoJoinGuild(clanGuildId);
            }
        } catch (err) {
            logger.error("Failed to copy clan", err);
        }
    }

    // Game widgets
    let widgetsCopied = false;
    if (settings.store.copyGameCollection) {
        widgetsCopied = await copyGameWidgets(targetId, rawProfile);
    }

    if (dispatched === 0 && !widgetsCopied) {
        showToast("Nothing to copy from that profile.", Toasts.Type.MESSAGE);
        return;
    }

    const widgetSuffix = widgetsCopied ? " Game widgets applied." : "";
    if (dispatched > 0) {
        showToast(`Copied profile from ${targetUser.username}. Click Save to apply.${widgetSuffix}`, Toasts.Type.SUCCESS);
    } else {
        showToast(`Copied game widgets from ${targetUser.username}.`, Toasts.Type.SUCCESS);
    }
}

async function copyProfileFromInput(input: string) {
    const targetId = resolveTargetUserId(input);
    if (!targetId) {
        showToast(`No cached user matches "${input}". Try a user ID.`, Toasts.Type.FAILURE);
        return;
    }
    await copyProfileFromId(targetId);
}

// ─── Context menu patch ───────────────────────────────────────────────────────

const userContextMenuPatch: NavContextMenuPatchCallback = (children, { user }) => {
    if (!user || user.id === UserStore.getCurrentUser()?.id) return;

    children.push(
        <Menu.MenuSeparator />,
        <Menu.MenuItem
            id="copy-profile"
            label="Copy Profile"
            action={async () => {
                showToast(`Copying profile from ${user.username}...`, Toasts.Type.MESSAGE);
                try {
                    await copyProfileFromId(user.id);
                } catch (err) {
                    logger.error("Context menu copy failed", err);
                    showToast("Failed to copy profile.", Toasts.Type.FAILURE);
                }
            }}
        />
    );
};

// ─── Profile editor button ────────────────────────────────────────────────────

function PromptModal({ modalProps }: { modalProps: ModalProps; }) {
    const [value, setValue] = useState("");
    const [busy, setBusy] = useState(false);

    async function submit() {
        if (!value.trim() || busy) return;
        setBusy(true);
        try {
            await copyProfileFromInput(value);
            modalProps.onClose();
        } catch (err) {
            logger.error("Profile copy failed", err);
            showToast("Failed to copy profile.", Toasts.Type.FAILURE);
            setBusy(false);
        }
    }

    return (
        <ModalRoot {...modalProps} size={ModalSize.SMALL}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Copy profile from user</Text>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <Text variant="text-sm/normal" className={Margins.bottom8}>
                    Enter a user ID or a cached username. The profile editor fields are filled with their info, but you still need to click Save to apply.
                </Text>
                <TextInput
                    placeholder="User ID or username"
                    value={value}
                    onChange={setValue}
                    autoFocus
                />
            </ModalContent>
            <ModalFooter>
                <Flex>
                    <Button color={Button.Colors.PRIMARY} onClick={modalProps.onClose}>Cancel</Button>
                    <Button onClick={submit} disabled={busy || !value.trim()}>
                        {busy ? "Copying..." : "Copy"}
                    </Button>
                </Flex>
            </ModalFooter>
        </ModalRoot>
    );
}

function CopySection() {
    return (
        <CustomizationSection title="Profile Copy" hasBackground={true} hideDivider={false}>
            <Flex>
                <Button
                    onClick={() => openModal(props => <PromptModal modalProps={props} />)}
                    size={Button.Sizes.MEDIUM}
                >
                    Copy from User
                </Button>
            </Flex>
        </CustomizationSection>
    );
}

export default definePlugin({
    name: "ProfileCopyButton",
    description: "Adds a button to the profile editor and a right-click menu option to copy another user's profile (avatar, banner, bio, theme colors, name styles, profile effect, status, optional game widgets). Missing emojis in bios can be uploaded to a server of your choice.",
    tags: ["Utility", "Customisation"],
    authors: [TestcordDevs.x2b, TestcordDevs.nnenaza],
    settings,

    CopySection: ErrorBoundary.wrap(CopySection, { noop: true }),

    start() {
        addContextMenuPatch("user-context", userContextMenuPatch);
        addContextMenuPatch("user-profile-actions", userContextMenuPatch);
    },

    stop() {
        removeContextMenuPatch("user-context", userContextMenuPatch);
        removeContextMenuPatch("user-profile-actions", userContextMenuPatch);
    },

    patches: [
        {
            find: "DefaultCustomizationSections",
            replacement: {
                match: /(?<=#{intl::USER_SETTINGS_AVATAR_DECORATION}\)},"decoration"\),)/,
                replace: "$self.CopySection(),"
            }
        }
    ]
});
