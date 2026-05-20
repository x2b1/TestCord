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
import { ClockIcon, CloudUploadIcon, FolderIcon, LinkIcon, LogIcon, MagnifyingGlassIcon, RestartIcon } from "@components/Icons";
import { Notice } from "@components/Notice";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab, wrapTab } from "@components/settings";
import { SpecialCard } from "@components/settings/SpecialCard";
import { Switch } from "@components/Switch";
import { classNameFactory } from "@utils/css";
import { openUserProfile } from "@utils/discord";
import { Margins } from "@utils/margins";
import { Alerts, GuildMemberCountStore, GuildMemberStore, GuildStore, React, Toasts, useStateFromStores } from "@webpack/common";

import { BRAND_ICON_DATA_URL, BRAND_NAME } from "../_kamidereCompat/branding";
import {
    clearHydratedGuildSnapshot,
    clearHydratedGuildSnapshots,
    type GuildHydrationSnapshot,
    listHydratedGuildSnapshots,
} from "./memberHydrator";
import {
    cancelMutualScannerRun,
    cancelMutualScannerWarmup,
    type MutualScannerWarmupProgressState,
    startMutualScannerRun,
    startMutualScannerWarmup,
    useMutualScannerRuntimeState,
} from "./runtime";
import {
    clearMutualScannerRuns,
    getMutualScannerCurrentUserId,
    removeMutualScannerRun,
    updateMutualScannerConfig,
    useMutualScannerData,
} from "./store";
import type {
    MutualScannerExecutionResult,
    MutualScannerGuildOption,
    MutualScannerMatch,
    MutualScannerProgress,
    MutualScannerRun,
} from "./types";
import {
    buildGuildOptions,
    buildMutualScannerRunComparison,
    formatDateTime,
    formatDurationMs,
    getHydrationSnapshotQuality,
    getHydrationSnapshotQualityLabel,
    isComparableMutualScannerRun,
    isHydrationSnapshotWeak,
} from "./utils";

const cl = classNameFactory("vc-mutual-scanner-");

const HERO_BACKGROUND = `data:image/svg+xml;utf8,${encodeURIComponent(
    [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600">',
        "<defs>",
        '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">',
        '<stop stop-color="#11131a"/>',
        '<stop offset="0.45" stop-color="#1a222c"/>',
        '<stop offset="1" stop-color="#2c2a20"/>',
        "</linearGradient>",
        "</defs>",
        '<rect width="1200" height="600" fill="url(#g)"/>',
        '<circle cx="920" cy="160" r="170" fill="#7ca7d4" opacity=".10"/>',
        '<circle cx="250" cy="460" r="190" fill="#f0c26f" opacity=".10"/>',
        '<path d="M-30 430C146 332 295 334 420 372s224 47 368 11 257-34 442 72V640H-30Z" fill="#0b0d12" opacity=".68"/>',
        '<path d="M120 62 706 612" stroke="#d8e6f6" stroke-opacity=".05" stroke-width="24"/>',
        '<path d="M580 -20 1128 542" stroke="#ffebb9" stroke-opacity=".05" stroke-width="16"/>',
        "</svg>",
    ].join(""),
)}`;
const SCAN_STATUS_HIDE_DELAY_MS = 2400;
const SCAN_STATUS_TRANSITION_MS = 280;
const MANUAL_WARMUP_HIDE_DELAY_MS = 2200;
const LIVE_MATCH_VISIBLE_MS = 30000;
const LIVE_MATCH_EXIT_MS = 420;

type LiveRuntimeMatch = {
    userId: string;
    match: MutualScannerMatch;
    addedAt: number;
    exiting: boolean;
};

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

