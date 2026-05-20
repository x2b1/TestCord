/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { Button, TextButton } from "@components/Button";
import { Card } from "@components/Card";
import { Heading, HeadingTertiary } from "@components/Heading";
import { ClockIcon, CogWheel, ComponentsIcon, LogIcon, MagnifyingGlassIcon, Microphone } from "@components/Icons";
import { Notice } from "@components/Notice";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab, wrapTab } from "@components/settings";
import { SpecialCard } from "@components/settings/SpecialCard";
import { Switch } from "@components/Switch";
import { classNameFactory } from "@utils/css";
import { Margins } from "@utils/margins";
import { Alerts, React, Select, showToast,Toasts, UserStore, UserUtils } from "@webpack/common";

import { BRAND_ICON_DATA_URL, BRAND_NAME } from "../_kamidereCompat/branding";
import {
    addPresenceLabOperator,
    addPresenceLabSession,
    addPresenceLabTarget,
    clearPresenceLabData,
    getPresenceLabCurrentUserId,
    removePresenceLabOperator,
    removePresenceLabSession,
    removePresenceLabTarget,
    updatePresenceLabConfig,
    updatePresenceLabTargetState,
    usePresenceLabData,
} from "./store";
import type { PresenceLabIdentitySource, PresenceLabSessionOutcome } from "./types";
import {
    buildIdentityFromUser,
    buildManualIdentity,
    buildPresenceLabOverview,
    formatDateTime,
    formatDurationMinutes,
    formatInputDateTime,
    formatRelativeDay,
    getGuildLabel,
    getOperatorPlaceholderNote,
    getTargetPlaceholderNote,
    groupSessionsByDay,
    makeLocalId,
} from "./utils";

const cl = classNameFactory("vc-presence-lab-");

const HERO_BACKGROUND = `data:image/svg+xml;utf8,${encodeURIComponent(
    [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 620">',
        "<defs>",
        '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">',
        '<stop stop-color="#10131b"/>',
        '<stop offset="0.42" stop-color="#182331"/>',
        '<stop offset="1" stop-color="#2d2b24"/>',
        "</linearGradient>",
        "</defs>",
        '<rect width="1200" height="620" fill="url(#g)"/>',
        '<circle cx="915" cy="150" r="160" fill="#F1B766" opacity=".10"/>',
        '<circle cx="250" cy="470" r="210" fill="#78A9D4" opacity=".10"/>',
        '<path d="M0 460C114 389 265 355 420 382s278 60 452 20 250-31 328 38V620H0Z" fill="#0B0F14" opacity=".75"/>',
        '<path d="M140 70 712 612" stroke="#FBE0B5" stroke-opacity=".06" stroke-width="30"/>',
        '<path d="M500 -40 1080 540" stroke="#8DB7D8" stroke-opacity=".06" stroke-width="16"/>',
        "</svg>",
    ].join(""),
)}`;

type Option<T extends string> = {
    label: string;
    value: T;
};

