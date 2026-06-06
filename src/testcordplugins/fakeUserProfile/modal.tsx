/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Flex } from "@components/Flex";
import { FormSwitch } from "@components/FormSwitch";
import { Margins } from "@utils/margins";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, ModalSize } from "@utils/modal";
import { Button, Forms, IconUtils, showToast, Text, TextInput, Toasts, useState } from "@webpack/common";

import { clearTarget, getCachedTarget, getManualProfile, loadTarget, logger, manualBadgeFlags, saveManualProfile, setEnabled, settings } from "./data";

const ID_RE = /^\d{17,20}$/;
const DISCRIM_RE = /^\d{1,4}$/;

async function readImageAsDataUrl(file: File): Promise<string> {
    return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Failed to read the image."));
        reader.onload = () => {
            if (typeof reader.result === "string") resolve(reader.result);
            else reject(new Error("Failed to read the image."));
        };
        reader.readAsDataURL(file);
    });
}

export function FakeUserProfileModal({ modalProps }: { modalProps: ModalProps; }) {
    const initial = getCachedTarget();
    const initialManual = getManualProfile();
    const [value, setValue] = useState(initial?.id ?? settings.store.targetId ?? "");
    const [busy, setBusy] = useState(false);
    const [enabled, setEnabledLocal] = useState(settings.store.spoofActive);
    const [fakeMessages, setFakeMessages] = useState(settings.store.fakeMessages);
    const [sendRealToo, setSendRealToo] = useState(settings.store.sendRealToo);
    const [spoofBadges, setSpoofBadges] = useState(settings.store.spoofBadges);
    const [spoofActivities, setSpoofActivities] = useState(settings.store.spoofActivities);
    const [target, setTarget] = useState(initial);
    const [mode, setMode] = useState(settings.store.targetMode ?? "lookup");
    const [manualId, setManualId] = useState(initialManual.id);
    const [manualUsername, setManualUsername] = useState(initialManual.username);
    const [manualGlobalName, setManualGlobalName] = useState(initialManual.globalName);
    const [manualDiscriminator, setManualDiscriminator] = useState(initialManual.discriminator);
    const [manualBio, setManualBio] = useState(initialManual.bio);
    const [manualPronouns, setManualPronouns] = useState(initialManual.pronouns);
    const [manualAccentColor, setManualAccentColor] = useState(initialManual.accentColor);
    const [manualAvatarDataUrl, setManualAvatarDataUrl] = useState(initialManual.avatarDataUrl);
    const [manualBannerDataUrl, setManualBannerDataUrl] = useState(initialManual.bannerDataUrl);
    const [manualFlags, setManualFlags] = useState(initialManual.publicFlags);
    const [manualPremiumType, setManualPremiumType] = useState(String(initialManual.premiumType));
    const [manualBot, setManualBot] = useState(initialManual.bot);

    async function apply() {
        settings.store.targetMode = "lookup";
        const id = value.trim();
        if (!ID_RE.test(id)) {
            showToast("Enter a valid Discord user ID.", Toasts.Type.FAILURE);
            return;
        }
        setBusy(true);
        try {
            const next = await loadTarget(id);
            setTarget(next);
            setEnabled(true);
            setEnabledLocal(true);
            showToast(`Spoofing as ${next.user.username}.`, Toasts.Type.SUCCESS);
        } catch (e: any) {
            logger.error("apply failed", e);
            showToast(e?.message || "Failed to load that user.", Toasts.Type.FAILURE);
        } finally {
            setBusy(false);
        }
    }

    function applyManual() {
        const id = manualId.trim();
        const username = manualUsername.trim();
        const discriminator = manualDiscriminator.trim() || "0";

        if (!ID_RE.test(id)) {
            showToast("Enter a valid Discord user ID.", Toasts.Type.FAILURE);
            return;
        }

        if (!username) {
            showToast("Enter a username.", Toasts.Type.FAILURE);
            return;
        }

        if (!DISCRIM_RE.test(discriminator)) {
            showToast("Enter a valid discriminator.", Toasts.Type.FAILURE);
            return;
        }

        const premiumType = Number(manualPremiumType);
        if (!Number.isInteger(premiumType) || premiumType < 0 || premiumType > 3) {
            showToast("Nitro type must be between 0 and 3.", Toasts.Type.FAILURE);
            return;
        }

        const manual = saveManualProfile({
            id,
            username,
            globalName: manualGlobalName.trim(),
            discriminator,
            bio: manualBio,
            pronouns: manualPronouns,
            accentColor: manualAccentColor.trim(),
            avatarDataUrl: manualAvatarDataUrl,
            bannerDataUrl: manualBannerDataUrl,
            avatarHash: "manual-avatar",
            bannerHash: "manual-banner",
            publicFlags: manualFlags,
            premiumType,
            bot: manualBot,
        });

        setTarget(manual);
        setEnabled(true);
        setEnabledLocal(true);
        showToast(`Spoofing as ${username}.`, Toasts.Type.SUCCESS);
    }

    function clear() {
        clearTarget();
        setTarget(null);
        setEnabledLocal(false);
        setValue("");
        showToast("Cleared spoof target.", Toasts.Type.MESSAGE);
    }

    function toggle(v: boolean) {
        if (v && !target) {
            showToast("Pick a target user first.", Toasts.Type.FAILURE);
            return;
        }
        setEnabled(v);
        setEnabledLocal(v);
    }

    async function uploadImage(kind: "avatar" | "banner") {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;

            try {
                const dataUrl = await readImageAsDataUrl(file);
                if (kind === "avatar") setManualAvatarDataUrl(dataUrl);
                else setManualBannerDataUrl(dataUrl);
                showToast(`${kind === "avatar" ? "Avatar" : "Banner"} uploaded.`, Toasts.Type.SUCCESS);
            } catch (e) {
                logger.error("image upload failed", e);
                showToast("Failed to read the image.", Toasts.Type.FAILURE);
            }
        };
        input.click();
    }

    function toggleFlag(flag: number, enabled: boolean) {
        setManualFlags(current => enabled ? current | flag : current & ~flag);
    }

    return (
        <ModalRoot {...modalProps} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Fake User Profile</Text>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <Forms.FormText className={Margins.bottom8}>
                    Pick a user by ID. Your client will visually treat you as them: avatar, banner, badges, bio, pronouns, decorations, activities, name. Messages you send can be replaced with a local fake from the target user.
                </Forms.FormText>

                <Forms.FormTitle>Mode</Forms.FormTitle>
                <Flex style={{ gap: 8 }} className={Margins.bottom16}>
                    <Button
                        color={mode === "lookup" ? Button.Colors.PRIMARY : Button.Colors.TRANSPARENT}
                        onClick={() => {
                            settings.store.targetMode = "lookup";
                            setMode("lookup");
                        }}
                    >
                        Lookup user
                    </Button>
                    <Button
                        color={mode === "manual" ? Button.Colors.PRIMARY : Button.Colors.TRANSPARENT}
                        onClick={() => {
                            settings.store.targetMode = "manual";
                            setMode("manual");
                        }}
                    >
                        Manual profile
                    </Button>
                </Flex>

                {mode === "lookup" ? (
                    <>
                        <Forms.FormTitle>Target user ID</Forms.FormTitle>
                        <Flex style={{ alignItems: "center", gap: 8 }} className={Margins.bottom16}>
                            <div style={{ flexGrow: 1 }}>
                                <TextInput
                                    placeholder="123456789012345678"
                                    value={value}
                                    onChange={setValue}
                                    autoFocus
                                />
                            </div>
                            <Button onClick={apply} disabled={busy || !value.trim()}>
                                {busy ? "Loading..." : "Apply"}
                            </Button>
                        </Flex>
                    </>
                ) : (
                    <>
                        <Forms.FormTitle>User ID</Forms.FormTitle>
                        <TextInput value={manualId} onChange={setManualId} placeholder="123456789012345678" className={Margins.bottom8} />

                        <Forms.FormTitle>Username</Forms.FormTitle>
                        <TextInput value={manualUsername} onChange={setManualUsername} placeholder="fakeuser" className={Margins.bottom8} />

                        <Forms.FormTitle>Display name</Forms.FormTitle>
                        <TextInput value={manualGlobalName} onChange={setManualGlobalName} placeholder="Fake User" className={Margins.bottom8} />

                        <Forms.FormTitle>Discriminator</Forms.FormTitle>
                        <TextInput value={manualDiscriminator} onChange={setManualDiscriminator} placeholder="0" className={Margins.bottom8} />

                        <Forms.FormTitle>Bio</Forms.FormTitle>
                        <TextInput value={manualBio} onChange={setManualBio} placeholder="Anything you want" className={Margins.bottom8} />

                        <Forms.FormTitle>Pronouns</Forms.FormTitle>
                        <TextInput value={manualPronouns} onChange={setManualPronouns} placeholder="they/them" className={Margins.bottom8} />

                        <Forms.FormTitle>Accent color</Forms.FormTitle>
                        <TextInput value={manualAccentColor} onChange={setManualAccentColor} placeholder="16711680" className={Margins.bottom8} />

                        <Forms.FormTitle>Nitro type</Forms.FormTitle>
                        <TextInput value={manualPremiumType} onChange={setManualPremiumType} placeholder="0" className={Margins.bottom8} />

                        <Flex style={{ gap: 8 }} className={Margins.bottom16}>
                            <Button onClick={() => uploadImage("avatar")}>Upload avatar</Button>
                            <Button onClick={() => uploadImage("banner")}>Upload banner</Button>
                            <Button
                                color={Button.Colors.TRANSPARENT}
                                onClick={() => {
                                    setManualAvatarDataUrl("");
                                    setManualBannerDataUrl("");
                                }}
                            >
                                Clear images
                            </Button>
                        </Flex>

                        <FormSwitch
                            value={manualBot}
                            onChange={setManualBot}
                            description="Show the profile as a bot user."
                            title="Bot"
                        />

                        <FormSwitch
                            value={(manualFlags & manualBadgeFlags.DiscordStaff) !== 0}
                            onChange={v => toggleFlag(manualBadgeFlags.DiscordStaff, v)}
                            description="Show the Discord Staff badge."
                            title="Discord Staff"
                        />

                        <FormSwitch
                            value={(manualFlags & manualBadgeFlags.PartneredServerOwner) !== 0}
                            onChange={v => toggleFlag(manualBadgeFlags.PartneredServerOwner, v)}
                            description="Show the Partnered Server Owner badge."
                            title="Partnered Server Owner"
                        />

                        <FormSwitch
                            value={(manualFlags & manualBadgeFlags.HypeSquadEvents) !== 0}
                            onChange={v => toggleFlag(manualBadgeFlags.HypeSquadEvents, v)}
                            description="Show the HypeSquad Events badge."
                            title="HypeSquad Events"
                        />

                        <FormSwitch
                            value={(manualFlags & manualBadgeFlags.DiscordBugHunter) !== 0}
                            onChange={v => toggleFlag(manualBadgeFlags.DiscordBugHunter, v)}
                            description="Show the Discord Bug Hunter badge."
                            title="Discord Bug Hunter"
                        />

                        <FormSwitch
                            value={(manualFlags & manualBadgeFlags.HypeSquadBravery) !== 0}
                            onChange={v => toggleFlag(manualBadgeFlags.HypeSquadBravery, v)}
                            description="Show the HypeSquad Bravery badge."
                            title="HypeSquad Bravery"
                        />

                        <FormSwitch
                            value={(manualFlags & manualBadgeFlags.HypeSquadBrilliance) !== 0}
                            onChange={v => toggleFlag(manualBadgeFlags.HypeSquadBrilliance, v)}
                            description="Show the HypeSquad Brilliance badge."
                            title="HypeSquad Brilliance"
                        />

                        <FormSwitch
                            value={(manualFlags & manualBadgeFlags.HypeSquadBalance) !== 0}
                            onChange={v => toggleFlag(manualBadgeFlags.HypeSquadBalance, v)}
                            description="Show the HypeSquad Balance badge."
                            title="HypeSquad Balance"
                        />

                        <FormSwitch
                            value={(manualFlags & manualBadgeFlags.EarlySupporter) !== 0}
                            onChange={v => toggleFlag(manualBadgeFlags.EarlySupporter, v)}
                            description="Show the Early Supporter badge."
                            title="Early Supporter"
                        />

                        <FormSwitch
                            value={(manualFlags & manualBadgeFlags.GoldenDiscordBugHunter) !== 0}
                            onChange={v => toggleFlag(manualBadgeFlags.GoldenDiscordBugHunter, v)}
                            description="Show the Golden Discord Bug Hunter badge."
                            title="Golden Discord Bug Hunter"
                        />

                        <FormSwitch
                            value={(manualFlags & manualBadgeFlags.EarlyVerifiedBotDeveloper) !== 0}
                            onChange={v => toggleFlag(manualBadgeFlags.EarlyVerifiedBotDeveloper, v)}
                            description="Show the Early Verified Bot Developer badge."
                            title="Early Verified Bot Developer"
                        />

                        <FormSwitch
                            value={(manualFlags & manualBadgeFlags.ModeratorProgramsAlumni) !== 0}
                            onChange={v => toggleFlag(manualBadgeFlags.ModeratorProgramsAlumni, v)}
                            description="Show the Moderator Programs Alumni badge."
                            title="Moderator Programs Alumni"
                        />

                        <FormSwitch
                            value={(manualFlags & manualBadgeFlags.ActiveDeveloper) !== 0}
                            onChange={v => toggleFlag(manualBadgeFlags.ActiveDeveloper, v)}
                            description="Show the Active Developer badge."
                            title="Active Developer"
                        />

                        <Button onClick={applyManual} className={Margins.top8}>Apply manual profile</Button>
                    </>
                )}

                {target && (
                    <Flex style={{ alignItems: "center", gap: 12 }} className={Margins.bottom16}>
                        <img
                            src={mode === "manual" && manualAvatarDataUrl ? manualAvatarDataUrl : IconUtils.getUserAvatarURL(target.user, true, 64)}
                            alt=""
                            width={48}
                            height={48}
                            style={{ borderRadius: "50%" }}
                        />
                        <div>
                            <Text variant="text-md/semibold">{target.user.globalName ?? target.user.username}</Text>
                            <Text variant="text-sm/normal" style={{ opacity: 0.7 }}>@{target.user.username} · {target.id}</Text>
                        </div>
                    </Flex>
                )}

                <FormSwitch
                    value={enabled}
                    onChange={toggle}
                    description="Enable the visual spoof. The user area button toggles the same setting."
                    title="Spoof active"
                />

                <FormSwitch
                    value={fakeMessages}
                    onChange={v => { settings.store.fakeMessages = v; setFakeMessages(v); }}
                    description="When you send a message, post a local fake one as the target instead of really sending it."
                    title="Fake outgoing messages"
                />

                <FormSwitch
                    value={sendRealToo}
                    onChange={v => { settings.store.sendRealToo = v; setSendRealToo(v); }}
                    description="Also send the real message in addition to the local fake. Off keeps it client-side only."
                    disabled={!fakeMessages}
                    title="Send real message too"
                />

                <FormSwitch
                    value={spoofBadges}
                    onChange={v => { settings.store.spoofBadges = v; setSpoofBadges(v); }}
                    description="Mirror the target's badges onto your client-side profile."
                    title="Spoof badges"
                />

                <FormSwitch
                    value={spoofActivities}
                    onChange={v => { settings.store.spoofActivities = v; setSpoofActivities(v); }}
                    description="Mirror the target's connected accounts and game collection."
                    hideBorder
                    title="Spoof activities and connections"
                />
            </ModalContent>
            <ModalFooter>
                <Flex style={{ gap: 8 }}>
                    <Button color={Button.Colors.RED} onClick={clear} disabled={!target}>Clear</Button>
                    <Button color={Button.Colors.PRIMARY} onClick={modalProps.onClose}>Close</Button>
                </Flex>
            </ModalFooter>
        </ModalRoot>
    );
}
