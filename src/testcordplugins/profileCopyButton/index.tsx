/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

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
    PresenceStore,
    RestAPI,
    showToast,
    Text,
    TextInput,
    Toasts,
    useState,
    UserStore
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

const CUSTOM_EMOJI_RE = /<a?:[A-Za-z0-9_~]+:\d+>/g;
const ID_RE = /^\d{17,20}$/;

const settings = definePluginSettings({
    copyGameCollection: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Also copy the target user's profile game widgets (favourite game, currently playing, want to play, played, game stats). Applies immediately, not via Save."
    }
});

interface ClanLike {
    identityGuildId?: string;
    identityEnabled?: boolean;
}

interface CustomStatusActivity {
    type: number;
    state?: string;
    emoji?: {
        animated?: boolean;
        id?: string;
        name?: string;
    };
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

async function copyGameWidgets(targetId: string): Promise<boolean> {
    const display = DisplayProfileUtils.getDisplayProfile(targetId);
    const widgets = display?.widgets;
    if (!widgets || widgets.length === 0) return false;

    const endpoint = Constants.Endpoints.USER_PROFILE_WIDGETS ?? "/users/@me/widgets";

    try {
        await RestAPI.put({
            url: endpoint,
            body: { widgets }
        });
        return true;
    } catch (err) {
        logger.error("Failed to copy game widgets", err);
        return false;
    }
}

async function copyProfileFromInput(input: string) {
    const targetId = resolveTargetUserId(input);
    if (!targetId) {
        showToast(`No cached user matches "${input}". Try a user ID.`, Toasts.Type.FAILURE);
        return;
    }

    const profile = await fetchUserProfile(targetId, undefined, false).catch(err => {
        logger.error("Failed to fetch profile", err);
        return null;
    });

    const targetUser = UserStore.getUser(targetId);
    if (!targetUser) {
        showToast("Could not load that user.", Toasts.Type.FAILURE);
        return;
    }

    const nitro = hasNitro();
    let dispatched = 0;

    if (targetUser.globalName) {
        setPendingChange({ pendingGlobalName: targetUser.globalName });
        dispatched++;
    }

    if (profile?.pronouns) {
        setPendingChange({ pendingPronouns: profile.pronouns });
        dispatched++;
    }

    const rawBio = profile?.bio ?? "";
    const bioToSet = rawBio
        ? (nitro ? rawBio : rawBio.replace(CUSTOM_EMOJI_RE, "").replace(/[ \t]+\n/g, "\n").trim())
        : null;
    if (bioToSet != null) {
        setPendingChange({ pendingBio: bioToSet });
        dispatched++;
    }

    if (nitro) {
        if (profile?.themeColors) {
            setPendingChange({ pendingThemeColors: [...profile.themeColors] });
            dispatched++;
        }
        if (profile?.accentColor != null) {
            setPendingChange({ pendingAccentColor: profile.accentColor });
            dispatched++;
        }
    }

    if (targetUser.avatar) {
        const animated = targetUser.avatar.startsWith("a_");
        const ext = nitro && animated ? "gif" : "png";
        const url = `https://cdn.discordapp.com/avatars/${targetUser.id}/${targetUser.avatar}.${ext}?size=4096`;
        const dataUri = await urlToDataUri(url);
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

    if (nitro && profile?.banner) {
        const animated = profile.banner.startsWith("a_");
        const ext = animated ? "gif" : "png";
        const url = `https://cdn.discordapp.com/banners/${targetUser.id}/${profile.banner}.${ext}?size=4096`;
        const dataUri = await urlToDataUri(url);
        if (dataUri) {
            setPendingChange({
                pendingBanner: {
                    assetOrigin: "NEW_ASSET",
                    imageUri: dataUri,
                    description: `profile-banner-copy-${targetUser.id}`
                }
            });
            dispatched++;
        }
    }

    const primaryGuild = (targetUser as unknown as { primaryGuild?: ClanLike | null; }).primaryGuild;
    if (primaryGuild?.identityGuildId && primaryGuild.identityEnabled !== false) {
        const sharedGuild = GuildStore.getGuild(primaryGuild.identityGuildId);
        if (sharedGuild) {
            setPendingChange({ pendingPrimaryGuildId: primaryGuild.identityGuildId });
            dispatched++;
        }
    }

    const status = getCustomStatusActivity(targetId);
    if (status?.state || status?.emoji) {
        const emoji = status.emoji;
        const useCustomEmoji = nitro && !!emoji?.id;
        CustomStatusSetting.updateSetting({
            text: status.state ?? "",
            emojiId: useCustomEmoji && emoji?.id ? emoji.id : "0",
            emojiName: emoji?.name ?? "",
            expiresAtMs: "0",
            createdAtMs: String(Date.now())
        });
        dispatched++;
    }

    let widgetsCopied = false;
    if (settings.store.copyGameCollection) {
        widgetsCopied = await copyGameWidgets(targetId);
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
    description: "Adds a button to the profile editor that fills your profile with another user's info (avatar, banner, bio, status, clan tag, optional game widgets).",
    tags: ["Utility", "Customisation"],
    authors: [TestcordDevs.x2b],
    settings,

    CopySection: ErrorBoundary.wrap(CopySection, { noop: true }),

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
