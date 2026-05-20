/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { BaseText } from "@components/BaseText";
import { Button, TextButton } from "@components/Button";
import { Card } from "@components/Card";
import { Heading, HeadingTertiary } from "@components/Heading";
import { CogWheel, DeleteIcon, LogIcon, MagnifyingGlassIcon, OpenExternalIcon } from "@components/Icons";
import { Notice } from "@components/Notice";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab, wrapTab } from "@components/settings";
import { SpecialCard } from "@components/settings/SpecialCard";
import { Switch } from "@components/Switch";
import { classNameFactory } from "@utils/css";
import { Margins } from "@utils/margins";
import { sleep } from "@utils/misc";
import { closeModal, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import type { User } from "@vencord/discord-types";
import { Alerts, ChannelStore, IconUtils, MessageActions, NavigationRouter, React, Select, TextInput, Toasts, UserStore, UserUtils, useStateFromStores } from "@webpack/common";

import { BRAND_ICON_DATA_URL, BRAND_NAME } from "../_kamidereCompat/branding";
import { removeKamidereRuntimeTask, upsertKamidereRuntimeTask } from "../_kamidereCompat/runtimeActivity";
import { parseProtectedDmChannels, parseProtectedDmUserIds, SendTrailPurgeTarget,settings } from "./settings";
import { clearSentTrailRecords, removeSentTrailRecord, useSentTrailRecords } from "./store";
import type { SentTrailMediaItem, SentTrailRecord } from "./types";
import { buildSearchIndex, formatDayLabel, formatTime, getRecordRecipientIds, recordMatchesScope, resolveRecordContext } from "./utils";

const cl = classNameFactory("vc-send-trail-");
const LIVE_DELETE_DELAY_MS = 850;
const PURGE_STATUS_HIDE_DELAY_MS = 2400;
const PURGE_STATUS_TRANSITION_MS = 280;
const DEFAULT_PAGE_SIZE: PageSizeValue = "5";
const PURGE_RUNTIME_TASK_ID = "kamidere-send-trail:purge";

const HERO_BACKGROUND = `data:image/svg+xml;utf8,${encodeURIComponent(
    [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600">',
        "<defs>",
        '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">',
        '<stop stop-color="#101114"/>',
        '<stop offset="0.45" stop-color="#22272E"/>',
        '<stop offset="1" stop-color="#3A332A"/>',
        "</linearGradient>",
        "</defs>",
        '<rect width="1200" height="600" fill="url(#g)"/>',
        '<circle cx="980" cy="120" r="150" fill="#F4BD6A" opacity=".10"/>',
        '<circle cx="220" cy="470" r="180" fill="#9FB5D1" opacity=".08"/>',
        '<path d="M-40 440C132 342 260 332 396 368s254 53 380 15 250-39 464 86V640H-40Z" fill="#0C0E12" opacity=".62"/>',
        '<path d="M160 54 720 614" stroke="#FFE9BF" stroke-opacity=".05" stroke-width="28"/>',
        '<path d="M560 -20 1140 560" stroke="#FFE9BF" stroke-opacity=".06" stroke-width="18"/>',
        "</svg>",
    ].join(""),
)}`;

type ScopeValue = "all" | "dms" | `guild:${string}`;
type KindValue = "all" | "text" | "media";
type PeriodValue = "all" | "24h" | "7d";
type PageSizeValue = "5" | "10" | "20" | "30" | "50";
type PurgeStatusPhase = "idle" | "running" | "success" | "partial" | "failure";

interface SelectOption<T extends string> {
    label: string;
    value: T;
}

interface RecordGroup {
    label: string;
    records: SentTrailRecord[];
}

interface PurgeStatusState {
    phase: PurgeStatusPhase;
    total: number;
    processed: number;
    deleted: number;
    failed: number;
    skipped: number;
    currentLabel?: string;
}

interface DmConversation {
    channelId: string;
    label: string;
    details: string;
    count: number;
}

interface DmUserContact {
    userId: string;
    label: string;
    details: string;
    count: number;
    avatarUrl: string;
}

function showToast(message: string, type: typeof Toasts.Type[keyof typeof Toasts.Type]) {
    Toasts.show({
        message,
        type,
        id: Toasts.genId(),
        options: {
            position: Toasts.Position.BOTTOM,
        },
    });
}

function makeEmptyPurgeStatus(): PurgeStatusState {
    return {
        phase: "idle",
        total: 0,
        processed: 0,
        deleted: 0,
        failed: 0,
        skipped: 0,
    };
}

function syncPurgeRuntimeTask(status: PurgeStatusState, startedAt: number) {
    if (status.phase === "idle") {
        removeKamidereRuntimeTask(PURGE_RUNTIME_TASK_ID);
        return;
    }

    const isRunning = status.phase === "running";
    const subtitle = isRunning
        ? status.currentLabel
            ? `Deleting ${status.currentLabel}`
            : "Purging queued messages"
        : status.phase === "success"
            ? `Deleted ${status.deleted} message${status.deleted === 1 ? "" : "s"}`
            : status.phase === "partial"
                ? `Deleted ${status.deleted}, failed ${status.failed}`
                : status.skipped > 0
                    ? `${status.skipped} protected entr${status.skipped === 1 ? "y skipped" : "ies skipped"}`
                    : "No messages could be deleted";

    const detail = status.total > 0
        ? `${status.processed}/${status.total}`
        : status.deleted > 0
            ? `${status.deleted} deleted`
            : status.failed > 0
                ? `${status.failed} failed`
                : "idle";

    upsertKamidereRuntimeTask({
        id: PURGE_RUNTIME_TASK_ID,
        toolId: "send-trail-purge",
        name: "Send Trail Purge",
        status: isRunning
            ? "running"
            : status.phase === "failure"
                ? "failed"
                : "completed",
        subtitle,
        detail,
        progressCurrent: status.total > 0 ? status.processed : undefined,
        progressTotal: status.total > 0 ? status.total : null,
        startedAt,
    });
}

function shouldIgnoreRecordToggle(target: HTMLElement | null) {
    return !!target?.closest("[data-send-trail-action='true'], button, a, input, textarea, select");
}

function isDirectMessageRecord(record: SentTrailRecord) {
    return record.guildId === "@me";
}

function isRecordProtected(
    record: SentTrailRecord,
    purgeTarget: SendTrailPurgeTarget,
    protectAllDms: boolean,
    protectedDmChannels: Set<string>,
    protectedDmUserIds: Set<string>,
) {
    const isDm = isDirectMessageRecord(record);

    if (purgeTarget === "dms" && !isDm) return true;
    if (purgeTarget === "servers" && isDm) return true;
    if (isDm && protectAllDms) return true;
    if (isDm && protectedDmChannels.has(record.channelId)) return true;
    if (isDm && getRecordRecipientIds(record).some(id => protectedDmUserIds.has(id))) return true;

    return false;
}

function getDefaultAvatarUrl(userId: string) {
    return IconUtils.getDefaultAvatarURL(userId);
}

function buildRecipientIdentityFromUser(
    recipientId: string,
    user: { avatar?: string | null; username?: string; globalName?: string; global_name?: string; },
) {
    const avatarHash = user.avatar;
    const avatarUrl = avatarHash
        ? IconUtils.getUserAvatarURL({ id: recipientId, avatar: avatarHash } as User, true, 80)
        : getDefaultAvatarUrl(recipientId);

    return {
        label: user.globalName || user.global_name || user.username || recipientId,
        details: (user.globalName || user.global_name) && user.username && (user.globalName || user.global_name) !== user.username
            ? `@${user.username}`
            : `User ID ${recipientId}`,
        avatarUrl,
    };
}

function resolveRecipientIdentity(recipientId: string, channel?: ReturnType<typeof ChannelStore.getChannel>) {
    const user = UserStore.getUser(recipientId) as { avatar?: string | null; username?: string; globalName?: string; global_name?: string; } | undefined;
    if (user) {
        return buildRecipientIdentityFromUser(recipientId, user);
    }

    const rawRecipient = (channel as { rawRecipients?: Array<{ id?: string; username?: string; global_name?: string; }>; } | undefined)
        ?.rawRecipients
        ?.find(recipient => recipient?.id === recipientId);

    return {
        label: rawRecipient?.global_name || rawRecipient?.username || recipientId,
        details: rawRecipient?.username && rawRecipient.username !== rawRecipient.global_name
            ? `@${rawRecipient.username}`
            : `User ID ${recipientId}`,
        avatarUrl: getDefaultAvatarUrl(recipientId),
    };
}

function buildDmConversations(records: SentTrailRecord[]) {
    const conversations = new Map<string, DmConversation>();

    for (const record of records) {
        if (!isDirectMessageRecord(record)) continue;

        const context = resolveRecordContext(record);
        const channel = ChannelStore.getChannel(record.channelId);
        const recipientIds = getRecordRecipientIds(record);
        const recipientNames = recipientIds
            .map(id => resolveRecipientIdentity(id, channel).label)
            .filter(Boolean);

        const label = recipientNames[0] ?? context.channelName;
        const details = recipientNames.length > 1
            ? recipientNames.join(", ")
            : context.channelName;

        const existing = conversations.get(record.channelId);
        if (existing) {
            existing.count++;
            continue;
        }

        conversations.set(record.channelId, {
            channelId: record.channelId,
            label,
            details,
            count: 1,
        });
    }

    return Array.from(conversations.values()).sort((left, right) => left.label.localeCompare(right.label));
}

function buildDmUserContacts(
    records: SentTrailRecord[],
    protectedDmUserIds: Set<string>,
    resolvedDmUsers: Record<string, Pick<DmUserContact, "label" | "details" | "avatarUrl">> = {},
) {
    const contacts = new Map<string, DmUserContact>();

    for (const record of records) {
        if (!isDirectMessageRecord(record)) continue;

        const channel = ChannelStore.getChannel(record.channelId);

        for (const recipientId of getRecordRecipientIds(record)) {
            const identity = resolvedDmUsers[recipientId] ?? resolveRecipientIdentity(recipientId, channel);
            const existing = contacts.get(recipientId);

            if (existing) {
                existing.count++;
                if (existing.label === existing.userId && identity.label !== recipientId) {
                    existing.label = identity.label;
                }
                if (existing.details === `User ID ${recipientId}` && identity.details !== existing.details) {
                    existing.details = identity.details;
                }
                continue;
            }

            contacts.set(recipientId, {
                userId: recipientId,
                label: identity.label,
                details: identity.details,
                count: 1,
                avatarUrl: identity.avatarUrl,
            });
        }
    }

    for (const userId of protectedDmUserIds) {
        if (contacts.has(userId)) continue;

        contacts.set(userId, {
            userId,
            label: resolvedDmUsers[userId]?.label ?? userId,
            details: resolvedDmUsers[userId]?.details ?? "Manual user ID rule",
            count: 0,
            avatarUrl: resolvedDmUsers[userId]?.avatarUrl ?? getDefaultAvatarUrl(userId),
        });
    }

    return Array.from(contacts.values()).sort((left, right) =>
        left.label.localeCompare(right.label) || left.userId.localeCompare(right.userId),
    );
}

function MediaPreview({ media }: { media: SentTrailMediaItem[]; }) {
    if (media.length === 0) return null;

    return (
        <div className={cl("preview-grid")}>
            {media.map(item => (
                <div
                    key={`${item.source}:${item.kind}:${item.url}`}
                    className={cl("preview-card")}
                >
                    {item.kind === "image" ? (
                        <img
                            className={cl("preview-image")}
                            src={item.url}
                            alt={item.filename ?? "Sent media"}
                            loading="lazy"
                        />
                    ) : (
                        <video
                            className={cl("preview-video")}
                            src={item.url}
                            autoPlay
                            loop
                            muted
                            preload="metadata"
                            playsInline
                        />
                    )}
                    <span className={cl("preview-caption")}>
                        {item.filename ?? (item.kind === "image" ? "Image" : "Video")}
                    </span>
                </div>
            ))}
        </div>
    );
}

function PurgeStatusBanner({ status }: { status: PurgeStatusState; }) {
    if (status.phase === "idle") return null;

    const isRunning = status.phase === "running";
    const isSuccess = status.phase === "success";
    const isPartial = status.phase === "partial";
    const progress = status.total > 0 ? Math.max(8, Math.round((status.processed / status.total) * 100)) : 0;

    let title = "Preparing purge";
    let subtitle = "Checking the current queue.";

    if (isRunning) {
        title = `Purging ${status.processed}/${status.total}`;
        subtitle = status.currentLabel
            ? `Deleting ${status.currentLabel} one message at a time.`
            : "Deleting queued messages one by one to keep the pace safe.";
    } else if (isSuccess) {
        title = "Purge complete";
        subtitle = `Deleted ${status.deleted} message${status.deleted === 1 ? "" : "s"}${status.skipped ? ` and skipped ${status.skipped} protected entr${status.skipped === 1 ? "y" : "ies"}` : ""}.`;
    } else if (isPartial) {
        title = "Purge finished with some skips";
        subtitle = `Deleted ${status.deleted}, failed ${status.failed}${status.skipped ? `, skipped ${status.skipped} protected` : ""}.`;
    } else {
        title = "Purge could not finish";
        subtitle = `Nothing was deleted${status.skipped ? ` and ${status.skipped} entr${status.skipped === 1 ? "y was" : "ies were"} protected by config` : ""}.`;
    }

    return (
        <div className={cl("purge-status", status.phase)} aria-live="polite">
            <div className={cl("purge-status-icon", isRunning ? "spinning" : status.phase)}>
                {isRunning ? <span className={cl("spinner")} /> : <span className={cl("checkmark")}>OK</span>}
            </div>

            <div className={cl("purge-status-body")}>
                <div className={cl("purge-status-title-row")}>
                    <BaseText size="md" weight="semibold">{title}</BaseText>
                    <span className={cl("meta-tag", "quiet")}>
                        {status.deleted} deleted{status.failed ? ` / ${status.failed} failed` : ""}{status.skipped ? ` / ${status.skipped} skipped` : ""}
                    </span>
                </div>
                <Paragraph className={cl("purge-status-text")}>{subtitle}</Paragraph>
                <div className={cl("purge-progress-track")}>
                    <div className={cl("purge-progress-fill")} style={{ width: `${isRunning ? progress : 100}%` }} />
                </div>
            </div>
        </div>
    );
}

function SendTrailConfigModal({
    modalProps,
    close,
    records,
}: {
    modalProps: ModalProps;
    close(): void;
    records: SentTrailRecord[];
}) {
    const config = settings.use();
    const protectedDmChannels = React.useMemo(() => parseProtectedDmChannels(config.protectedDmChannels), [config.protectedDmChannels]);
    const protectedDmUserIds = React.useMemo(() => parseProtectedDmUserIds(config.protectedDmUserIds), [config.protectedDmUserIds]);
    const dmUserIds = React.useMemo(() =>
        Array.from(new Set([
            ...protectedDmUserIds,
            ...records
                .filter(isDirectMessageRecord)
                .flatMap(record => getRecordRecipientIds(record)),
        ])).sort(),
    [protectedDmUserIds, records]);
    const dmConversations = React.useMemo(() => buildDmConversations(records), [records]);
    const [resolvedDmUsers, setResolvedDmUsers] = React.useState<Record<string, Pick<DmUserContact, "label" | "details" | "avatarUrl">>>({});
    const dmUserContacts = React.useMemo(
        () => buildDmUserContacts(records, protectedDmUserIds, resolvedDmUsers),
        [protectedDmUserIds, records, resolvedDmUsers],
    );
    const [manualProtectedDmUserId, setManualProtectedDmUserId] = React.useState("");
    const requestedDmUsersRef = React.useRef<Set<string>>(new Set());
    const purgeTargetOptions: SelectOption<SendTrailPurgeTarget>[] = [
        { label: "Everything", value: "all" },
        { label: "Direct Messages only", value: "dms" },
        { label: "Servers only", value: "servers" },
    ];

    const updateProtectedDmChannels = React.useCallback((next: Set<string>) => {
        settings.store.protectedDmChannels = Array.from(next).sort().join(",");
    }, []);

    const updateProtectedDmUserIds = React.useCallback((next: Set<string>) => {
        settings.store.protectedDmUserIds = Array.from(next).sort().join(",");
    }, []);

    const toggleProtectedDm = React.useCallback((channelId: string, enabled: boolean) => {
        const next = new Set(protectedDmChannels);
        if (enabled) next.add(channelId);
        else next.delete(channelId);
        updateProtectedDmChannels(next);
    }, [protectedDmChannels, updateProtectedDmChannels]);

    const toggleProtectedDmUser = React.useCallback((userId: string, enabled: boolean) => {
        const next = new Set(protectedDmUserIds);
        if (enabled) next.add(userId);
        else next.delete(userId);
        updateProtectedDmUserIds(next);
    }, [protectedDmUserIds, updateProtectedDmUserIds]);

    const addProtectedDmUser = React.useCallback(() => {
        const normalized = manualProtectedDmUserId.trim();

        if (!/^\d{5,24}$/.test(normalized)) {
            showToast("Enter a numeric Discord user ID to save a friend rule.", Toasts.Type.FAILURE);
            return;
        }

        if (protectedDmUserIds.has(normalized)) {
            showToast("That DM user ID is already protected.", Toasts.Type.FAILURE);
            return;
        }

        const next = new Set(protectedDmUserIds);
        next.add(normalized);
        updateProtectedDmUserIds(next);
        setManualProtectedDmUserId("");
        showToast("Saved permanent DM protection for that user ID.", Toasts.Type.SUCCESS);
    }, [manualProtectedDmUserId, protectedDmUserIds, updateProtectedDmUserIds]);

    React.useEffect(() => {
        let cancelled = false;

        for (const userId of dmUserIds) {
            const cachedUser = UserStore.getUser(userId) as { avatar?: string | null; username?: string; globalName?: string; global_name?: string; } | undefined;
            if (cachedUser?.username) {
                setResolvedDmUsers(current => current[userId]
                    ? current
                    : { ...current, [userId]: buildRecipientIdentityFromUser(userId, cachedUser) });
                continue;
            }

            if (resolvedDmUsers[userId] || requestedDmUsersRef.current.has(userId)) continue;

            requestedDmUsersRef.current.add(userId);
            void UserUtils.getUser(userId)
                .then((user: { avatar?: string | null; username?: string; globalName?: string; global_name?: string; } | null | undefined) => {
                    if (!user || cancelled) return;

                    setResolvedDmUsers(current => ({
                        ...current,
                        [userId]: buildRecipientIdentityFromUser(userId, user),
                    }));
                })
                .catch(() => null);
        }

        return () => {
            cancelled = true;
        };
    }, [dmUserIds, resolvedDmUsers]);

    return (
        <ModalRoot {...modalProps} size={ModalSize.MEDIUM}>
            <ModalHeader separator={false}>
                <BaseText size="lg" weight="semibold" style={{ flexGrow: 1 }}>Purge Config</BaseText>
                <ModalCloseButton onClick={close} />
            </ModalHeader>

            <ModalContent className={cl("config-modal")}>
                <Paragraph className={cl("config-copy")}>
                    These rules decide what the `Purge` action is allowed to delete. Protected direct messages stay in Send Trail until you change the config.
                </Paragraph>

                <div className={cl("config-grid")}>
                    <div className={cl("config-field")}>
                        <span className={cl("field-label")}>Purge Target</span>
                        <Select
                            options={purgeTargetOptions}
                            select={(value: SendTrailPurgeTarget) => settings.store.purgeTarget = value}
                            isSelected={(value: SendTrailPurgeTarget) => value === config.purgeTarget}
                            serialize={(value: SendTrailPurgeTarget) => value}
                        />
                    </div>

                    <div className={cl("config-switch-row")}>
                        <div>
                            <BaseText size="md" weight="semibold">Protect all DMs</BaseText>
                            <Paragraph className={cl("config-hint")}>
                                When enabled, no DM or group DM is ever purged, even if it is selected.
                            </Paragraph>
                        </div>
                        <Switch checked={config.protectAllDms} onChange={value => settings.store.protectAllDms = value} />
                    </div>
                </div>

                <div className={cl("config-list-header")}>
                    <BaseText size="md" weight="semibold">Protected DM conversations</BaseText>
                    {!!protectedDmChannels.size && (
                        <TextButton variant="secondary" onClick={() => settings.store.protectedDmChannels = ""}>
                            Clear protected DM list
                        </TextButton>
                    )}
                </div>

                {dmConversations.length === 0 ? (
                    <Card className={cl("config-empty")} defaultPadding>
                        <Paragraph className={Margins.reset}>
                            No direct-message history has been captured yet. Once you send a DM from this client, it can be protected here.
                        </Paragraph>
                    </Card>
                ) : (
                    <div className={cl("config-list")}>
                        {dmConversations.map(conversation => (
                            <Card key={conversation.channelId} className={cl("config-item")} defaultPadding>
                                <div className={cl("config-item-copy")}>
                                    <BaseText size="md" weight="semibold">{conversation.label}</BaseText>
                                    <Paragraph className={cl("config-hint")}>
                                        {conversation.details} / {conversation.count} saved message{conversation.count === 1 ? "" : "s"}
                                    </Paragraph>
                                </div>
                                <Switch
                                    checked={protectedDmChannels.has(conversation.channelId)}
                                    onChange={value => toggleProtectedDm(conversation.channelId, value)}
                                />
                            </Card>
                        ))}
                    </div>
                )}

                <div className={cl("config-list-header")}>
                    <BaseText size="md" weight="semibold">Always protected DM users</BaseText>
                    {!!protectedDmUserIds.size && (
                        <TextButton variant="secondary" onClick={() => settings.store.protectedDmUserIds = ""}>
                            Clear protected user list
                        </TextButton>
                    )}
                </div>

                <Paragraph className={cl("config-hint")}>
                    Save friends here by user ID and every DM that includes them stays protected from purge.
                </Paragraph>

                <div className={cl("config-manual-row")}>
                    <div className={cl("config-field", "config-manual-field")}>
                        <span className={cl("field-label")}>Discord User ID</span>
                        <TextInput
                            className={cl("config-id-input")}
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            value={manualProtectedDmUserId}
                            placeholder="Add a friend by user ID"
                            onChange={setManualProtectedDmUserId}
                            onKeyDown={event => {
                                if (event.key !== "Enter") return;
                                event.preventDefault();
                                addProtectedDmUser();
                            }}
                            spellCheck={false}
                            maxLength={null}
                        />
                    </div>

                    <Button
                        size="small"
                        variant="secondary"
                        className={cl("config-save-button")}
                        onClick={addProtectedDmUser}
                    >
                        Save Friend
                    </Button>
                </div>

                {dmUserContacts.length === 0 ? (
                    <Card className={cl("config-empty")} defaultPadding>
                        <Paragraph className={Margins.reset}>
                            No DM users are known yet. You can still save a friend manually by Discord user ID above.
                        </Paragraph>
                    </Card>
                ) : (
                    <div className={cl("config-list")}>
                        {dmUserContacts.map(contact => (
                            <Card key={contact.userId} className={cl("config-item")} defaultPadding>
                                <div className={cl("config-user-row")}>
                                    <img
                                        className={cl("config-user-avatar")}
                                        src={contact.avatarUrl}
                                        alt={contact.label}
                                        loading="lazy"
                                    />
                                    <div className={cl("config-item-copy")}>
                                        <BaseText size="md" weight="semibold">{contact.label}</BaseText>
                                        <Paragraph className={cl("config-hint")}>
                                            {contact.details} / User ID {contact.userId}
                                            {contact.count
                                                ? ` / ${contact.count} saved DM message${contact.count === 1 ? "" : "s"}`
                                                : " / no DM history loaded yet"}
                                        </Paragraph>
                                    </div>
                                </div>
                                <Switch
                                    checked={protectedDmUserIds.has(contact.userId)}
                                    onChange={value => toggleProtectedDmUser(contact.userId, value)}
                                />
                            </Card>
                        ))}
                    </div>
                )}
            </ModalContent>

            <ModalFooter>
                <Button variant="secondary" onClick={close}>Close</Button>
            </ModalFooter>
        </ModalRoot>
    );
}

function RecordCard({
    record,
    selected,
    deleting,
    protectedFromPurge,
    onToggleSelected,
}: {
    record: SentTrailRecord;
    selected: boolean;
    deleting: boolean;
    protectedFromPurge: boolean;
    onToggleSelected(): void;
}) {
    const context = resolveRecordContext(record);
    const handleCardClick = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (deleting || shouldIgnoreRecordToggle(event.target as HTMLElement)) return;
        onToggleSelected();
    }, [deleting, onToggleSelected]);

    const handleCardKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
        if (deleting) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        if (shouldIgnoreRecordToggle(event.target as HTMLElement)) return;
        event.preventDefault();
        onToggleSelected();
    }, [deleting, onToggleSelected]);

    return (
        <Card
            className={cl("record-card", selected && "record-card-selected", deleting && "record-card-deleting")}
            defaultPadding
            role="button"
            tabIndex={deleting ? -1 : 0}
            aria-pressed={selected}
            onClick={handleCardClick}
            onKeyDown={handleCardKeyDown}
        >
            <div className={cl("record-header")}>
                <div className={cl("record-meta")}>
                    <div className={cl("record-origin-line")}>
                        <span className={cl("record-scope-label")}>
                            {context.isDirectMessage ? "Direct Messages" : context.guildName}
                        </span>
                        <span className={cl("record-separator")}>/</span>
                        <span className={cl("channel-name")}>
                            {context.isDirectMessage ? context.channelName : `#${context.channelName}`}
                        </span>
                        {protectedFromPurge && (
                            <span className={cl("record-flag")}>Protected</span>
                        )}
                        {selected && (
                            <span className={cl("record-flag", "record-flag-selected")}>Selected</span>
                        )}
                    </div>

                    <Paragraph className={cl("record-timestamp")}>
                        {new Date(record.timestamp).toLocaleString()}
                    </Paragraph>
                </div>
            </div>

            {record.hasText ? (
                <div className={cl("record-message-shell")}>
                    <span className={cl("record-message-label")}>Sent Message</span>
                    <Paragraph className={cl("record-content")}>{record.preview || record.content}</Paragraph>
                </div>
            ) : (
                <Paragraph className={cl("record-muted")}>
                    This entry is media-only. Use the preview below to inspect what was sent.
                </Paragraph>
            )}

            <MediaPreview media={record.media} />

            <div className={cl("record-footer")}>
                <span className={cl("record-time")}>{formatTime(record.timestamp)}</span>

                <div className={cl("record-buttons")}>
                    <TextButton
                        variant="secondary"
                        className={cl("record-open-button")}
                        data-send-trail-action="true"
                        onClick={event => {
                            event.stopPropagation();
                            NavigationRouter.transitionTo(record.jumpLink);
                        }}
                    >
                        <OpenExternalIcon className={cl("record-open-icon")} width={14} height={14} />
                        <span>Open Message</span>
                    </TextButton>
                </div>
            </div>
        </Card>
    );
}