function clampNumber(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function normalizeUserId(value: string) {
    return value.trim();
}

function formatSecondsLabel(seconds: number) {
    if (seconds < 60) return `${seconds}s`;

    const wholeMinutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return remainder ? `${wholeMinutes}m ${remainder}s` : `${wholeMinutes}m`;
}

function renderSourceLabel(source: PresenceLabIdentitySource) {
    switch (source) {
        case "current":
            return "Current account";
        case "resolved":
            return "Resolved profile";
        default:
            return "Manual local profile";
    }
}

function GaugeCard({
    title,
    value,
    subtitle,
    accent,
}: {
    title: string;
    value: number;
    subtitle: string;
    accent: string;
}) {
    const percent = Math.round(clampNumber(value, 0, 1) * 100);
    return (
        <Card
            className={cl("gauge-card")}
            style={{
                "--presence-lab-gauge-value": `${percent}%`,
                "--presence-lab-gauge-accent": accent,
            } as React.CSSProperties}
        >
            <div className={cl("gauge-ring")}>
                <div className={cl("gauge-ring-inner")}>
                    <span className={cl("gauge-value")}>{percent}%</span>
                </div>
            </div>

            <div className={cl("gauge-copy")}>
                <Paragraph className={cl("gauge-label")}>{title}</Paragraph>
                <HeadingTertiary className={Margins.reset}>{subtitle}</HeadingTertiary>
            </div>
        </Card>
    );
}

function MetricCard({
    label,
    value,
    hint,
}: {
    label: string;
    value: string;
    hint: string;
}) {
    return (
        <Card className={cl("metric-card")}>
            <Paragraph className={cl("metric-label")}>{label}</Paragraph>
            <Heading className={cl("metric-value")} tag="h4">{value}</Heading>
            <Paragraph className={cl("metric-hint")}>{hint}</Paragraph>
        </Card>
    );
}

function ActivityStrip({
    buckets,
}: {
    buckets: ReturnType<typeof buildPresenceLabOverview>["weeklyBuckets"];
}) {
    const max = Math.max(1, ...buckets.map(bucket => bucket.minutes));

    return (
        <Card className={cl("strip-card")}>
            <div className={cl("strip-header")}>
                <HeadingTertiary className={Margins.reset}>Weekly Activity</HeadingTertiary>
                <Paragraph className={cl("strip-copy")}>Last seven days of locally logged call minutes.</Paragraph>
            </div>

            <div className={cl("strip-bars")}>
                {buckets.map(bucket => (
                    <div key={bucket.key} className={cl("strip-column")}>
                        <span className={cl("strip-value")}>{bucket.minutes || 0}m</span>
                        <div className={cl("strip-track")}>
                            <div
                                className={cl("strip-fill")}
                                style={{ height: `${Math.max(10, Math.round((bucket.minutes / max) * 100))}%` }}
                            />
                        </div>
                        <span className={cl("strip-label")}>{bucket.label}</span>
                    </div>
                ))}
            </div>
        </Card>
    );
}

function PairList({
    pairs,
}: {
    pairs: ReturnType<typeof buildPresenceLabOverview>["pairStats"];
}) {
    return (
        <Card className={cl("pair-card")}>
            <div className={cl("pair-header")}>
                <HeadingTertiary className={Margins.reset}>Top Interaction Pairs</HeadingTertiary>
                <Paragraph className={cl("strip-copy")}>Which operator-target combinations have the most local test sessions.</Paragraph>
            </div>

            <div className={cl("pair-list")}>
                {pairs.length === 0 && (
                    <div className={cl("empty-inline")}>
                        <LogIcon className={cl("empty-inline-icon")} />
                        <Paragraph className={cl("empty-inline-copy")}>No pair activity yet.</Paragraph>
                    </div>
                )}

                {pairs.slice(0, 4).map(pair => (
                    <div key={pair.key} className={cl("pair-row")}>
                        <div>
                            <Paragraph className={cl("pair-title")}>{pair.operatorLabel} -&gt; {pair.targetLabel}</Paragraph>
                            <Paragraph className={cl("pair-subtitle")}>{pair.sessionCount} session{pair.sessionCount === 1 ? "" : "s"}</Paragraph>
                        </div>
                        <span className={cl("pair-minutes")}>{formatDurationMinutes(pair.totalMinutes)}</span>
                    </div>
                ))}
            </div>
        </Card>
    );
}

function IdentityRow({
    avatarUrl,
    label,
    details,
    meta,
    trailing,
}: {
    avatarUrl: string;
    label: string;
    details: string;
    meta: string;
    trailing?: React.ReactNode;
}) {
    return (
        <div className={cl("identity-row")}>
            <img className={cl("identity-avatar")} src={avatarUrl} alt="" />
            <div className={cl("identity-copy")}>
                <div className={cl("identity-title-row")}>
                    <HeadingTertiary className={Margins.reset}>{label}</HeadingTertiary>
                    <span className={cl("identity-meta")}>{meta}</span>
                </div>
                <Paragraph className={cl("identity-details")}>{details}</Paragraph>
            </div>
            {trailing}
        </div>
    );
}

async function resolveRemoteIdentity(discordUserId: string, fallbackLabel?: string, notes?: string) {
    const cached = UserStore.getUser(discordUserId) as {
        avatar?: string | null;
        username?: string;
        globalName?: string;
        global_name?: string;
    } | undefined;

    if (cached?.username) {
        return {
            source: "resolved" as const,
            ...buildIdentityFromUser(discordUserId, cached, fallbackLabel),
        };
    }

    try {
        const fetched = await UserUtils.getUser(discordUserId) as {
            avatar?: string | null;
            username?: string;
            globalName?: string;
            global_name?: string;
        } | undefined;

        if (fetched?.username) {
            return {
                source: "resolved" as const,
                ...buildIdentityFromUser(discordUserId, fetched, fallbackLabel),
            };
        }
    } catch { }

    return {
        source: "manual" as const,
        ...buildManualIdentity(discordUserId, fallbackLabel, notes),
    };
}

function PresenceLabTab() {
    const currentUser = UserStore.getCurrentUser();
    const currentUserId = getPresenceLabCurrentUserId();
    const [data, pending] = usePresenceLabData(currentUserId);
    const overview = React.useMemo(() => buildPresenceLabOverview(data), [data]);
    const groupedSessions = React.useMemo(() => groupSessionsByDay(data.sessions), [data.sessions]);

    const [operatorUserId, setOperatorUserId] = React.useState("");
    const [operatorAlias, setOperatorAlias] = React.useState("");
    const [operatorNotes, setOperatorNotes] = React.useState("");
    const [targetUserId, setTargetUserId] = React.useState("");
    const [targetAlias, setTargetAlias] = React.useState("");
    const [targetNotes, setTargetNotes] = React.useState("");
    const [sessionOperatorId, setSessionOperatorId] = React.useState("");
    const [sessionTargetId, setSessionTargetId] = React.useState("");
    const [sessionGuildName, setSessionGuildName] = React.useState("");
    const [sessionChannelName, setSessionChannelName] = React.useState("");
    const [sessionStartedAt, setSessionStartedAt] = React.useState(() => formatInputDateTime(Date.now()));
    const [sessionDurationMinutes, setSessionDurationMinutes] = React.useState("15");
    const [sessionOutcome, setSessionOutcome] = React.useState<PresenceLabSessionOutcome>("manual");
    const [sessionNotes, setSessionNotes] = React.useState("");
    const [historyQuery, setHistoryQuery] = React.useState("");

    React.useEffect(() => {
        if (!sessionOperatorId && data.operators[0]) setSessionOperatorId(data.operators[0].id);
    }, [data.operators, sessionOperatorId]);

    React.useEffect(() => {
        if (!sessionTargetId && data.targets[0]) setSessionTargetId(data.targets[0].id);
    }, [data.targets, sessionTargetId]);

    const operatorOptions = React.useMemo<Option<string>[]>(() =>
        data.operators.map(operator => ({
            label: operator.label,
            value: operator.id,
        })), [data.operators]);

    const targetOptions = React.useMemo<Option<string>[]>(() =>
        data.targets.map(target => ({
            label: target.label,
            value: target.id,
        })), [data.targets]);

    const outcomeOptions: Option<PresenceLabSessionOutcome>[] = React.useMemo(() => [
        { label: "Manual note", value: "manual" },
        { label: "Simulated run", value: "simulated" },
    ], []);

    const filteredGroups = React.useMemo(() => {
        const query = historyQuery.trim().toLowerCase();
        if (!query) return groupedSessions;

        return groupedSessions
            .map(group => ({
                ...group,
                sessions: group.sessions.filter(session =>
                    [
                        session.operatorLabel,
                        session.targetLabel,
                        session.guildName,
                        session.channelName,
                        session.notes,
                    ].some(value => value?.toLowerCase().includes(query)),
                ),
            }))
            .filter(group => group.sessions.length > 0);
    }, [groupedSessions, historyQuery]);

    const addCurrentOperator = React.useCallback(async () => {
        if (!currentUserId || !currentUser) return;

        const identity = buildIdentityFromUser(currentUser.id, currentUser, currentUser.globalName || currentUser.username);

        await addPresenceLabOperator(currentUserId, {
            id: `operator:${currentUser.id}`,
            discordUserId: currentUser.id,
            label: identity.label,
            username: identity.username,
            details: identity.details,
            avatarUrl: identity.avatarUrl,
            notes: "Added from the current local account.",
            addedAt: Date.now(),
            source: "current",
        });

        showToast("Added the current account as a local operator.", Toasts.Type.SUCCESS);
    }, [currentUser, currentUserId]);

    const addOperator = React.useCallback(async () => {
        if (!currentUserId) return;

        const discordUserId = normalizeUserId(operatorUserId);
        if (!/^\d{5,24}$/.test(discordUserId)) {
            showToast("Enter a numeric Discord user ID for the operator.", Toasts.Type.FAILURE);
            return;
        }

        const identity = await resolveRemoteIdentity(discordUserId, operatorAlias.trim(), operatorNotes.trim());

        await addPresenceLabOperator(currentUserId, {
            id: `operator:${discordUserId}`,
            discordUserId,
            label: identity.label,
            username: identity.username,
            details: identity.details,
            avatarUrl: identity.avatarUrl,
            notes: operatorNotes.trim() || undefined,
            addedAt: Date.now(),
            source: discordUserId === currentUser?.id ? "current" : identity.source,
        });

        setOperatorUserId("");
        setOperatorAlias("");
        setOperatorNotes("");
        showToast("Saved operator profile locally.", Toasts.Type.SUCCESS);
    }, [currentUser?.id, currentUserId, operatorAlias, operatorNotes, operatorUserId]);

    const addTarget = React.useCallback(async () => {
        if (!currentUserId) return;

        const discordUserId = normalizeUserId(targetUserId);
        if (!/^\d{5,24}$/.test(discordUserId)) {
            showToast("Enter a numeric Discord user ID for the target.", Toasts.Type.FAILURE);
            return;
        }

        const identity = await resolveRemoteIdentity(discordUserId, targetAlias.trim(), targetNotes.trim());

        await addPresenceLabTarget(currentUserId, {
            id: `target:${discordUserId}`,
            discordUserId,
            label: identity.label,
            username: identity.username,
            details: identity.details,
            avatarUrl: identity.avatarUrl,
            notes: targetNotes.trim() || undefined,
            addedAt: Date.now(),
            source: identity.source,
            trackingEnabled: true,
        });

        setTargetUserId("");
        setTargetAlias("");
        setTargetNotes("");
        showToast("Saved target profile locally.", Toasts.Type.SUCCESS);
    }, [currentUserId, targetAlias, targetNotes, targetUserId]);

    const saveSession = React.useCallback(async () => {
        if (!currentUserId) return;

        const operator = data.operators.find(entry => entry.id === sessionOperatorId);
        const target = data.targets.find(entry => entry.id === sessionTargetId);

        if (!operator || !target) {
            showToast("Choose one operator and one target before saving a session.", Toasts.Type.FAILURE);
            return;
        }

        const duration = clampNumber(Number(sessionDurationMinutes) || 0, 1, 720);
        const guildName = sessionGuildName.trim() || "Private test server";
        const channelName = sessionChannelName.trim() || "Voice channel";

        await addPresenceLabSession(currentUserId, {
            id: makeLocalId("session"),
            operatorId: operator.id,
            operatorLabel: operator.label,
            operatorAvatarUrl: operator.avatarUrl,
            targetId: target.id,
            targetLabel: target.label,
            targetAvatarUrl: target.avatarUrl,
            guildName,
            channelName,
            startedAt: new Date(sessionStartedAt).getTime() || Date.now(),
            durationMinutes: duration,
            outcome: sessionOutcome,
            notes: sessionNotes.trim() || undefined,
        });

        setSessionGuildName("");
        setSessionChannelName("");
        setSessionNotes("");
        setSessionStartedAt(formatInputDateTime(Date.now()));
        setSessionDurationMinutes(String(data.config.dwellMinutes || 15));
        showToast("Recorded a local Presence Lab session.", Toasts.Type.SUCCESS);
    }, [
        currentUserId,
        data.config.dwellMinutes,
        data.operators,
        data.targets,
        sessionChannelName,
        sessionDurationMinutes,
        sessionGuildName,
        sessionNotes,
        sessionOperatorId,
        sessionOutcome,
        sessionStartedAt,
        sessionTargetId,
    ]);

    const clearLab = React.useCallback(() => {
        Alerts.show({
            title: "Clear local Presence Lab data?",
            body: "This removes operators, targets, runtime settings, and logged sessions from this device only.",
            confirmText: "Clear Local Lab",
            cancelText: "Cancel",
            async onConfirm() {
                await clearPresenceLabData(currentUserId);
                showToast("Cleared local Presence Lab data.", Toasts.Type.SUCCESS);
            },
        });
    }, [currentUserId]);

    const updateConfigValue = React.useCallback(async (
        key: "entryDelaySeconds" | "jitterMinSeconds" | "jitterMaxSeconds" | "dwellMinutes",
        value: string,
    ) => {
        const parsed = clampNumber(Number(value) || 0, 0, 999);
        await updatePresenceLabConfig(currentUserId, { [key]: parsed });
    }, [currentUserId]);

    const runtimeOptions = [
        {
            label: "Entry delay",
            value: `${data.config.entryDelaySeconds}s`,
            hint: "Delay before a simulated join starts.",
        },
        {
            label: "Jitter window",
            value: `${data.config.jitterMinSeconds}s - ${data.config.jitterMaxSeconds}s`,
            hint: "Random spread to avoid robotic timings in lab scenarios.",
        },
        {
            label: "Dwell length",
            value: `${data.config.dwellMinutes}m`,
            hint: "Default stay duration used when saving a session.",
        },
    ];
    const averageJitterSeconds = Math.round((data.config.jitterMinSeconds + data.config.jitterMaxSeconds) / 2);
    const cadenceLeadSeconds = data.config.entryDelaySeconds + averageJitterSeconds;
    const cadenceTotalSeconds = cadenceLeadSeconds + data.config.dwellMinutes * 60;
    const cadenceProgress = cadenceTotalSeconds > 0
        ? Math.min(96, Math.max(8, Math.round((cadenceLeadSeconds / cadenceTotalSeconds) * 100)))
        : 12;

    return (
        <SettingsTab>
            <div className={cl("shell")}>
            <SpecialCard
                title="Presence Lab"
                subtitle="Local operator sandbox"
                description={`Build a self-contained dashboard for your own test accounts, targets, and simulated voice activity. ${BRAND_NAME} keeps this lab local to the device and does not ship any token-based automation or external collection here.`}
                cardImage={BRAND_ICON_DATA_URL}
                backgroundImage={HERO_BACKGROUND}
                backgroundColor="#1b2129"
            >
                <div className={cl("hero-tags")}>
                    <span className={cl("hero-tag")}>{data.operators.length} operators</span>
                    <span className={cl("hero-tag")}>{data.targets.length} targets</span>
                    <span className={cl("hero-tag")}>{overview.sessionCount} sessions</span>
                    <span className={cl("hero-tag")}>{formatDurationMinutes(overview.weeklyMinutes)} this week</span>
                </div>
            </SpecialCard>

            <Notice.Info className={Margins.top20} style={{ width: "100%" }}>
                Presence Lab is intentionally local-only. Use it for self-owned test accounts, manual notes, and simulated sessions. If you later add private adapters, keep any secrets in local git-ignored files. This page does not send tokens or session data to external services.
            </Notice.Info>

            <Card className={cl("cadence-strip")} defaultPadding>
                <div className={cl("cadence-strip-top")}>
                    <div className={cl("cadence-icons")}>
                        <span className={cl("cadence-icon-shell")}><ClockIcon width={16} height={16} /></span>
                        <span className={cl("cadence-icon-shell", "active")}><Microphone width={16} height={16} /></span>
                        <span className={cl("cadence-icon-shell")}><ComponentsIcon width={16} height={16} /></span>
                    </div>

                    <div className={cl("cadence-copy")}>
                        <HeadingTertiary className={Margins.reset}>Delay, Jitter, Dwell</HeadingTertiary>
                        <Paragraph className={cl("section-copy")}>A local timing strip for simulated sessions and manual runtime planning.</Paragraph>
                    </div>

                    <span className={cl("cadence-badge")}>Local Sandbox</span>
                </div>

                <div className={cl("cadence-strip-bottom")}>
                    <span className={cl("cadence-time-label")}>{formatSecondsLabel(cadenceLeadSeconds)}</span>
                    <div className={cl("cadence-track")}>
                        <div className={cl("cadence-track-fill")} style={{ width: `${cadenceProgress}%` }} />
                        <div className={cl("cadence-thumb")} style={{ left: `${cadenceProgress}%` }} />
                    </div>
                    <span className={cl("cadence-time-label")}>{formatSecondsLabel(cadenceTotalSeconds)}</span>
                </div>
            </Card>

            <div className={cl("dashboard-grid")}>
                <div className={cl("overview-stack")}>
                    <div className={cl("metric-grid")}>
                        <MetricCard
                            label="Observed Time"
                            value={formatDurationMinutes(overview.totalMinutes)}
                            hint={overview.lastSessionAt ? `Last session ${formatRelativeDay(overview.lastSessionAt)}` : "No local sessions yet"}
                        />
                        <MetricCard
                            label="Weekly Sessions"
                            value={String(overview.recentSessionCount)}
                            hint={`${overview.activeTargets} active target${overview.activeTargets === 1 ? "" : "s"} this week`}
                        />
                        <MetricCard
                            label="Average Dwell"
                            value={formatDurationMinutes(overview.averageSessionMinutes)}
                            hint="Average duration across all local sessions"
                        />
                        <MetricCard
                            label="Tracked Targets"
                            value={String(overview.trackedTargets)}
                            hint={overview.topPair ? `${overview.topPair.operatorLabel} -> ${overview.topPair.targetLabel}` : "No interaction pair yet"}
                        />
                    </div>

                    <div className={cl("gauge-grid")}>
                        <GaugeCard title="Lab Readiness" value={overview.readinessRatio} subtitle="Setup score" accent="#e8bc78" />
                        <GaugeCard title="Target Coverage" value={overview.coverageRatio} subtitle="Targets seen this week" accent="#8cb1ff" />
                        <GaugeCard title="Session Load" value={overview.intensityRatio} subtitle="Against a 4h weekly ceiling" accent="#63d2a8" />
                    </div>

                    <div className={cl("insight-grid")}>
                        <ActivityStrip buckets={overview.weeklyBuckets} />
                        <PairList pairs={overview.pairStats} />
                    </div>

                    <Card className={cl("panel-card", "history-card")} defaultPadding>
                        <div className={cl("section-head")}>
                            <div>
                                <Heading className={cl("panel-title")} tag="h4">Activity History</Heading>
                                <Paragraph className={cl("section-copy")}>A clean local record of the sessions you log inside Presence Lab.</Paragraph>
                            </div>
                            <div className={cl("section-chip")}>{data.sessions.length} total</div>
                        </div>

                        <div className={cl("history-toolbar")}>
                            <label className={cl("search-shell")}>
                                <MagnifyingGlassIcon className={cl("search-icon")} width={16} height={16} />
                                <input className={cl("search-input")} type="text" value={historyQuery} placeholder="Search operators, targets, servers, channels, or notes" onChange={event => setHistoryQuery(event.currentTarget.value)} />
                            </label>
                        </div>

                        {pending && (
                            <Card className={cl("empty-card")}>
                                <LogIcon className={cl("empty-icon")} />
                                <HeadingTertiary>Loading Presence Lab...</HeadingTertiary>
                            </Card>
                        )}

                        {!pending && filteredGroups.length === 0 && (
                            <Card className={cl("empty-card")}>
                                <Microphone className={cl("empty-icon")} />
                                <HeadingTertiary>No local sessions yet</HeadingTertiary>
                                <Paragraph>Save a manual or simulated session and it will start building the dashboard instantly.</Paragraph>
                            </Card>
                        )}

                        {!pending && filteredGroups.length > 0 && (
                            <div className={cl("session-groups")}>
                                {filteredGroups.map(group => (
                                    <div key={group.key} className={cl("session-group")}>
                                        <div className={cl("session-group-header")}>
                                            <HeadingTertiary className={Margins.reset}>{group.label}</HeadingTertiary>
                                            <span className={cl("session-group-count")}>
                                                {group.sessions.length} entr{group.sessions.length === 1 ? "y" : "ies"}
                                            </span>
                                        </div>

                                        <div className={cl("session-list")}>
                                            {group.sessions.map(session => (
                                                <Card key={session.id} className={cl("session-entry")}>
                                                    <div className={cl("session-entry-top")}>
                                                        <div className={cl("session-entry-route")}>
                                                            <img className={cl("session-avatar")} src={session.operatorAvatarUrl} alt="" />
                                                            <span className={cl("session-arrow")}>-&gt;</span>
                                                            <img className={cl("session-avatar")} src={session.targetAvatarUrl} alt="" />
                                                            <div>
                                                                <Paragraph className={cl("session-title")}>{session.operatorLabel} -&gt; {session.targetLabel}</Paragraph>
                                                                <Paragraph className={cl("session-context")}>{getGuildLabel(session.guildName, session.channelName)}</Paragraph>
                                                            </div>
                                                        </div>

                                                        <div className={cl("session-entry-meta")}>
                                                            <span className={cl("session-badge")}>{session.outcome === "manual" ? "Manual" : "Simulated"}</span>
                                                            <span className={cl("session-time")}>{formatDateTime(session.startedAt)}</span>
                                                        </div>
                                                    </div>

                                                    <div className={cl("session-entry-body")}>
                                                        <div className={cl("session-duration-chip")}>{formatDurationMinutes(session.durationMinutes)}</div>
                                                        <Paragraph className={cl("session-notes")}>{session.notes || "No extra notes for this session."}</Paragraph>
                                                    </div>

                                                    <div className={cl("session-entry-footer")}>
                                                        <Paragraph className={cl("session-footnote")}>Logged locally by {BRAND_NAME}. No remote sync.</Paragraph>
                                                        <TextButton variant="danger" onClick={() => void removePresenceLabSession(currentUserId, session.id)}>Remove</TextButton>
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>

                <div className={cl("dashboard-side")}>
                <Card className={cl("runtime-card")} defaultPadding>
                    <div className={cl("section-head")}>
                        <div>
                            <HeadingTertiary className={Margins.reset}>Runtime Profile</HeadingTertiary>
                            <Paragraph className={cl("section-copy")}>Keep the future experimental adapter settings local and ready.</Paragraph>
                        </div>
                        <Button size="iconOnly" variant="secondary" className={cl("section-icon")} aria-label="Runtime profile">
                            <CogWheel width={16} height={16} />
                        </Button>
                    </div>

                    <div className={cl("runtime-stat-grid")}>
                        {runtimeOptions.map(option => (
                            <div key={option.label} className={cl("runtime-stat")}>
                                <Paragraph className={cl("runtime-label")}>{option.label}</Paragraph>
                                <HeadingTertiary className={Margins.reset}>{option.value}</HeadingTertiary>
                                <Paragraph className={cl("metric-hint")}>{option.hint}</Paragraph>
                            </div>
                        ))}
                    </div>

                    <div className={cl("field-grid")}>
                        <label className={cl("field")}>
                            <span className={cl("field-label")}>Entry delay (sec)</span>
                            <input className={cl("input")} type="number" min={0} max={300} value={data.config.entryDelaySeconds} onChange={event => void updateConfigValue("entryDelaySeconds", event.currentTarget.value)} />
                        </label>
                        <label className={cl("field")}>
                            <span className={cl("field-label")}>Jitter min (sec)</span>
                            <input className={cl("input")} type="number" min={0} max={300} value={data.config.jitterMinSeconds} onChange={event => void updateConfigValue("jitterMinSeconds", event.currentTarget.value)} />
                        </label>
                        <label className={cl("field")}>
                            <span className={cl("field-label")}>Jitter max (sec)</span>
                            <input className={cl("input")} type="number" min={0} max={300} value={data.config.jitterMaxSeconds} onChange={event => void updateConfigValue("jitterMaxSeconds", event.currentTarget.value)} />
                        </label>
                        <label className={cl("field")}>
                            <span className={cl("field-label")}>Dwell (min)</span>
                            <input className={cl("input")} type="number" min={1} max={720} value={data.config.dwellMinutes} onChange={event => void updateConfigValue("dwellMinutes", event.currentTarget.value)} />
                        </label>
                    </div>

                    <div className={cl("toggle-row")}>
                        <div>
                            <HeadingTertiary className={Margins.reset}>Neutral test profile</HeadingTertiary>
                            <Paragraph className={cl("section-copy")}>Preserve a local flag for generic name/avatar experiments without enabling automation.</Paragraph>
                        </div>
                        <Switch checked={data.config.neutralProfile} onChange={(checked: boolean) => void updatePresenceLabConfig(currentUserId, { neutralProfile: checked })} />
                    </div>

                    <div className={cl("runtime-footer")}>
                        <Paragraph className={cl("runtime-footnote")}>No live monitoring or token actions are built into this page. It is a local dashboard layer for test planning and manual logging.</Paragraph>
                        <TextButton variant="danger" onClick={clearLab}>Clear Local Lab</TextButton>
                    </div>
                </Card>

            <div className={cl("roster-grid")}>
                <Card className={cl("panel-card")} defaultPadding>
                    <div className={cl("section-head")}>
                        <div>
                            <Heading className={cl("panel-title")} tag="h4">Operators</Heading>
                            <Paragraph className={cl("section-copy")}>Add your own local test accounts and keep their profile snapshots here.</Paragraph>
                        </div>
                        <Button className={cl("section-action-button")} variant="secondary" size="small" onClick={() => void addCurrentOperator()}>
                            Add Current Account
                        </Button>
                    </div>

                    <div className={cl("field-grid")}>
                        <label className={cl("field")}>
                            <span className={cl("field-label")}>Discord user ID</span>
                            <input className={cl("input")} type="text" value={operatorUserId} placeholder="Add your other local test account" onChange={event => setOperatorUserId(event.currentTarget.value)} />
                        </label>
                        <label className={cl("field")}>
                            <span className={cl("field-label")}>Alias</span>
                            <input className={cl("input")} type="text" value={operatorAlias} placeholder="Optional display name" onChange={event => setOperatorAlias(event.currentTarget.value)} />
                        </label>
                    </div>

                    <label className={cl("field", "field-full")}>
                        <span className={cl("field-label")}>Notes</span>
                        <input className={cl("input")} type="text" value={operatorNotes} placeholder="Optional note about how you use this operator locally" onChange={event => setOperatorNotes(event.currentTarget.value)} />
                    </label>

                    <div className={cl("inline-actions")}>
                        <Button className={cl("primary-action-button")} variant="secondary" size="small" onClick={() => void addOperator()}>
                            Save Operator
                        </Button>
                    </div>

                    <div className={cl("identity-list")}>
                        {data.operators.length === 0 && (
                            <div className={cl("empty-inline")}>
                                <ComponentsIcon className={cl("empty-inline-icon")} />
                                <Paragraph className={cl("empty-inline-copy")}>No operators saved yet.</Paragraph>
                            </div>
                        )}

                        {data.operators.map(operator => (
                            <Card key={operator.id} className={cl("identity-card")}>
                                <IdentityRow
                                    avatarUrl={operator.avatarUrl}
                                    label={operator.label}
                                    details={`${operator.details} / ${getOperatorPlaceholderNote(operator)}`}
                                    meta={renderSourceLabel(operator.source)}
                                    trailing={<TextButton variant="danger" onClick={() => void removePresenceLabOperator(currentUserId, operator.id)}>Remove</TextButton>}
                                />
                            </Card>
                        ))}
                    </div>
                </Card>

                <Card className={cl("panel-card")} defaultPadding>
                    <div className={cl("section-head")}>
                        <div>
                            <Heading className={cl("panel-title")} tag="h4">Targets</Heading>
                            <Paragraph className={cl("section-copy")}>Track local IDs for testing and annotate how they appear in your lab sessions.</Paragraph>
                        </div>
                        <div className={cl("section-chip")}>{data.targets.length} stored</div>
                    </div>

                    <div className={cl("field-grid")}>
                        <label className={cl("field")}>
                            <span className={cl("field-label")}>Discord user ID</span>
                            <input className={cl("input")} type="text" value={targetUserId} placeholder="Add a local target profile" onChange={event => setTargetUserId(event.currentTarget.value)} />
                        </label>
                        <label className={cl("field")}>
                            <span className={cl("field-label")}>Alias</span>
                            <input className={cl("input")} type="text" value={targetAlias} placeholder="Optional display name" onChange={event => setTargetAlias(event.currentTarget.value)} />
                        </label>
                    </div>

                    <label className={cl("field", "field-full")}>
                        <span className={cl("field-label")}>Notes</span>
                        <input className={cl("input")} type="text" value={targetNotes} placeholder="Optional context for this target" onChange={event => setTargetNotes(event.currentTarget.value)} />
                    </label>

                    <div className={cl("inline-actions")}>
                        <Button className={cl("primary-action-button")} variant="secondary" size="small" onClick={() => void addTarget()}>
                            Save Target
                        </Button>
                    </div>

                    <div className={cl("identity-list")}>
                        {data.targets.length === 0 && (
                            <div className={cl("empty-inline")}>
                                <ClockIcon className={cl("empty-inline-icon")} />
                                <Paragraph className={cl("empty-inline-copy")}>No targets saved yet.</Paragraph>
                            </div>
                        )}

                        {data.targets.map(target => (
                            <Card key={target.id} className={cl("identity-card")}>
                                <IdentityRow
                                    avatarUrl={target.avatarUrl}
                                    label={target.label}
                                    details={`${target.details} / ${getTargetPlaceholderNote(target)}`}
                                    meta={target.trackingEnabled ? "Active" : "Paused"}
                                    trailing={(
                                        <div className={cl("identity-controls")}>
                                            <Switch checked={target.trackingEnabled} onChange={(checked: boolean) => void updatePresenceLabTargetState(currentUserId, target.id, { trackingEnabled: checked })} />
                                            <TextButton variant="danger" onClick={() => void removePresenceLabTarget(currentUserId, target.id)}>Remove</TextButton>
                                        </div>
                                    )}
                                />
                            </Card>
                        ))}
                    </div>
                </Card>
            </div>

            <Card className={cl("panel-card", "session-card")} defaultPadding>
                <div className={cl("section-head")}>
                    <div>
                        <Heading className={cl("panel-title")} tag="h4">Session Logger</Heading>
                        <Paragraph className={cl("section-copy")}>Record manual or simulated test sessions and feed the dashboard locally.</Paragraph>
                    </div>
                    <div className={cl("section-chip")}>Local timeline</div>
                </div>

                <div className={cl("field-grid", "field-grid-three")}>
                    <div className={cl("field")}>
                        <span className={cl("field-label")}>Operator</span>
                        <Select options={operatorOptions} select={(value: string) => setSessionOperatorId(value)} isSelected={(value: string) => sessionOperatorId === value} serialize={(value: string) => value} isDisabled={!operatorOptions.length} />
                    </div>
                    <div className={cl("field")}>
                        <span className={cl("field-label")}>Target</span>
                        <Select options={targetOptions} select={(value: string) => setSessionTargetId(value)} isSelected={(value: string) => sessionTargetId === value} serialize={(value: string) => value} isDisabled={!targetOptions.length} />
                    </div>
                    <div className={cl("field")}>
                        <span className={cl("field-label")}>Session type</span>
                        <Select options={outcomeOptions} select={(value: PresenceLabSessionOutcome) => setSessionOutcome(value)} isSelected={(value: PresenceLabSessionOutcome) => sessionOutcome === value} serialize={(value: PresenceLabSessionOutcome) => value} />
                    </div>
                </div>

                <div className={cl("field-grid", "field-grid-four")}>
                    <label className={cl("field")}>
                        <span className={cl("field-label")}>Server label</span>
                        <input className={cl("input")} type="text" value={sessionGuildName} placeholder="Private test guild" onChange={event => setSessionGuildName(event.currentTarget.value)} />
                    </label>
                    <label className={cl("field")}>
                        <span className={cl("field-label")}>Voice channel</span>
                        <input className={cl("input")} type="text" value={sessionChannelName} placeholder="General voice" onChange={event => setSessionChannelName(event.currentTarget.value)} />
                    </label>
                    <label className={cl("field")}>
                        <span className={cl("field-label")}>Started at</span>
                        <input className={cl("input")} type="datetime-local" value={sessionStartedAt} onChange={event => setSessionStartedAt(event.currentTarget.value)} />
                    </label>
                    <label className={cl("field")}>
                        <span className={cl("field-label")}>Duration (min)</span>
                        <input className={cl("input")} type="number" min={1} max={720} value={sessionDurationMinutes} onChange={event => setSessionDurationMinutes(event.currentTarget.value)} />
                    </label>
                </div>

                <label className={cl("field", "field-full")}>
                    <span className={cl("field-label")}>Notes</span>
                    <input className={cl("input")} type="text" value={sessionNotes} placeholder="Optional notes about what happened in this local test session" onChange={event => setSessionNotes(event.currentTarget.value)} />
                </label>

                <div className={cl("inline-actions")}>
                    <Button className={cl("primary-action-button")} variant="secondary" size="small" onClick={() => void saveSession()}>
                        Save Session
                    </Button>
                </div>
            </Card>
            </div>
            </div>
            </div>
        </SettingsTab>
    );
}

export default wrapTab(PresenceLabTab, "Presence Lab");