function clampNumber(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function formatRelativeWindow(timestamp: number) {
    const delta = timestamp - Date.now();
    if (delta <= 0) return "expired";

    const totalSeconds = Math.round(delta / 1000);
    if (totalSeconds < 60) return `${totalSeconds}s left`;

    const totalMinutes = Math.round(totalSeconds / 60);
    if (totalMinutes < 60) return `${totalMinutes}m left`;

    const totalHours = Math.round(totalMinutes / 60);
    if (totalHours < 24) return `${totalHours}h left`;

    const totalDays = Math.round(totalHours / 24);
    return `${totalDays}d left`;
}

function formatProgress(progress?: MutualScannerProgress | null) {
    if (!progress) return "Idle";
    if (progress.phase === "warming") return "Loading guild member cache";
    if (progress.phase === "collecting") return "Collecting candidate members";
    if (progress.phase === "finishing") return "Finalizing run";
    return `Scanning ${progress.scannedCount}/${progress.totalCandidates}`;
}

function formatManualWarmupState(state: MutualScannerWarmupProgressState["state"]) {
    switch (state) {
        case "cache":
            return "Cached index";
        case "cancelled":
            return "Cancelled";
        case "failed":
            return "No chunks";
        case "completed":
            return "Completed";
        case "queued":
            return "Queued";
        default:
            return "Running";
    }
}

function formatDiffNames(matches: MutualScannerMatch[], limit = 3) {
    if (matches.length === 0) return "";

    const labels = matches.slice(0, limit).map(match => match.label);
    if (matches.length <= limit) {
        return labels.join(", ");
    }

    return `${labels.join(", ")} +${matches.length - limit}`;
}

function buildRunQuery(run: MutualScannerRun) {
    return [
        run.scopeLabel,
        run.status,
        ...run.matches.flatMap(match => [match.label, match.userId, ...match.guildNames]),
    ].join(" ").toLowerCase();
}

function buildRuntimePreviewQuery(scopeLabel: string | null, matches: MutualScannerMatch[], progress: MutualScannerProgress | null) {
    return [
        scopeLabel ?? "running",
        "running",
        progress?.currentLabel ?? "",
        ...matches.flatMap(match => [match.label, match.userId, ...match.guildNames]),
    ].join(" ").toLowerCase();
}

function MetricTag({ icon, label, value }: { icon: React.ReactNode; label: string; value: string; }) {
    return (
        <span className={cl("hero-tag")}>
            <span className={cl("hero-tag-icon")}>{icon}</span>
            <span className={cl("hero-tag-value")}>{value}</span>
            <span className={cl("hero-tag-label")}>{label}</span>
        </span>
    );
}

function ScanStatusBanner({
    progress,
    result,
    runDuration,
}: {
    progress: MutualScannerProgress | null;
    result: MutualScannerExecutionResult | null;
    runDuration: number;
}) {
    if (!progress && !result) return null;

    const phase = result
        ? result.status === "completed"
            ? "success"
            : result.status === "cancelled"
                ? "cancelled"
                : "failure"
        : "running";
    const isRunning = phase === "running";
    const progressWidth = isRunning
        ? progress?.totalCandidates
            ? Math.max(8, Math.round((progress.scannedCount / progress.totalCandidates) * 100))
            : progress?.phase === "warming"
                ? 16
                : progress?.phase === "collecting"
                    ? 28
                    : progress?.phase === "finishing"
                        ? 92
                        : 12
        : 100;

    let title = "Preparing scan";
    let subtitle = "Building the next scan stage.";

    if (isRunning && progress) {
        title = formatProgress(progress);
        subtitle = progress.currentLabel
            ? progress.phase === "warming"
                ? `Hydrating member cache for ${progress.currentLabel}.`
                : progress.phase === "collecting"
                    ? `Collecting candidates from ${progress.currentLabel}.`
                    : `Inspecting ${progress.currentLabel} for mutual relationships.`
            : progress.phase === "warming"
                ? "Preparing guild member data before the scan begins."
                : progress.phase === "collecting"
                    ? "Collecting unique candidates from the selected server set."
                    : "Running the mutual scan sequentially.";
    } else if (phase === "success" && result) {
        title = "Scan complete";
        subtitle = `Found ${result.matches.length} match${result.matches.length === 1 ? "" : "es"} after ${result.stats.scannedCount} scanned profile${result.stats.scannedCount === 1 ? "" : "s"} in ${formatDurationMs(runDuration)}.`;
    } else if (phase === "cancelled" && result) {
        title = "Scan cancelled";
        subtitle = `Stopped after ${result.stats.scannedCount} scanned profile${result.stats.scannedCount === 1 ? "" : "s"} and ${result.matches.length} match${result.matches.length === 1 ? "" : "es"}.`;
    } else if (phase === "failure" && result) {
        title = "Scan failed";
        subtitle = result.error ?? "The scanner could not finish this run.";
    }

    return (
        <div className={cl("scan-status", phase)} aria-live="polite">
            <div className={cl("scan-status-icon", phase)}>
                {isRunning ? <span className={cl("spinner")} /> : <span className={cl("checkmark")}>{phase === "failure" ? "ERR" : "OK"}</span>}
            </div>

            <div className={cl("scan-status-body")}>
                <div className={cl("scan-status-title-row")}>
                    <BaseText size="md" weight="semibold">{title}</BaseText>
                    <div className={cl("scan-status-tags")}>
                        <span className={cl("meta-tag", "quiet")}>
                            {(progress?.matchedCount ?? result?.stats.matchedCount ?? 0)} matches
                        </span>
                        <span className={cl("meta-tag", "quiet")}>
                            {(progress?.profileErrors ?? result?.stats.profileErrors ?? 0)} errors
                        </span>
                        {((progress?.countOnlyMatches ?? result?.stats.countOnlyMatches ?? 0) > 0) && (
                            <span className={cl("meta-tag", "accent")}>
                                {progress?.countOnlyMatches ?? result?.stats.countOnlyMatches ?? 0} count-only
                            </span>
                        )}
                    </div>
                </div>

                <Paragraph className={cl("scan-status-text")}>{subtitle}</Paragraph>
                <div className={cl("scan-progress-track")}>
                    <div className={cl("scan-progress-fill")} style={{ width: `${progressWidth}%` }} />
                </div>
            </div>
        </div>
    );
}

function SkeletonCard({ compact = false }: { compact?: boolean; }) {
    return (
        <Card className={cl("skeleton-card", compact && "compact")} defaultPadding>
            <div className={cl("skeleton-avatar")} />
            <div className={cl("skeleton-copy")}>
                <div className={cl("skeleton-line", "short")} />
                <div className={cl("skeleton-line")} />
                {!compact && <div className={cl("skeleton-line", "medium")} />}
            </div>
        </Card>
    );
}

function MatchRow({ match, compact = false }: { match: MutualScannerMatch; compact?: boolean; }) {
    const contextLabel = compact && match.guildNames.length > 1
        ? `Seen in ${match.guildNames[0]} +${match.guildNames.length - 1}`
        : `Seen in ${match.guildNames.join(", ")}`;
    const mutualsLabel = compact
        ? match.mutualFriendLabels.slice(0, 1).join(", ")
        : match.mutualFriendLabels.join(", ");

    return (
        <Card className={cl("match-card", compact && "match-card-compact")}>
            <div className={cl("match-header")}>
                <div className={cl("match-identity")}>
                    <button
                        type="button"
                        className={cl("match-profile-trigger")}
                        onClick={() => {
                            void openUserProfile(match.userId).catch(() => {
                                showToast("Could not open that profile.", Toasts.Type.FAILURE);
                            });
                        }}
                    >
                        <img className={cl("avatar")} src={match.avatarUrl} alt="" />
                        <div className={cl("match-copy")}>
                            <HeadingTertiary className={`${Margins.reset} ${cl("match-label")}`}>{match.label}</HeadingTertiary>
                            <Paragraph className={cl("muted-copy", "match-details")}>{match.details}</Paragraph>
                        </div>
                    </button>
                </div>

                <div className={cl("match-badges")}>
                    <span className={cl("badge")}>{match.mutualFriendCount} mutual</span>
                    {match.matchSource === "count" && <span className={cl("badge", "warn")}>{compact ? "Count" : "Count only"}</span>}
                    {match.isExistingFriend && <span className={cl("badge", "quiet")}>Already your friend</span>}
                    {match.isBot && <span className={cl("badge", "quiet")}>Bot</span>}
                </div>
            </div>

            <Paragraph className={cl("match-context")}>{contextLabel}</Paragraph>
            {match.mutualFriendLabels.length > 0 && (
                <Paragraph className={cl("muted-copy", "match-mutuals")}>
                    Mutuals: {mutualsLabel}
                    {compact && match.mutualFriendLabels.length > 1 ? ` +${match.mutualFriendLabels.length - 1}` : ""}
                </Paragraph>
            )}
        </Card>
    );
}

function LiveMatchRow({
    match,
    index,
    exiting,
}: {
    match: MutualScannerMatch;
    index: number;
    exiting?: boolean;
}) {
    return (
        <div
            className={cl("match-entry", exiting && "match-entry-exit")}
            style={{ "--mutual-scanner-enter-delay": `${Math.min(index * 42, 280)}ms` } as React.CSSProperties}
        >
            <MatchRow match={match} />
        </div>
    );
}

function HistoryAnimatedMatchRow({
    match,
    index,
}: {
    match: MutualScannerMatch;
    index: number;
}) {
    return (
        <div
            className={cl("match-entry", "history-match-entry")}
            style={{ "--mutual-scanner-enter-delay": `${Math.min(index * 42, 220)}ms` } as React.CSSProperties}
        >
            <MatchRow match={match} compact />
        </div>
    );
}

function RunCard({
    run,
    comparison,
    onRemove,
}: {
    run: MutualScannerRun;
    comparison: ReturnType<typeof buildMutualScannerRunComparison>;
    onRemove(): void;
}) {
    const duration = Math.max(0, run.finishedAt - run.startedAt);

    return (
        <Card className={cl("run-card")} defaultPadding>
            <div className={cl("run-header")}>
                <div>
                    <HeadingTertiary className={Margins.reset}>{run.scopeLabel}</HeadingTertiary>
                    <Paragraph className={cl("muted-copy")}>
                        {formatDateTime(run.startedAt)} / {formatDurationMs(duration)}
                    </Paragraph>
                </div>

                <div className={cl("run-actions")}>
                    <span className={cl("status-pill", run.status)}>{run.status}</span>
                    <TextButton className={cl("history-action-button")} variant="danger" onClick={onRemove}>Del</TextButton>
                </div>
            </div>

            <div className={cl("run-stats")}>
                <span className={cl("badge")}>{run.stats.matchedCount} matches</span>
                <span className={cl("badge", "quiet")}>{run.stats.scannedCount}/{run.stats.candidateCount} scanned</span>
                <span className={cl("badge", "quiet")}>{run.stats.profileErrors} errors</span>
                {run.stats.countOnlyMatches > 0 && <span className={cl("badge", "warn")}>{run.stats.countOnlyMatches} count</span>}
            </div>

            {comparison.previousRun && (
                <div className={cl("run-diff-block")}>
                    <div className={cl("run-diff-header")}>
                        <Paragraph className={cl("muted-copy")}>
                            Compared with {formatDateTime(comparison.previousRun.startedAt)}
                        </Paragraph>
                        <div className={cl("run-stats")}>
                            <span className={cl("badge", "success")}>+{comparison.newMatches.length} new</span>
                            <span className={cl("badge", "quiet")}>{comparison.sameMatches.length} same</span>
                            <span className={cl("badge", "danger")}>-{comparison.disappearedMatches.length} gone</span>
                        </div>
                    </div>

                    {(comparison.newMatches.length > 0 || comparison.disappearedMatches.length > 0) && (
                        <div className={cl("run-diff-copy")}>
                            {comparison.newMatches.length > 0 && (
                                <Paragraph className={cl("muted-copy")}>
                                    New: {formatDiffNames(comparison.newMatches)}
                                </Paragraph>
                            )}
                            {comparison.disappearedMatches.length > 0 && (
                                <Paragraph className={cl("muted-copy")}>
                                    Gone: {formatDiffNames(comparison.disappearedMatches)}
                                </Paragraph>
                            )}
                        </div>
                    )}
                </div>
            )}

            {run.error && (
                <Notice.Info className={cl("inline-notice")}>
                    {run.error}
                </Notice.Info>
            )}

            <div className={cl("history-match-list")}>
                {run.matches.length === 0 && (
                    <div className={cl("empty-inline")}>
                        <MagnifyingGlassIcon className={cl("empty-inline-icon")} />
                        <Paragraph className={cl("muted-copy")}>No candidates with mutual friends were found in this scope.</Paragraph>
                    </div>
                )}

                {run.matches.map(match => <MatchRow key={`${run.id}:${match.userId}`} match={match} compact />)}
            </div>
        </Card>
    );
}

function RuntimePreviewRunCard({
    scopeLabel,
    startedAt,
    progress,
    matches,
}: {
    scopeLabel: string;
    startedAt: number;
    progress: MutualScannerProgress | null;
    matches: MutualScannerMatch[];
}) {
    const duration = Math.max(0, Date.now() - startedAt);

    return (
        <Card className={cl("run-card", "runtime-preview-card")} defaultPadding>
            <div className={cl("run-header")}>
                <div>
                    <HeadingTertiary className={Margins.reset}>{scopeLabel}</HeadingTertiary>
                    <Paragraph className={cl("muted-copy")}>
                        {formatDateTime(startedAt)} / {formatDurationMs(duration)}
                    </Paragraph>
                </div>

                <div className={cl("run-actions")}>
                    <span className={cl("status-pill", "running")}>running</span>
                </div>
            </div>

            <div className={cl("run-stats")}>
                <span className={cl("badge")}>{progress?.matchedCount ?? matches.length} matches</span>
                <span className={cl("badge", "quiet")}>{progress?.scannedCount ?? 0}/{progress?.totalCandidates ?? "?"} scanned</span>
                <span className={cl("badge", "quiet")}>{progress?.profileErrors ?? 0} errors</span>
                {(progress?.countOnlyMatches ?? 0) > 0 && <span className={cl("badge", "warn")}>{progress?.countOnlyMatches} count</span>}
            </div>

            <div className={cl("history-match-list")}>
                {matches.map((match, index) => (
                    <HistoryAnimatedMatchRow
                        key={`runtime-preview:${match.userId}`}
                        match={match}
                        index={index}
                    />
                ))}
            </div>
        </Card>
    );
}

function HydrationCacheRow({
    snapshot,
    quality,
    targetCount,
    onRewarm,
    rewarmDisabled,
    onClear,
}: {
    snapshot: GuildHydrationSnapshot;
    quality: ReturnType<typeof getHydrationSnapshotQuality>;
    targetCount: number | null;
    onRewarm(): void;
    rewarmDisabled: boolean;
    onClear(): void;
}) {
    const guildLabel = GuildStore.getGuild(snapshot.guildId)?.name ?? snapshot.guildId;
    const qualityLabel = getHydrationSnapshotQualityLabel(quality);

    return (
        <Card className={cl("run-card", "cache-card")} defaultPadding>
            <div className={cl("run-header")}>
                <div>
                    <HeadingTertiary className={Margins.reset}>{guildLabel}</HeadingTertiary>
                    <Paragraph className={cl("muted-copy")}>
                        {formatDateTime(snapshot.warmedAt)} / {formatRelativeWindow(snapshot.expiresAt)}
                    </Paragraph>
                </div>

                <div className={cl("run-actions")}>
                    <span className={cl("status-pill", quality === "partial" ? "failed" : quality === "cancelled" ? "cancelled" : quality === "stale" ? "running" : "completed")}>
                        {qualityLabel}
                    </span>
                    <TextButton variant="secondary" disabled={rewarmDisabled} onClick={onRewarm}>Rewarm</TextButton>
                    <TextButton variant="danger" onClick={onClear}>Clear</TextButton>
                </div>
            </div>

            <div className={cl("cache-stat-grid")}>
                <span className={cl("badge")}>{snapshot.memberIds.length} indexed</span>
                {targetCount != null && <span className={cl("badge", "quiet")}>{snapshot.finalCount}/{targetCount} target</span>}
                <div className={cl("cache-stat-pair")}>
                    <span className={cl("badge", "quiet")}>+{snapshot.delta} hydrated</span>
                    {snapshot.chunksSeen > 0 && <span className={cl("badge", "quiet")}>{snapshot.chunksSeen} chunks</span>}
                </div>
                {snapshot.budgetReached && <span className={cl("badge", "warn")}>budget reached</span>}
                {snapshot.timedOut && <span className={cl("badge", "danger")}>timed out</span>}
                {snapshot.cancelled && <span className={cl("badge", "danger")}>cancelled</span>}
            </div>
        </Card>
    );
}

function MutualScannerTab() {
    const currentUserId = getMutualScannerCurrentUserId();
    const [data, pending] = useMutualScannerData(currentUserId);
    const runtime = useMutualScannerRuntimeState();
    const [guildSearch, setGuildSearch] = React.useState("");
    const [historySearch, setHistorySearch] = React.useState("");
    const [liveRuntimeMatches, setLiveRuntimeMatches] = React.useState<LiveRuntimeMatch[]>([]);
    const [renderedRuntimeResult, setRenderedRuntimeResult] = React.useState<MutualScannerExecutionResult | null>(null);
    const [tick, setTick] = React.useState(0);
    const [isScanStatusVisible, setIsScanStatusVisible] = React.useState(false);
    const [hydrationSnapshots, setHydrationSnapshots] = React.useState<GuildHydrationSnapshot[]>([]);
    const [hydrationPending, setHydrationPending] = React.useState(true);
    const [renderedManualWarmupProgress, setRenderedManualWarmupProgress] = React.useState<MutualScannerWarmupProgressState | null>(null);
    const [isManualWarmupVisible, setIsManualWarmupVisible] = React.useState(false);
    const scanStatusHideTimerRef = React.useRef<number | null>(null);
    const scanStatusCleanupTimerRef = React.useRef<number | null>(null);
    const manualWarmupHideTimerRef = React.useRef<number | null>(null);
    const manualWarmupCleanupTimerRef = React.useRef<number | null>(null);
    const liveRuntimeSessionRef = React.useRef<string | null>(null);
    const seenLiveMatchIdsRef = React.useRef<Set<string>>(new Set());

    const isRunning = runtime.scan.active;
    const runtimeMatches = runtime.scan.matches;
    const runtimeProgress = runtime.scan.progress;
    const runtimeResult = runtime.scan.result;
    const runStartedAt = runtime.scan.startedAt;
    const isManualWarmupRunning = runtime.warmup.active;
    const manualWarmupStatus = runtime.warmup.status;
    const manualWarmupProgress = runtime.warmup.progress;

    const guildOptions = useStateFromStores([GuildStore, GuildMemberStore], () =>
        buildGuildOptions(),
    ) as MutualScannerGuildOption[];
    const guildTargetCountMap = useStateFromStores([GuildStore, GuildMemberStore, GuildMemberCountStore], () =>
        new Map(
            GuildStore.getGuildsArray().map(guild => [
                guild.id,
                GuildMemberCountStore.getMemberCount(guild.id)
                ?? (guild as { memberCount?: number; }).memberCount
                ?? GuildMemberStore.getMemberIds(guild.id)?.length
                ?? GuildMemberStore.getMembers(guild.id)?.length
                ?? null,
            ]),
        ),
    ) as Map<string, number | null>;
    const hydrationSnapshotMap = React.useMemo(() =>
        new Map(hydrationSnapshots.map(snapshot => [snapshot.guildId, snapshot])),
    [hydrationSnapshots]);

    const selectedGuilds = React.useMemo(() =>
        guildOptions.filter(option => data.config.selectedGuildIds.includes(option.id)),
    [data.config.selectedGuildIds, guildOptions]);
    const filteredGuildOptions = React.useMemo(() => {
        const query = guildSearch.trim().toLowerCase();
        if (!query) return guildOptions;

        return guildOptions.filter(option =>
            option.label.toLowerCase().includes(query)
            || option.id.includes(query),
        );
    }, [guildOptions, guildSearch]);
    const filteredRuns = React.useMemo(() => {
        const query = historySearch.trim().toLowerCase();
        if (!query) return data.runs;
        return data.runs.filter(run => buildRunQuery(run).includes(query));
    }, [data.runs, historySearch]);
    const runComparisons = React.useMemo(() => {
        const comparisons = new Map<string, ReturnType<typeof buildMutualScannerRunComparison>>();

        for (let index = 0; index < data.runs.length; index++) {
            const run = data.runs[index];
            const previousRun = data.runs.slice(index + 1).find(candidate => isComparableMutualScannerRun(run, candidate)) ?? null;
            comparisons.set(run.id, buildMutualScannerRunComparison(run, previousRun));
        }

        return comparisons;
    }, [data.runs]);
    const runtimeHistoryMatches = React.useMemo(() => {
        if (!isRunning) return [] as MutualScannerMatch[];
        const now = Date.now();
        return runtimeMatches.filter(match => now - (match.matchedAt ?? now) >= LIVE_MATCH_VISIBLE_MS);
    }, [isRunning, runtimeMatches, tick]);
    const filteredRuntimeHistoryMatches = React.useMemo(() => {
        const query = historySearch.trim().toLowerCase();
        if (!query) return runtimeHistoryMatches;

        return runtimeHistoryMatches.filter(match =>
            [match.label, match.userId, ...match.guildNames].join(" ").toLowerCase().includes(query),
        );
    }, [historySearch, runtimeHistoryMatches]);
    const shouldShowRuntimeHistoryPreview = React.useMemo(() => {
        if (!isRunning || !runStartedAt || !runtime.scan.scopeLabel) return false;

        const query = historySearch.trim().toLowerCase();
        if (!query) return filteredRuntimeHistoryMatches.length > 0;

        return buildRuntimePreviewQuery(runtime.scan.scopeLabel, runtimeHistoryMatches, runtimeProgress).includes(query)
            && filteredRuntimeHistoryMatches.length > 0;
    }, [
        filteredRuntimeHistoryMatches.length,
        historySearch,
        isRunning,
        runStartedAt,
        runtime.scan.scopeLabel,
        runtimeHistoryMatches,
        runtimeProgress,
    ]);
    const progressPercent = runtimeProgress?.totalCandidates
        ? Math.min(100, Math.round((runtimeProgress.scannedCount / runtimeProgress.totalCandidates) * 100))
        : 0;
    const retryGuildIds = React.useMemo(() => {
        const selectedWeakGuildIds = data.config.selectedGuildIds.filter(guildId =>
            isHydrationSnapshotWeak(
                hydrationSnapshotMap.get(guildId),
                guildTargetCountMap.get(guildId) ?? null,
            ),
        );

        if (selectedWeakGuildIds.length > 0) {
            return selectedWeakGuildIds;
        }

        return hydrationSnapshots
            .filter(snapshot => isHydrationSnapshotWeak(snapshot, guildTargetCountMap.get(snapshot.guildId) ?? null))
            .map(snapshot => snapshot.guildId);
    }, [data.config.selectedGuildIds, guildTargetCountMap, hydrationSnapshotMap, hydrationSnapshots]);

    const clearScanStatusTimers = React.useCallback(() => {
        if (scanStatusHideTimerRef.current !== null) {
            window.clearTimeout(scanStatusHideTimerRef.current);
            scanStatusHideTimerRef.current = null;
        }

        if (scanStatusCleanupTimerRef.current !== null) {
            window.clearTimeout(scanStatusCleanupTimerRef.current);
            scanStatusCleanupTimerRef.current = null;
        }
    }, []);

    React.useEffect(() => () => clearScanStatusTimers(), [clearScanStatusTimers]);

    const clearManualWarmupTimers = React.useCallback(() => {
        if (manualWarmupHideTimerRef.current !== null) {
            window.clearTimeout(manualWarmupHideTimerRef.current);
            manualWarmupHideTimerRef.current = null;
        }

        if (manualWarmupCleanupTimerRef.current !== null) {
            window.clearTimeout(manualWarmupCleanupTimerRef.current);
            manualWarmupCleanupTimerRef.current = null;
        }
    }, []);

    React.useEffect(() => () => clearManualWarmupTimers(), [clearManualWarmupTimers]);

    React.useEffect(() => {
        if (liveRuntimeMatches.length === 0) return;

        const interval = window.setInterval(() => {
            const now = Date.now();
            setLiveRuntimeMatches(current => {
                let changed = false;
                const next: LiveRuntimeMatch[] = [];

                for (const entry of current) {
                    const age = now - entry.addedAt;
                    if (age >= LIVE_MATCH_VISIBLE_MS + LIVE_MATCH_EXIT_MS) {
                        changed = true;
                        continue;
                    }

                    if (!entry.exiting && age >= LIVE_MATCH_VISIBLE_MS) {
                        next.push({ ...entry, exiting: true });
                        changed = true;
                        continue;
                    }

                    next.push(entry);
                }

                return changed ? next : current;
            });
        }, 250);

        return () => window.clearInterval(interval);
    }, [liveRuntimeMatches.length]);

    React.useEffect(() => {
        if (!isRunning) return;

        const interval = window.setInterval(() => setTick(value => value + 1), 250);
        return () => window.clearInterval(interval);
    }, [isRunning]);

    React.useEffect(() => {
        if (isRunning) {
            clearScanStatusTimers();
            setRenderedRuntimeResult(null);
            setIsScanStatusVisible(true);
            return;
        }

        if (!runtimeResult) {
            setIsScanStatusVisible(false);
            setRenderedRuntimeResult(null);
            return;
        }

        clearScanStatusTimers();
        setRenderedRuntimeResult(runtimeResult);
        setIsScanStatusVisible(true);

        scanStatusHideTimerRef.current = window.setTimeout(() => {
            setIsScanStatusVisible(false);

            scanStatusCleanupTimerRef.current = window.setTimeout(() => {
                setRenderedRuntimeResult(current => current === runtimeResult ? null : current);
            }, SCAN_STATUS_TRANSITION_MS);
        }, SCAN_STATUS_HIDE_DELAY_MS);
    }, [clearScanStatusTimers, isRunning, runtimeResult]);

    React.useEffect(() => {
        if (isManualWarmupRunning) {
            clearManualWarmupTimers();
            if (manualWarmupProgress) {
                setRenderedManualWarmupProgress(manualWarmupProgress);
                setIsManualWarmupVisible(true);
            }
            return;
        }

        if (!manualWarmupProgress) {
            setIsManualWarmupVisible(false);
            setRenderedManualWarmupProgress(null);
            return;
        }

        clearManualWarmupTimers();
        setRenderedManualWarmupProgress(manualWarmupProgress);
        setIsManualWarmupVisible(true);

        manualWarmupHideTimerRef.current = window.setTimeout(() => {
            setIsManualWarmupVisible(false);

        manualWarmupCleanupTimerRef.current = window.setTimeout(() => {
            setRenderedManualWarmupProgress(null);
        }, SCAN_STATUS_TRANSITION_MS);
    }, MANUAL_WARMUP_HIDE_DELAY_MS);
}, [clearManualWarmupTimers, isManualWarmupRunning, manualWarmupProgress]);

    const refreshHydrationSnapshots = React.useCallback(async () => {
        if (!currentUserId) {
            setHydrationSnapshots([]);
            setHydrationPending(false);
            return;
        }

        setHydrationPending(true);
        const snapshots = await listHydratedGuildSnapshots(currentUserId);
        setHydrationSnapshots(snapshots);
        setHydrationPending(false);
    }, [currentUserId]);

    React.useEffect(() => {
        void refreshHydrationSnapshots();
    }, [refreshHydrationSnapshots, runtime.scan.revision, runtime.warmup.revision]);

    const pushLiveRuntimeMatches = React.useCallback((matches: MutualScannerMatch[], addedAt?: number) => {
        if (matches.length === 0) return;

        setLiveRuntimeMatches(current => {
            const next = [...current];
            let changed = false;

            for (const match of matches) {
                if (next.some(entry => entry.userId === match.userId)) continue;
                const entryAddedAt = addedAt ?? match.matchedAt ?? Date.now();
                const age = Date.now() - entryAddedAt;
                if (age >= LIVE_MATCH_VISIBLE_MS + LIVE_MATCH_EXIT_MS) continue;
                next.push({
                    userId: match.userId,
                    match,
                    addedAt: entryAddedAt,
                    exiting: age >= LIVE_MATCH_VISIBLE_MS,
                });
                changed = true;
            }

            return changed
                ? next.sort((left, right) => left.match.label.localeCompare(right.match.label))
                : current;
        });
    }, []);

    React.useEffect(() => {
        if (liveRuntimeSessionRef.current === runtime.scan.sessionId) return;

        liveRuntimeSessionRef.current = runtime.scan.sessionId;
        seenLiveMatchIdsRef.current = new Set();
        setLiveRuntimeMatches([]);
    }, [runtime.scan.sessionId]);

    React.useEffect(() => {
        if (runtimeMatches.length === 0) return;

        const nextMatches = runtimeMatches.filter(match => !seenLiveMatchIdsRef.current.has(match.userId));
        if (nextMatches.length === 0) return;

        for (const match of nextMatches) {
            seenLiveMatchIdsRef.current.add(match.userId);
        }

        pushLiveRuntimeMatches(nextMatches);
    }, [pushLiveRuntimeMatches, runtimeMatches]);

    const updateConfig = React.useCallback(async (patch: Partial<typeof data.config>) => {
        await updateMutualScannerConfig(currentUserId, patch);
    }, [currentUserId]);

    const toggleGuild = React.useCallback(async (guildId: string, enabled: boolean) => {
        const next = new Set(data.config.selectedGuildIds);
        if (enabled) next.add(guildId);
        else next.delete(guildId);

        await updateConfig({ selectedGuildIds: Array.from(next) });
    }, [data.config.selectedGuildIds, updateConfig]);

    const selectAllVisibleGuilds = React.useCallback(async () => {
        await updateConfig({ selectedGuildIds: Array.from(new Set(filteredGuildOptions.map(option => option.id))) });
    }, [filteredGuildOptions, updateConfig]);

    const clearGuildSelection = React.useCallback(async () => {
        await updateConfig({ selectedGuildIds: [] });
    }, [updateConfig]);

    const cancelRun = React.useCallback(() => {
        cancelMutualScannerRun();
    }, []);

    const clearHistory = React.useCallback(() => {
        Alerts.show({
            title: "Clear Mutual Scanner history?",
            body: "This removes all saved scan runs from this device only.",
            confirmText: "Clear History",
            cancelText: "Cancel",
            async onConfirm() {
                await clearMutualScannerRuns(currentUserId);
                showToast("Cleared local Mutual Scanner history.", Toasts.Type.SUCCESS);
            },
        });
    }, [currentUserId]);

    const clearHydrationCache = React.useCallback(() => {
        Alerts.show({
            title: "Clear hydration cache?",
            body: "This removes all local member-index snapshots for the current account on this device.",
            confirmText: "Clear Cache",
            cancelText: "Cancel",
            async onConfirm() {
                await clearHydratedGuildSnapshots(currentUserId);
                await refreshHydrationSnapshots();
                showToast("Cleared local hydration cache.", Toasts.Type.SUCCESS);
            },
        });
    }, [currentUserId, refreshHydrationSnapshots]);

    const clearHydrationCacheEntry = React.useCallback(async (guildId: string) => {
        await clearHydratedGuildSnapshot(currentUserId, guildId);
        await refreshHydrationSnapshots();
        showToast("Removed guild hydration snapshot.", Toasts.Type.SUCCESS);
    }, [currentUserId, refreshHydrationSnapshots]);

    const startWarmupForGuildIds = React.useCallback((guildIds: string[], successLabel: string, failureLabel: string) => {
        if (!currentUserId) return;
        if (guildIds.length === 0) {
            showToast(failureLabel, Toasts.Type.FAILURE);
            return;
        }

        const started = startMutualScannerWarmup(currentUserId, {
            selectedGuildIds: guildIds,
            warmupMemberBudget: data.config.warmupMemberBudget,
            warmupTimeoutMs: data.config.warmupTimeoutMs,
        });

        if (!started) {
            showToast("Manual cache warmup could not start.", Toasts.Type.FAILURE);
            return;
        }

        showToast(successLabel, Toasts.Type.SUCCESS);
    }, [currentUserId, data.config.warmupMemberBudget, data.config.warmupTimeoutMs]);

    const retryWeakGuilds = React.useCallback(() => {
        startWarmupForGuildIds(
            retryGuildIds,
            `Retrying cache warmup for ${retryGuildIds.length} server${retryGuildIds.length === 1 ? "" : "s"}.`,
            "No incomplete or stale guild caches need a retry right now.",
        );
    }, [retryGuildIds, startWarmupForGuildIds]);

    const rewarmGuild = React.useCallback((guildId: string) => {
        const guildLabel = GuildStore.getGuild(guildId)?.name ?? guildId;
        startWarmupForGuildIds(
            [guildId],
            `Rewarming ${guildLabel}.`,
            "This guild could not be queued for rewarm.",
        );
    }, [startWarmupForGuildIds]);

    const triggerManualWarmup = React.useCallback(() => {
        if (isManualWarmupRunning) {
            cancelMutualScannerWarmup();
            return;
        }

        if (!currentUserId) return;
        if (data.config.selectedGuildIds.length === 0) {
            showToast("Select at least one server before warming the cache.", Toasts.Type.FAILURE);
            return;
        }

        const started = startMutualScannerWarmup(currentUserId, {
            selectedGuildIds: data.config.selectedGuildIds,
            warmupMemberBudget: data.config.warmupMemberBudget,
            warmupTimeoutMs: data.config.warmupTimeoutMs,
        });

        if (!started) {
            showToast("Manual cache warmup could not start.", Toasts.Type.FAILURE);
        }
    }, [currentUserId, data.config.selectedGuildIds, data.config.warmupMemberBudget, data.config.warmupTimeoutMs, isManualWarmupRunning]);

    const startRun = React.useCallback(() => {
        if (!currentUserId) return;
        if (data.config.selectedGuildIds.length === 0) {
            showToast("Select at least one server before starting the scan.", Toasts.Type.FAILURE);
            return;
        }

        clearScanStatusTimers();
        setLiveRuntimeMatches([]);
        setRenderedRuntimeResult(null);
        setTick(0);
        seenLiveMatchIdsRef.current = new Set();

        const started = startMutualScannerRun(currentUserId, data.config);
        if (!started) {
            showToast("Mutual scan could not start.", Toasts.Type.FAILURE);
        }
    }, [clearScanStatusTimers, currentUserId, data.config]);
    const runDuration = React.useMemo(() => {
        if (!runStartedAt) return 0;
        return (runtimeResult?.finishedAt ?? Date.now()) - runStartedAt;
    }, [runStartedAt, runtimeResult?.finishedAt, tick]);
    const shouldRenderScanStatus = isRunning || renderedRuntimeResult !== null;
    const activeScanStatusResult = isRunning ? null : renderedRuntimeResult;
    const warmupProgressPercent = renderedManualWarmupProgress?.targetCount
        ? Math.min(100, Math.round((renderedManualWarmupProgress.indexedCount / renderedManualWarmupProgress.targetCount) * 100))
        : renderedManualWarmupProgress?.state === "cache" || renderedManualWarmupProgress?.state === "completed"
            ? 100
            : renderedManualWarmupProgress?.state === "queued"
                ? 10
                : renderedManualWarmupProgress?.state === "failed"
                    ? 18
                    : 32;
    const shouldRenderWarmupProgress = isManualWarmupRunning || renderedManualWarmupProgress !== null;

    return (
        <SettingsTab>
            <div className={cl("shell")}>
            <SpecialCard
                title="Mutual Scanner"
                subtitle="Any-mutual sweep"
                description={`Select the servers you want to inspect and ${BRAND_NAME} will locally scan cached members to find profiles that share at least one mutual friend with your account.`}
                cardImage={BRAND_ICON_DATA_URL}
                backgroundImage={HERO_BACKGROUND}
                backgroundColor="#23211a"
            >
                <div className={cl("hero-metrics")}>
                    <MetricTag icon={<LinkIcon width={14} height={14} />} label="Match mode" value="Any mutual" />
                    <MetricTag icon={<FolderIcon width={14} height={14} />} label="Selected servers" value={String(selectedGuilds.length)} />
                    <MetricTag icon={<ClockIcon width={14} height={14} />} label="Saved runs" value={String(data.runs.length)} />
                </div>
            </SpecialCard>

            <Notice.Info className={Margins.top20} style={{ width: "100%" }}>
                The scan is local to this client session. It uses your current Discord state, selected guild member caches, and user profile mutual data already accessible to the client. Large servers may take time and not every member is guaranteed to be loaded in cache.
            </Notice.Info>

            <div className={cl("layout")}>
                <div className={cl("main-column")}>
                    <Card className={cl("panel", "panel-shell", "scope-panel")} defaultPadding>
                        <div className={cl("section-head")}>
                            <div>
                                <Heading className={cl("section-title")} tag="h4">Server Scope</Heading>
                                <Paragraph className={cl("muted-copy")}>Pick the servers whose members should be checked for any mutual friend relationship with your account.</Paragraph>
                            </div>
                            <div className={cl("section-actions")}>
                                <TextButton variant="secondary" onClick={selectAllVisibleGuilds} disabled={isRunning || isManualWarmupRunning || filteredGuildOptions.length === 0}>Select visible</TextButton>
                                <TextButton variant="secondary" onClick={clearGuildSelection} disabled={isRunning || isManualWarmupRunning || data.config.selectedGuildIds.length === 0}>Clear</TextButton>
                            </div>
                        </div>

                        <div className={cl("scope-toolbar")}>
                            <label className={cl("search-shell", "scope-search")}>
                                <MagnifyingGlassIcon className={cl("search-icon")} width={16} height={16} />
                                <input
                                    className={cl("search-input")}
                                    type="text"
                                    value={guildSearch}
                                    placeholder="Filter servers by name or id"
                                    onChange={event => setGuildSearch(event.currentTarget.value)}
                                    disabled={isRunning}
                                    spellCheck={false}
                                />
                            </label>

                            <Button
                                variant={isManualWarmupRunning ? "overlayPrimary" : "secondary"}
                                size="iconOnly"
                                className={cl("scope-toolbar-action", isManualWarmupRunning && "scope-toolbar-action-busy")}
                                title={isManualWarmupRunning ? "Cancel manual cache warmup" : "Warm selected servers into cache"}
                                aria-label={isManualWarmupRunning ? "Cancel manual cache warmup" : "Warm selected servers into cache"}
                                disabled={!isManualWarmupRunning && (isRunning || data.config.selectedGuildIds.length === 0)}
                                onClick={triggerManualWarmup}
                            >
                                {isManualWarmupRunning
                                    ? <RestartIcon className={cl("scope-toolbar-action-icon", "scope-toolbar-action-icon-spinning")} width={16} height={16} />
                                    : <CloudUploadIcon className={cl("scope-toolbar-action-icon")} width={16} height={16} />}
                            </Button>
                        </div>

                        <div className={cl("scope-toolbar-footer")}>
                            <Paragraph className={cl("muted-copy", "scope-toolbar-status")}>
                                {isManualWarmupRunning
                                    ? manualWarmupStatus ?? "Hydrating selected servers into the local cache."
                                    : data.config.selectedGuildIds.length > 0
                                        ? `${data.config.selectedGuildIds.length} server${data.config.selectedGuildIds.length === 1 ? "" : "s"} selected for scan and optional cache warmup.`
                                        : "Select one or more servers, then start the scan or pre-warm the member cache from the upload button."}
                            </Paragraph>
                            <span className={cl("section-chip", "live-chip")}>{data.config.selectedGuildIds.length} selected</span>
                        </div>

                        <div className={cl("warmup-progress-region", isManualWarmupVisible && "warmup-progress-region-visible")}>
                            {shouldRenderWarmupProgress && renderedManualWarmupProgress && (
                                <Card className={cl("warmup-progress-card")} defaultPadding>
                                    <div className={cl("section-head", "warmup-progress-head")}>
                                        <div>
                                            <HeadingTertiary className={Margins.reset}>Manual Cache Warmup</HeadingTertiary>
                                            <Paragraph className={cl("muted-copy")}>
                                                {renderedManualWarmupProgress.guildLabel} / guild {renderedManualWarmupProgress.guildIndex} of {renderedManualWarmupProgress.totalGuilds}
                                            </Paragraph>
                                        </div>
                                        <span className={cl("section-chip", "live-chip")}>
                                            {formatManualWarmupState(renderedManualWarmupProgress.state)}
                                        </span>
                                    </div>

                                    <div className={cl("progress-copy", "warmup-progress-copy")}>
                                        <Paragraph className={cl("muted-copy")}>
                                            {renderedManualWarmupProgress.targetCount != null
                                                ? `${renderedManualWarmupProgress.indexedCount} verified / ${renderedManualWarmupProgress.targetCount} target`
                                                : `${renderedManualWarmupProgress.indexedCount} verified`}
                                        </Paragraph>
                                        <Paragraph className={cl("muted-copy")}>
                                            {renderedManualWarmupProgress.remainingCount != null
                                                ? `${renderedManualWarmupProgress.remainingCount} remaining`
                                                : `${renderedManualWarmupProgress.chunksSeen} chunks seen`}
                                        </Paragraph>
                                    </div>

                                    <div className={cl("progress-track", "warmup-progress-track")}>
                                        <div className={cl("progress-fill", "warmup-progress-fill")} style={{ width: `${warmupProgressPercent}%` }} />
                                    </div>

                                    <div className={cl("run-summary-grid", "warmup-summary-grid")}>
                                        <span className={cl("badge")}>{renderedManualWarmupProgress.indexedCount} indexed</span>
                                        {renderedManualWarmupProgress.remainingCount != null && (
                                            <span className={cl("badge", "quiet")}>{renderedManualWarmupProgress.remainingCount} left</span>
                                        )}
                                        {renderedManualWarmupProgress.chunksSeen > 0 && (
                                            <span className={cl("badge", "quiet")}>{renderedManualWarmupProgress.chunksSeen} chunks</span>
                                        )}
                                        <span className={cl("badge", renderedManualWarmupProgress.delta > 0 ? "warn" : "quiet")}>
                                            +{renderedManualWarmupProgress.delta} hydrated
                                        </span>
                                    </div>
                                </Card>
                            )}
                        </div>

                        <div className={cl("guild-list")}>
                            {pending && filteredGuildOptions.length === 0 && (
                                <>
                                    <SkeletonCard compact />
                                    <SkeletonCard compact />
                                    <SkeletonCard compact />
                                </>
                            )}

                            {filteredGuildOptions.map(option => {
                                const selected = data.config.selectedGuildIds.includes(option.id);

                                return (
                                    <Card key={option.id} className={cl("guild-card")}>
                                        <div className={cl("guild-copy")}>
                                            <div className={cl("guild-title-row")}>
                                                {option.iconUrl
                                                    ? <img className={cl("guild-icon")} src={option.iconUrl} alt="" />
                                                    : <div className={cl("guild-fallback-icon")}>{option.label.slice(0, 1)}</div>}
                                                <div>
                                                    <HeadingTertiary className={Margins.reset}>{option.label}</HeadingTertiary>
                                                    <Paragraph className={cl("muted-copy")}>
                                                        {option.memberCount} cached members / {option.id}
                                                    </Paragraph>
                                                </div>
                                            </div>
                                        </div>

                                        <Switch checked={selected} disabled={isManualWarmupRunning} onChange={(checked: boolean) => void toggleGuild(option.id, checked)} />
                                    </Card>
                                );
                            })}

                            {filteredGuildOptions.length === 0 && (
                                <div className={cl("empty-inline")}>
                                    <FolderIcon className={cl("empty-inline-icon")} />
                                    <Paragraph className={cl("muted-copy")}>No servers match this filter.</Paragraph>
                                </div>
                            )}
                        </div>
                    </Card>

                    <Card className={cl("panel", "panel-shell", "live-panel")} defaultPadding>
                        <div className={cl("section-head")}>
                            <div>
                                <Heading className={cl("section-title")} tag="h4">Live Run</Heading>
                                <Paragraph className={cl("muted-copy")}>Run the sweep sequentially, watch matches appear, and stop it at any time.</Paragraph>
                            </div>
                            <span className={cl("section-chip")}>{isRunning ? formatProgress(runtimeProgress) : "Idle"}</span>
                        </div>

                        <div className={cl("filter-surface")}>
                            <div className={cl("config-grid")}>
                            <label className={cl("field")}>
                                <span className={cl("field-label")}>Delay between profiles (ms)</span>
                                <input
                                    className={cl("input")}
                                    type="number"
                                    min={0}
                                    max={5000}
                                    value={data.config.requestDelayMs}
                                    onChange={event => void updateConfig({ requestDelayMs: clampNumber(Number(event.currentTarget.value) || 0, 0, 5000) })}
                                    disabled={isRunning}
                                />
                            </label>

                            <label className={cl("field")}>
                                <span className={cl("field-label")}>Max members per server</span>
                                <input
                                    className={cl("input")}
                                    type="number"
                                    min={0}
                                    max={50000}
                                    value={data.config.maxMembersPerGuild}
                                    onChange={event => void updateConfig({ maxMembersPerGuild: clampNumber(Number(event.currentTarget.value) || 0, 0, 50000) })}
                                    disabled={isRunning}
                                />
                            </label>

                            <label className={cl("field")}>
                                <span className={cl("field-label")}>Warmup timeout per server (ms)</span>
                                <input
                                    className={cl("input")}
                                    type="number"
                                    min={500}
                                    max={20000}
                                    value={data.config.warmupTimeoutMs}
                                    onChange={event => void updateConfig({ warmupTimeoutMs: clampNumber(Number(event.currentTarget.value) || 0, 500, 20000) })}
                                    disabled={isRunning || !data.config.warmMemberCacheBeforeScan}
                                />
                            </label>

                            <label className={cl("field")}>
                                <span className={cl("field-label")}>Warmup member budget</span>
                                <input
                                    className={cl("input")}
                                    type="number"
                                    min={0}
                                    max={100000}
                                    value={data.config.warmupMemberBudget}
                                    onChange={event => void updateConfig({ warmupMemberBudget: clampNumber(Number(event.currentTarget.value) || 0, 0, 100000) })}
                                    disabled={isRunning || !data.config.warmMemberCacheBeforeScan}
                                />
                            </label>
                            </div>

                            <div className={cl("toggle-grid")}>
                                <div className={cl("toggle-row")}>
                                    <div>
                                        <HeadingTertiary className={Margins.reset}>Include bots</HeadingTertiary>
                                        <Paragraph className={cl("muted-copy")}>Leave off if you only care about human accounts.</Paragraph>
                                    </div>
                                    <Switch checked={data.config.includeBots} onChange={(checked: boolean) => void updateConfig({ includeBots: checked })} />
                                </div>

                                <div className={cl("toggle-row")}>
                                    <div>
                                        <HeadingTertiary className={Margins.reset}>Skip users already in your friends</HeadingTertiary>
                                        <Paragraph className={cl("muted-copy")}>Useful if you only want new or non-friend candidates.</Paragraph>
                                    </div>
                                    <Switch checked={data.config.skipExistingFriends} onChange={(checked: boolean) => void updateConfig({ skipExistingFriends: checked })} />
                                </div>

                                <div className={cl("toggle-row")}>
                                    <div>
                                        <HeadingTertiary className={Margins.reset}>Warm member cache before scan</HeadingTertiary>
                                        <Paragraph className={cl("muted-copy")}>Attempts to expand each selected guild beyond what is already in GuildMemberStore before scanning.</Paragraph>
                                    </div>
                                    <Switch checked={data.config.warmMemberCacheBeforeScan} onChange={(checked: boolean) => void updateConfig({ warmMemberCacheBeforeScan: checked })} />
                                </div>
                            </div>
                        </div>

                        <div className={cl("run-actions-row")}>
                            <Button
                                variant="positive"
                                size="small"
                                className={cl("primary-action")}
                                disabled={isRunning || isManualWarmupRunning || data.config.selectedGuildIds.length === 0}
                                onClick={startRun}
                            >
                                <MagnifyingGlassIcon width={14} height={14} />
                                <span>Start Scan</span>
                            </Button>
                            <Button
                                variant="dangerPrimary"
                                size="small"
                                disabled={!isRunning}
                                onClick={cancelRun}
                            >
                                Cancel
                            </Button>
                            <TextButton variant="danger" disabled={data.runs.length === 0 || isRunning} onClick={clearHistory}>
                                Clear History
                            </TextButton>
                        </div>

                        <div
                            className={cl(
                                "scan-status-region",
                                shouldRenderScanStatus && "scan-status-region-mounted",
                                isScanStatusVisible ? "scan-status-region-visible" : "scan-status-region-hidden",
                            )}
                        >
                            {shouldRenderScanStatus && (
                                <ScanStatusBanner
                                    progress={runtimeProgress}
                                    result={activeScanStatusResult}
                                    runDuration={runDuration}
                                />
                            )}
                        </div>

                        <div className={cl("progress-shell")}>
                            <div className={cl("progress-copy")}>
                                <Paragraph className={cl("muted-copy")}>
                                    {runtimeProgress?.currentLabel
                                        ? `Current profile: ${runtimeProgress.currentLabel}`
                                        : "No active profile."}
                                </Paragraph>
                                <Paragraph className={cl("muted-copy")}>
                                    {runStartedAt ? `Runtime ${formatDurationMs(runDuration)}` : "Waiting for a new run."}
                                </Paragraph>
                            </div>
                            <div className={cl("progress-track")}>
                                <div className={cl("progress-fill")} style={{ width: `${progressPercent}%` }} />
                            </div>
                        </div>

                        <div className={cl("run-summary-grid")}>
                            <span className={cl("badge")}>{runtimeProgress?.matchedCount ?? runtimeMatches.length} matches</span>
                            <span className={cl("badge", "quiet")}>{runtimeProgress?.scannedCount ?? 0} scanned</span>
                            <span className={cl("badge", "quiet")}>{runtimeProgress?.profileErrors ?? 0} errors</span>
                            {(runtimeProgress?.countOnlyMatches ?? 0) > 0 && <span className={cl("badge", "warn")}>{runtimeProgress?.countOnlyMatches} count-only</span>}
                        </div>

                        <div className={cl("live-results")}>
                            {isRunning && liveRuntimeMatches.length === 0 && (
                                <>
                                    <SkeletonCard />
                                    <SkeletonCard />
                                    <SkeletonCard compact />
                                </>
                            )}

                            {liveRuntimeMatches.length === 0 && !isRunning && (
                                <Card className={cl("empty-card")} defaultPadding>
                                    <MagnifyingGlassIcon className={cl("empty-icon")} />
                                    <HeadingTertiary>Run a scan to populate live matches</HeadingTertiary>
                                    <Paragraph className={cl("muted-copy")}>Results appear here as soon as the scanner finds profiles with any mutual friend relationship, then fade out after 30s while the saved run stays in history.</Paragraph>
                                </Card>
                            )}

                            {liveRuntimeMatches.map((entry, index) => (
                                <LiveMatchRow
                                    key={entry.userId}
                                    match={entry.match}
                                    index={index}
                                    exiting={entry.exiting}
                                />
                            ))}
                        </div>

                        {runtimeResult?.status === "completed" && runtimeResult.stats.countOnlyMatches > 0 && (
                            <Notice.Info className={cl("inline-notice")}>
                                {runtimeResult.stats.countOnlyMatches} matches were accepted from mutual-friend count data only. Those are valid `has mutual` hits, but the client did not expose the resolved mutual-friend names for them.
                            </Notice.Info>
                        )}

                        {data.config.warmMemberCacheBeforeScan && (
                            <Notice.Info className={cl("inline-notice")}>
                                Warmup runs one guild at a time through the shared hydration service. It can reuse a temporary local member index from recent runs, stops on timeout, or earlier if the per-guild member budget is reached. Set the budget to 0 for no member cap.
                            </Notice.Info>
                        )}
                    </Card>
                </div>

                <div className={cl("side-column")}>
                    <Card className={cl("panel", "panel-shell", "history-panel")} defaultPadding>
                        <div className={cl("section-head")}>
                            <div>
                                <Heading className={cl("section-title")} tag="h4">Run History</Heading>
                                <Paragraph className={cl("muted-copy")}>Saved locally per account on this device.</Paragraph>
                            </div>
                            <span className={cl("section-chip")}>{data.runs.length} runs</span>
                        </div>

                        <label className={cl("search-shell")}>
                            <MagnifyingGlassIcon className={cl("search-icon")} width={16} height={16} />
                            <input
                                className={cl("search-input")}
                                type="text"
                                value={historySearch}
                                placeholder="Search history by scope, user, or guild"
                                onChange={event => setHistorySearch(event.currentTarget.value)}
                                disabled={isRunning}
                                spellCheck={false}
                            />
                        </label>

                        <div className={cl("history-list")}>
                            {pending && (
                                <>
                                    <SkeletonCard />
                                    <SkeletonCard compact />
                                </>
                            )}

                            {!pending && shouldShowRuntimeHistoryPreview && runStartedAt && runtime.scan.scopeLabel && (
                                <RuntimePreviewRunCard
                                    scopeLabel={runtime.scan.scopeLabel}
                                    startedAt={runStartedAt}
                                    progress={runtimeProgress}
                                    matches={filteredRuntimeHistoryMatches}
                                />
                            )}

                            {!pending && filteredRuns.length === 0 && !shouldShowRuntimeHistoryPreview && (
                                <Card className={cl("empty-card")} defaultPadding>
                                    <LogIcon className={cl("empty-icon")} />
                                    <HeadingTertiary>No saved runs match this filter</HeadingTertiary>
                                    <Paragraph className={cl("muted-copy")}>Broaden the search or run a new scan to build a stronger local history.</Paragraph>
                                </Card>
                            )}

                            {filteredRuns.map(run => (
                                <RunCard
                                    key={run.id}
                                    run={run}
                                    comparison={runComparisons.get(run.id) ?? buildMutualScannerRunComparison(run, null)}
                                    onRemove={() => void removeMutualScannerRun(currentUserId, run.id)}
                                />
                            ))}
                        </div>
                    </Card>

                    <Card className={cl("panel", "panel-shell", "cache-panel")} defaultPadding>
                        <div className={cl("section-head")}>
                            <div>
                                <Heading className={cl("section-title")} tag="h4">Hydration Cache</Heading>
                                <Paragraph className={cl("muted-copy")}>Temporary member-index snapshots reused by the shared hydration service.</Paragraph>
                            </div>
                            <div className={cl("section-actions")}>
                                <span className={cl("section-chip")}>{hydrationSnapshots.length} cached</span>
                                <TextButton
                                    variant="secondary"
                                    disabled={retryGuildIds.length === 0 || hydrationPending || isManualWarmupRunning || isRunning}
                                    onClick={retryWeakGuilds}
                                >
                                    Retry Weak Guilds
                                </TextButton>
                                <TextButton variant="danger" disabled={hydrationSnapshots.length === 0 || hydrationPending} onClick={clearHydrationCache}>Clear All</TextButton>
                            </div>
                        </div>

                        <div className={cl("history-list", "cache-list")}>
                            {hydrationPending && (
                                <>
                                    <SkeletonCard compact />
                                    <SkeletonCard compact />
                                </>
                            )}

                            {!hydrationPending && hydrationSnapshots.length === 0 && (
                                <Card className={cl("empty-card")} defaultPadding>
                                    <CloudUploadIcon className={cl("empty-icon")} />
                                    <HeadingTertiary>No hydration snapshots yet</HeadingTertiary>
                                    <Paragraph className={cl("muted-copy")}>Run a warmup-enabled scan and the selected guilds will start building temporary local member indexes here.</Paragraph>
                                </Card>
                            )}

                            {!hydrationPending && hydrationSnapshots.map(snapshot => (
                                <HydrationCacheRow
                                    key={`${snapshot.guildId}:${snapshot.warmedAt}`}
                                    snapshot={snapshot}
                                    quality={getHydrationSnapshotQuality(snapshot, guildTargetCountMap.get(snapshot.guildId) ?? null)}
                                    targetCount={guildTargetCountMap.get(snapshot.guildId) ?? null}
                                    onRewarm={() => rewarmGuild(snapshot.guildId)}
                                    rewarmDisabled={isManualWarmupRunning || isRunning}
                                    onClear={() => void clearHydrationCacheEntry(snapshot.guildId)}
                                />
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
            </div>
        </SettingsTab>
    );
}

export default wrapTab(MutualScannerTab, "Mutual Scanner");