function PaginationChevron({ direction, double = false }: { direction: "left" | "right"; double?: boolean; }) {
    return (
        <span
            className={cl(
                "pagination-nav-glyph",
                direction === "left" ? "pagination-nav-left" : "pagination-nav-right",
                double && "pagination-nav-double",
            )}
            aria-hidden="true"
        >
            <span className={cl("pagination-nav-chevron")} />
            {double && <span className={cl("pagination-nav-chevron")} />}
        </span>
    );
}

function PaginationNavButton({
    direction,
    double = false,
    disabled,
    label,
    onClick,
}: {
    direction: "left" | "right";
    double?: boolean;
    disabled: boolean;
    label: string;
    onClick(): void;
}) {
    return (
        <button
            type="button"
            className={cl("pagination-nav-button")}
            disabled={disabled}
            aria-label={label}
            title={label}
            onClick={onClick}
        >
            <PaginationChevron direction={direction} double={double} />
        </button>
    );
}

function getScrollContainer(node: HTMLElement | null): HTMLElement | Window {
    let current = node?.parentElement ?? null;

    while (current) {
        const style = window.getComputedStyle(current);
        const { overflowY } = style;

        if ((overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") && current.scrollHeight > current.clientHeight) {
            return current;
        }

        current = current.parentElement;
    }

    return window;
}

function SendTrailTab() {
    const currentUserId = useStateFromStores([UserStore], () => UserStore.getCurrentUser()?.id ?? null);
    const [records, pending] = useSentTrailRecords(currentUserId);
    const purgeConfig = settings.use();
    const protectedDmChannels = React.useMemo(
        () => parseProtectedDmChannels(purgeConfig.protectedDmChannels),
        [purgeConfig.protectedDmChannels],
    );
    const protectedDmUserIds = React.useMemo(
        () => parseProtectedDmUserIds(purgeConfig.protectedDmUserIds),
        [purgeConfig.protectedDmUserIds],
    );
    const purgeTarget = purgeConfig.purgeTarget as SendTrailPurgeTarget;

    const [scope, setScope] = React.useState<ScopeValue>("all");
    const [kind, setKind] = React.useState<KindValue>("all");
    const [period, setPeriod] = React.useState<PeriodValue>("all");
    const [pageSize, setPageSize] = React.useState<PageSizeValue>(DEFAULT_PAGE_SIZE);
    const [currentPage, setCurrentPage] = React.useState(1);
    const [query, setQuery] = React.useState("");
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
    const [deletingIds, setDeletingIds] = React.useState<Set<string>>(() => new Set());
    const [purgeStatus, setPurgeStatus] = React.useState<PurgeStatusState>(makeEmptyPurgeStatus);
    const [renderedPurgeStatus, setRenderedPurgeStatus] = React.useState<PurgeStatusState>(makeEmptyPurgeStatus);
    const [isPurgeStatusVisible, setIsPurgeStatusVisible] = React.useState(false);
    const purgeStatusTimerRef = React.useRef<number | null>(null);
    const purgeStatusExitTimerRef = React.useRef<number | null>(null);
    const purgeStatusFrameRef = React.useRef<number | null>(null);
    const purgeRuntimeTimerRef = React.useRef<number | null>(null);
    const purgeRuntimeStartedAtRef = React.useRef<number | null>(null);
    const isMountedRef = React.useRef(true);
    const historyFooterRef = React.useRef<HTMLDivElement | null>(null);
    const keepFooterVisibleRef = React.useRef(false);

    React.useEffect(() => {
        return () => {
            isMountedRef.current = false;
            if (purgeStatusTimerRef.current) {
                window.clearTimeout(purgeStatusTimerRef.current);
            }
            if (purgeStatusExitTimerRef.current) {
                window.clearTimeout(purgeStatusExitTimerRef.current);
            }
            if (purgeStatusFrameRef.current) {
                window.cancelAnimationFrame(purgeStatusFrameRef.current);
            }
        };
    }, []);

    const clearPurgeRuntimeTask = React.useCallback((delayMs = 0) => {
        if (purgeRuntimeTimerRef.current) {
            window.clearTimeout(purgeRuntimeTimerRef.current);
            purgeRuntimeTimerRef.current = null;
        }

        if (delayMs <= 0) {
            return;
        }

        if (delayMs > 0) {
            purgeRuntimeTimerRef.current = window.setTimeout(() => {
                removeKamidereRuntimeTask(PURGE_RUNTIME_TASK_ID);
                purgeRuntimeStartedAtRef.current = null;
                purgeRuntimeTimerRef.current = null;
            }, delayMs);
        }
    }, []);

    React.useEffect(() => {
        const recordIds = new Set(records.map(record => record.id));
        setSelectedIds(current => {
            const next = new Set(Array.from(current).filter(id => recordIds.has(id)));
            return next.size === current.size ? current : next;
        });
    }, [records]);

    React.useEffect(() => {
        if (purgeStatus.phase === "running" || purgeStatus.phase === "idle") return;

        if (purgeStatusTimerRef.current) {
            window.clearTimeout(purgeStatusTimerRef.current);
        }

        purgeStatusTimerRef.current = window.setTimeout(() => {
            setPurgeStatus(makeEmptyPurgeStatus());
            purgeStatusTimerRef.current = null;
        }, PURGE_STATUS_HIDE_DELAY_MS);
    }, [purgeStatus]);

    React.useEffect(() => {
        if (purgeStatus.phase !== "idle") {
            if (purgeStatusExitTimerRef.current) {
                window.clearTimeout(purgeStatusExitTimerRef.current);
                purgeStatusExitTimerRef.current = null;
            }
            if (purgeStatusFrameRef.current) {
                window.cancelAnimationFrame(purgeStatusFrameRef.current);
            }

            setRenderedPurgeStatus(purgeStatus);
            purgeStatusFrameRef.current = window.requestAnimationFrame(() => {
                setIsPurgeStatusVisible(true);
                purgeStatusFrameRef.current = null;
            });
            return;
        }

        if (renderedPurgeStatus.phase === "idle") return;

        if (purgeStatusFrameRef.current) {
            window.cancelAnimationFrame(purgeStatusFrameRef.current);
            purgeStatusFrameRef.current = null;
        }

        setIsPurgeStatusVisible(false);

        if (purgeStatusExitTimerRef.current) {
            window.clearTimeout(purgeStatusExitTimerRef.current);
        }

        purgeStatusExitTimerRef.current = window.setTimeout(() => {
            setRenderedPurgeStatus(makeEmptyPurgeStatus());
            purgeStatusExitTimerRef.current = null;
        }, PURGE_STATUS_TRANSITION_MS);
    }, [purgeStatus, renderedPurgeStatus.phase]);

    const updateDeletingId = React.useCallback((recordId: string, active: boolean) => {
        setDeletingIds(current => {
            const next = new Set(current);
            if (active) next.add(recordId);
            else next.delete(recordId);
            return next;
        });
    }, []);

    const publishPurgeRuntimeStatus = React.useCallback((status: PurgeStatusState, startedAt?: number) => {
        const effectiveStartedAt = startedAt ?? purgeRuntimeStartedAtRef.current ?? Date.now();
        purgeRuntimeStartedAtRef.current = effectiveStartedAt;

        syncPurgeRuntimeTask(status, effectiveStartedAt);

        if (status.phase === "running") {
            clearPurgeRuntimeTask();
            return;
        }

        clearPurgeRuntimeTask(PURGE_STATUS_HIDE_DELAY_MS + PURGE_STATUS_TRANSITION_MS);
    }, [clearPurgeRuntimeTask]);

    const applyPurgeStatus = React.useCallback((status: PurgeStatusState, startedAt?: number) => {
        publishPurgeRuntimeStatus(status, startedAt);

        if (isMountedRef.current) {
            setPurgeStatus(status);
        }
    }, [publishPurgeRuntimeStatus]);

    const scopeOptions = React.useMemo<SelectOption<ScopeValue>[]>(() => {
        const guilds = new Map<string, string>();

        for (const record of records) {
            if (record.guildId === "@me") continue;

            const context = resolveRecordContext(record);
            guilds.set(record.guildId, context.guildName);
        }

        const guildEntries = Array.from(guilds.entries())
            .sort((left, right) => left[1].localeCompare(right[1]))
            .map(([guildId, name]) => ({
                label: name,
                value: `guild:${guildId}` as ScopeValue,
            }));

        return [
            { label: "All destinations", value: "all" },
            { label: "Direct Messages", value: "dms" },
            ...guildEntries,
        ];
    }, [records]);

    const periodOptions: SelectOption<PeriodValue>[] = [
        { label: "All time", value: "all" },
        { label: "Last 24 hours", value: "24h" },
        { label: "Last 7 days", value: "7d" },
    ];

    const kindOptions: SelectOption<KindValue>[] = [
        { label: "Everything", value: "all" },
        { label: "Text only", value: "text" },
        { label: "Media only", value: "media" },
    ];

    const pageSizeOptions: SelectOption<PageSizeValue>[] = [
        { label: "5", value: "5" },
        { label: "10", value: "10" },
        { label: "20", value: "20" },
        { label: "30", value: "30" },
        { label: "50", value: "50" },
    ];

    const filteredRecords = React.useMemo(() => {
        const search = query.trim().toLowerCase();
        const cutoff = period === "24h"
            ? Date.now() - 24 * 60 * 60 * 1000
            : period === "7d"
                ? Date.now() - 7 * 24 * 60 * 60 * 1000
                : 0;

        return records.filter(record => {
            if (!recordMatchesScope(record, scope)) return false;
            if (kind === "text" && !record.hasText) return false;
            if (kind === "media" && !record.hasMedia) return false;
            if (cutoff && record.timestamp < cutoff) return false;
            if (search && !buildSearchIndex(record).includes(search)) return false;
            return true;
        });
    }, [kind, period, query, records, scope]);

    const pageSizeNumber = Number(pageSize);
    const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSizeNumber));
    const pageStartIndex = (currentPage - 1) * pageSizeNumber;

    React.useEffect(() => {
        setCurrentPage(1);
    }, [kind, pageSize, period, query, scope]);

    React.useEffect(() => {
        if (currentPage <= totalPages) return;
        setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

    React.useEffect(() => {
        if (!keepFooterVisibleRef.current) return;

        keepFooterVisibleRef.current = false;
        const footer = historyFooterRef.current;
        if (!footer) return;

        window.requestAnimationFrame(() => {
            const scrollContainer = getScrollContainer(footer);
            const margin = 20;

            if (scrollContainer === window) {
                const rect = footer.getBoundingClientRect();
                const overflow = rect.bottom - (window.innerHeight - margin);
                if (overflow > 0) {
                    window.scrollBy({
                        top: overflow,
                        behavior: "smooth",
                    });
                }
                return;
            }

            const container = scrollContainer as HTMLElement;
            const footerRect = footer.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const overflow = footerRect.bottom - (containerRect.bottom - margin);

            if (overflow > 0) {
                container.scrollBy({
                    top: overflow,
                    behavior: "smooth",
                });
            }
        });
    }, [currentPage, pageSize]);

    const pagedRecords = React.useMemo(
        () => filteredRecords.slice(pageStartIndex, pageStartIndex + pageSizeNumber),
        [filteredRecords, pageSizeNumber, pageStartIndex],
    );

    const groupedRecords = React.useMemo<RecordGroup[]>(() => {
        const groups = new Map<string, SentTrailRecord[]>();

        for (const record of pagedRecords) {
            const label = formatDayLabel(record.timestamp);
            const existing = groups.get(label);
            if (existing) existing.push(record);
            else groups.set(label, [record]);
        }

        return Array.from(groups.entries()).map(([label, grouped]) => ({
            label,
            records: grouped,
        }));
    }, [pagedRecords]);

    const selectedRecords = React.useMemo(
        () => records.filter(record => selectedIds.has(record.id)),
        [records, selectedIds],
    );

    const purgeActionRecords = React.useMemo(
        () => selectedRecords.length > 0 ? selectedRecords : filteredRecords,
        [filteredRecords, selectedRecords],
    );
    const purgeActionEligibleRecords = React.useMemo(
        () => purgeActionRecords.filter(record => !isRecordProtected(record, purgeTarget, purgeConfig.protectAllDms, protectedDmChannels, protectedDmUserIds)),
        [protectedDmChannels, protectedDmUserIds, purgeActionRecords, purgeConfig.protectAllDms, purgeTarget],
    );

    const dmConversationCount = React.useMemo(() => buildDmConversations(records).length, [records]);
    const isBusy = purgeStatus.phase === "running";
    const shouldHideLoadingState = isBusy || deletingIds.size > 0 || renderedPurgeStatus.phase !== "idle";
    const scopeLabel = scopeOptions.find(option => option.value === scope)?.label ?? "All destinations";
    const kindLabel = kindOptions.find(option => option.value === kind)?.label ?? "Everything";
    const periodLabel = periodOptions.find(option => option.value === period)?.label ?? "All time";
    const pageRangeStart = filteredRecords.length === 0 ? 0 : pageStartIndex + 1;
    const pageRangeEnd = filteredRecords.length === 0 ? 0 : Math.min(filteredRecords.length, pageStartIndex + pageSizeNumber);
    const purgeActionLabel = selectedRecords.length > 0 ? "Purge Selected" : "Purge All";

    const changePage = React.useCallback((nextPage: number) => {
        keepFooterVisibleRef.current = true;
        setCurrentPage(Math.max(1, Math.min(totalPages, nextPage)));
    }, [totalPages]);

    const changePageSize = React.useCallback((nextPageSize: PageSizeValue) => {
        keepFooterVisibleRef.current = true;
        setPageSize(nextPageSize);
    }, []);

    const toggleRecordSelection = React.useCallback((recordId: string) => {
        setSelectedIds(current => {
            const next = new Set(current);
            if (next.has(recordId)) next.delete(recordId);
            else next.add(recordId);
            return next;
        });
    }, []);

    const openConfigModal = React.useCallback(() => {
        const modalKey = openModal(modalProps => (
            <SendTrailConfigModal
                modalProps={modalProps}
                close={() => closeModal(modalKey)}
                records={records}
            />
        ));
    }, [records]);

    const runPurge = React.useCallback(async (targetRecords: SentTrailRecord[]) => {
        if (!currentUserId || targetRecords.length === 0) return;

        if (purgeStatusTimerRef.current) {
            window.clearTimeout(purgeStatusTimerRef.current);
            purgeStatusTimerRef.current = null;
        }
        if (purgeRuntimeTimerRef.current) {
            window.clearTimeout(purgeRuntimeTimerRef.current);
            purgeRuntimeTimerRef.current = null;
        }

        const eligibleRecords = targetRecords.filter(record =>
            !isRecordProtected(record, purgeTarget, purgeConfig.protectAllDms, protectedDmChannels, protectedDmUserIds),
        );
        const skipped = targetRecords.length - eligibleRecords.length;
        const startedAt = Date.now();
        purgeRuntimeStartedAtRef.current = startedAt;

        if (eligibleRecords.length === 0) {
            const nextStatus = {
                phase: "failure",
                total: 0,
                processed: 0,
                deleted: 0,
                failed: 0,
                skipped,
                currentLabel: undefined,
            } satisfies PurgeStatusState;
            applyPurgeStatus(nextStatus, startedAt);
            showToast("Nothing in the current purge target is allowed by your purge config.", Toasts.Type.FAILURE);
            return;
        }

        let deleted = 0;
        let failed = 0;

        const runningStatus = {
            phase: "running",
            total: eligibleRecords.length,
            processed: 0,
            deleted: 0,
            failed: 0,
            skipped,
            currentLabel: undefined,
        } satisfies PurgeStatusState;
        applyPurgeStatus(runningStatus, startedAt);

        for (const [index, record] of eligibleRecords.entries()) {
            const context = resolveRecordContext(record);
            const currentLabel = context.isDirectMessage ? context.channelName : `#${context.channelName}`;

            updateDeletingId(record.id, true);
            const currentStatus = {
                phase: "running",
                total: eligibleRecords.length,
                processed: index,
                deleted,
                failed,
                skipped,
                currentLabel,
            } satisfies PurgeStatusState;
            applyPurgeStatus(currentStatus, startedAt);

            try {
                await MessageActions.deleteMessage(record.channelId, record.messageId);
                await removeSentTrailRecord(currentUserId, record.channelId, record.messageId);

                deleted++;
                setSelectedIds(current => {
                    if (!current.has(record.id)) return current;
                    const next = new Set(current);
                    next.delete(record.id);
                    return next;
                });
            } catch (error) {
                failed++;
            } finally {
                updateDeletingId(record.id, false);
                const progressStatus = {
                    phase: "running",
                    total: eligibleRecords.length,
                    processed: index + 1,
                    deleted,
                    failed,
                    skipped,
                    currentLabel,
                } satisfies PurgeStatusState;
                applyPurgeStatus(progressStatus, startedAt);
            }

            if (index < eligibleRecords.length - 1) {
                await sleep(LIVE_DELETE_DELAY_MS);
            }
        }

        const phase: PurgeStatusPhase = failed === 0
            ? "success"
            : deleted > 0
                ? "partial"
                : "failure";

        const finishedStatus = {
            phase,
            total: eligibleRecords.length,
            processed: eligibleRecords.length,
            deleted,
            failed,
            skipped,
            currentLabel: undefined,
        } satisfies PurgeStatusState;
        applyPurgeStatus(finishedStatus, startedAt);

        if (phase === "success") {
            showToast(`Purged ${deleted} message${deleted === 1 ? "" : "s"} from Discord.`, Toasts.Type.SUCCESS);
        } else if (phase === "partial") {
            showToast(`Purged ${deleted} message${deleted === 1 ? "" : "s"}, but ${failed} failed.`, Toasts.Type.FAILURE);
        } else {
            showToast("No selected messages could be purged from Discord.", Toasts.Type.FAILURE);
        }
    }, [applyPurgeStatus, currentUserId, protectedDmChannels, protectedDmUserIds, purgeConfig.protectAllDms, purgeTarget, updateDeletingId]);

    const confirmPurge = React.useCallback(() => {
        if (purgeActionRecords.length === 0) return;

        const isSelectionPurge = selectedRecords.length > 0;
        const eligibleCount = purgeActionEligibleRecords.length;
        const skippedCount = purgeActionRecords.length - eligibleCount;
        const targetLabel = isSelectionPurge ? "selected" : "matching";

        Alerts.show({
            title: `Purge ${purgeActionRecords.length} ${targetLabel} message${purgeActionRecords.length === 1 ? "" : "s"}?`,
            body: eligibleCount === 0
                ? "Everything in the current purge target is currently protected by your purge config."
                : `Send Trail will delete ${eligibleCount} ${targetLabel} message${eligibleCount === 1 ? "" : "s"} from Discord one by one.${skippedCount ? ` ${skippedCount} ${targetLabel} entr${skippedCount === 1 ? "y is" : "ies are"} protected by config and will be skipped.` : ""}`,
            confirmText: "Start Purge",
            cancelText: "Cancel",
            async onConfirm() {
                await runPurge(purgeActionRecords);
            },
        });
    }, [purgeActionEligibleRecords.length, purgeActionRecords, runPurge, selectedRecords.length]);

    const confirmLocalClear = React.useCallback(() => {
        Alerts.show({
            title: "Clear local Send Trail history?",
            body: `This removes ${records.length} saved entr${records.length === 1 ? "y" : "ies"} from Send Trail only. It will not delete anything from Discord itself.`,
            confirmText: "Clear Local History",
            cancelText: "Cancel",
            async onConfirm() {
                await clearSentTrailRecords(currentUserId);
                setSelectedIds(new Set());
                showToast("Cleared local Send Trail history.", Toasts.Type.SUCCESS);
            },
        });
    }, [currentUserId, records.length]);

    return (
        <SettingsTab>
            <SpecialCard
                title="Send Trail"
                subtitle="Selective outbound purge"
                description={`Track what you send from ${BRAND_NAME}, choose exactly which messages should go, and purge them one by one without losing control of DMs or protected conversations.`}
                cardImage={BRAND_ICON_DATA_URL}
                backgroundImage={HERO_BACKGROUND}
                backgroundColor="#27221d"
            >
                <div className={cl("hero-metrics")}>
                    <span className={cl("hero-tag")}>{records.length} tracked</span>
                    <span className={cl("hero-tag")}>{filteredRecords.length} visible</span>
                    <span className={cl("hero-tag")}>{selectedRecords.length} selected</span>
                    <span className={cl("hero-tag")}>{dmConversationCount} DM threads known</span>
                </div>
            </SpecialCard>

            <Notice.Info className={Margins.top20} style={{ width: "100%" }}>
                Send Trail is local to this device. `Purge` deletes the real Discord messages one by one, while `Clear Local History` only removes the saved index shown here.
            </Notice.Info>

            <Heading className={Margins.top20}>History</Heading>
            <Card className={cl("history-shell")} defaultPadding>
                <div className={cl("history-shell-header")}>
                    <div className={cl("history-shell-copy")}>
                        <HeadingTertiary className={Margins.reset}>Sent Messages</HeadingTertiary>
                        <Paragraph className={cl("history-subtitle")}>
                            Review your global send history, narrow it down, and purge the exact set you want.
                        </Paragraph>
                    </div>
                </div>

                <div className={cl("history-filter-surface")}>
                    <div className={cl("history-filter-header")}>
                        <div className={cl("history-filter-meta")}>
                            <Paragraph className={cl("history-summary")}>
                                {scopeLabel} / {kindLabel} / {periodLabel}
                            </Paragraph>
                            <Paragraph className={cl("history-summary")}>
                                Purge target: {purgeTarget === "all" ? "everything" : purgeTarget === "dms" ? "DMs only" : "servers only"}
                                {purgeConfig.protectAllDms ? " / all DMs protected" : ""}
                                {protectedDmChannels.size ? ` / ${protectedDmChannels.size} DM thread${protectedDmChannels.size === 1 ? "" : "s"} protected` : ""}
                                {protectedDmUserIds.size ? ` / ${protectedDmUserIds.size} DM user${protectedDmUserIds.size === 1 ? "" : "s"} protected` : ""}
                            </Paragraph>
                        </div>

                    </div>

                    <div className={cl("toolbar-grid")}>
                        <div className={cl("toolbar-field")}>
                            <Paragraph className={cl("field-label")}>Destination</Paragraph>
                            <Select
                                options={scopeOptions}
                                select={(value: ScopeValue) => setScope(value)}
                                isSelected={(value: ScopeValue) => scope === value}
                                serialize={(value: ScopeValue) => value}
                                isDisabled={isBusy}
                            />
                        </div>

                        <div className={cl("toolbar-field")}>
                            <Paragraph className={cl("field-label")}>Content Type</Paragraph>
                            <Select
                                options={kindOptions}
                                select={(value: KindValue) => setKind(value)}
                                isSelected={(value: KindValue) => kind === value}
                                serialize={(value: KindValue) => value}
                                isDisabled={isBusy}
                            />
                        </div>

                        <div className={cl("toolbar-field")}>
                            <Paragraph className={cl("field-label")}>Period</Paragraph>
                            <Select
                                options={periodOptions}
                                select={(value: PeriodValue) => setPeriod(value)}
                                isSelected={(value: PeriodValue) => period === value}
                                serialize={(value: PeriodValue) => value}
                                isDisabled={isBusy}
                            />
                        </div>

                    </div>

                </div>

                <div className={cl("history-actions-row")}>
                    <label className={cl("search-shell", "history-search-shell")}>
                        <MagnifyingGlassIcon className={cl("search-icon")} width={16} height={16} />
                        <input
                            className={cl("search-input")}
                            type="text"
                            autoComplete="off"
                            value={query}
                            placeholder="Search messages, channels, servers, or media"
                            onChange={event => setQuery(event.currentTarget.value)}
                            disabled={isBusy}
                            spellCheck={false}
                            aria-label="Search sent messages"
                        />
                    </label>

                    <div className={cl("history-actions-buttons")}>
                        <Button
                            size="iconOnly"
                            variant="secondary"
                            className={cl("action-icon-button")}
                            disabled={isBusy}
                            onClick={openConfigModal}
                            title="Open purge config"
                            aria-label="Open purge config"
                        >
                            <CogWheel width={16} height={16} />
                        </Button>
                        <Button
                            size="xs"
                            variant="dangerPrimary"
                            className={cl("action-button", "action-button-purge")}
                            disabled={purgeActionRecords.length === 0 || isBusy}
                            onClick={confirmPurge}
                        >
                            <DeleteIcon width={13} height={13} />
                            <span>{purgeActionLabel}</span>
                        </Button>
                    </div>
                </div>

                <div
                    className={cl(
                        "purge-status-region",
                        renderedPurgeStatus.phase !== "idle" ? "purge-status-region-mounted" : "purge-status-region-empty",
                        isPurgeStatusVisible ? "purge-status-region-visible" : "purge-status-region-hidden",
                    )}
                >
                    {renderedPurgeStatus.phase !== "idle" && (
                        <PurgeStatusBanner status={renderedPurgeStatus} />
                    )}
                </div>

                <div className={cl("history-list")}>
                    {pending && !shouldHideLoadingState && (
                        <Card className={cl("empty-card")} defaultPadding>
                            <LogIcon className={cl("empty-icon")} />
                            <HeadingTertiary>Loading Send Trail history...</HeadingTertiary>
                        </Card>
                    )}

                    {!pending && records.length === 0 && (
                        <Card className={cl("empty-card")} defaultPadding>
                            <LogIcon className={cl("empty-icon")} />
                            <HeadingTertiary>No saved sends yet</HeadingTertiary>
                            <Paragraph>
                                Send a message, image, GIF, video, or direct media link from this client and it will start appearing here.
                            </Paragraph>
                        </Card>
                    )}

                    {!pending && records.length > 0 && filteredRecords.length === 0 && (
                        <Card className={cl("empty-card")} defaultPadding>
                            <LogIcon className={cl("empty-icon")} />
                            <HeadingTertiary>No results match this view</HeadingTertiary>
                            <Paragraph>
                                Broaden the destination, type, period, or search query to bring more sent messages into view.
                            </Paragraph>
                        </Card>
                    )}

                    {groupedRecords.map(group => (
                        <div key={group.label} className={cl("group")}>
                            <div className={cl("group-header")}>
                                <HeadingTertiary className={Margins.reset}>{group.label}</HeadingTertiary>
                                <span className={cl("group-count")}>
                                    {group.records.length} entr{group.records.length === 1 ? "y" : "ies"}
                                </span>
                            </div>

                            <div className={cl("group-list")}>
                                {group.records.map(record => (
                                    <RecordCard
                                        key={record.id}
                                        record={record}
                                        selected={selectedIds.has(record.id)}
                                        deleting={deletingIds.has(record.id)}
                                        protectedFromPurge={isRecordProtected(record, purgeTarget, purgeConfig.protectAllDms, protectedDmChannels, protectedDmUserIds)}
                                        onToggleSelected={() => toggleRecordSelection(record.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div ref={historyFooterRef} className={cl("history-footer")}>
                    <div className={cl("history-footer-main")}>
                        <span className={cl("pagination-summary")}>
                            Showing {pageRangeStart}-{pageRangeEnd} from {filteredRecords.length}
                        </span>

                        <div className={cl("pagination-center")}>
                            <PaginationNavButton
                                direction="left"
                                double
                                disabled={currentPage <= 1 || filteredRecords.length === 0 || isBusy}
                                label="First page"
                                onClick={() => changePage(1)}
                            />
                            <PaginationNavButton
                                direction="left"
                                disabled={currentPage <= 1 || filteredRecords.length === 0 || isBusy}
                                label="Previous page"
                                onClick={() => changePage(currentPage - 1)}
                            />

                            <span className={cl("pagination-page-chip")}>{currentPage}</span>
                            <span className={cl("pagination-of-label")}>of {totalPages}</span>

                            <PaginationNavButton
                                direction="right"
                                disabled={currentPage >= totalPages || filteredRecords.length === 0 || isBusy}
                                label="Next page"
                                onClick={() => changePage(currentPage + 1)}
                            />
                            <PaginationNavButton
                                direction="right"
                                double
                                disabled={currentPage >= totalPages || filteredRecords.length === 0 || isBusy}
                                label="Last page"
                                onClick={() => changePage(totalPages)}
                            />
                        </div>

                        <div className={cl("pagination-page-size")}>
                            <span className={cl("pagination-page-size-label")}>Rows per page:</span>
                            <div className={cl("pagination-page-size-select")}>
                                <Select
                                    className={cl("pagination-page-size-control")}
                                    options={pageSizeOptions}
                                    select={changePageSize}
                                    isSelected={(value: PageSizeValue) => pageSize === value}
                                    serialize={(value: PageSizeValue) => value}
                                    isDisabled={isBusy || filteredRecords.length === 0}
                                />
                            </div>
                        </div>
                    </div>

                    <div className={cl("history-footer-secondary")}>
                        <Paragraph className={cl("history-summary")}>
                            Local only. Purge deletes live Discord messages one by one.
                        </Paragraph>

                        <TextButton
                            variant="secondary"
                            className={cl("history-footer-clear")}
                            disabled={records.length === 0 || isBusy}
                            onClick={confirmLocalClear}
                        >
                            Clear Local History
                        </TextButton>
                    </div>
                </div>
            </Card>
        </SettingsTab>
    );
}

export default wrapTab(SendTrailTab, "Send Trail");
