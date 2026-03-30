/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { classes } from "@utils/misc";
import { useAwaiter } from "@utils/react";
import definePlugin, { PluginNative } from "@utils/types";
import type { User } from "@vencord/discord-types";
import { findCssClassesLazy } from "@webpack";
import { Clickable, useState } from "@webpack/common";

import { fetchCordCatBreaches, fetchDsaWarnings, getActionTags, getActiveRestrictionLabels, invalidateWarnings } from "./api";
import managedStyle from "./style.css?managed";
import type { BreachRecord, DsaAction } from "./types";

const cl = classNameFactory("vc-dsa-warnings-");
const DMSideBarClasses = findCssClassesLazy("widgetPreviews");
const MAX_VISIBLE_CARDS = 4;
const Native = VencordNative.pluginHelpers.DsaWarnings as PluginNative<typeof import("./native")>;
function getColorBrightness(color: number) {
    const red = (color >> 16) & 0xff;
    const green = (color >> 8) & 0xff;
    const blue = color & 0xff;

    return (red * 299 + green * 587 + blue * 114) / 1000;
}

function hasLightProfileTheme(displayProfile: { themeColors?: number[] | null; accentColor?: number | null; } | undefined) {
    const colors = displayProfile?.themeColors?.filter(color => Number.isFinite(color)) ?? [];
    if (colors.length > 0) {
        const average = colors.reduce((total, color) => total + getColorBrightness(color), 0) / colors.length;
        return average >= 160;
    }

    if (displayProfile?.accentColor != null) {
        return getColorBrightness(displayProfile.accentColor) >= 160;
    }

    return false;
}

function formatLabel(value: string) {
    return value
        .replace(/^STATEMENT_CATEGORY_/, "")
        .replace(/^KEYWORD_/, "")
        .replace(/^DECISION_(ACCOUNT|VISIBILITY|PROVISION|MONETARY)_/, "")
        .replace(/^CONTENT_TYPE_/, "")
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, character => character.toUpperCase());
}

function formatDate(value: string) {
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) return value;

    return new Date(parsed).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric"
    });
}

function buildDsaBrowseUrl(parsedId: string) {
    const url = new URL("https://dsa.discord.food/browse");
    url.searchParams.set("parsedId", parsedId);
    url.searchParams.set("sort", "applicationDate");
    url.searchParams.set("order", "desc");
    return url.toString();
}

function buildCordCatUrl(parsedId: string) {
    return new URL(`https://cord.cat/${parsedId}`).toString();
}

function getCardTags(action: DsaAction) {
    return getActionTags(action).slice(0, 3);
}

function getBreachTags(breach: BreachRecord) {
    return (breach.categories ?? []).filter(Boolean).slice(0, 3);
}

function getBreachName(breach: BreachRecord) {
    return breach.username || breach.discordname || "Unknown account";
}

function getBreachSummary(breach: BreachRecord) {
    const parts = [
        breach.ip && breach.ip !== "None" ? `IP ${breach.ip}` : null,
        breach.discriminator || breach.tag ? `Tag #${breach.discriminator || breach.tag}` : null,
        breach.id || breach.no ? `Record ${breach.id || breach.no}` : null
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(" • ") : "Listed in a known breach dataset";
}

function StatusCard({
    title,
    message,
    onClick
}: {
    title: string;
    message: string;
    onClick?: () => void | Promise<void>;
}) {
    return (
        <Clickable className={cl("card")} onClick={onClick ?? (() => null)}>
            <div className={cl("card-top")}>
                <div className={cl("card-left")}>
                    <div className={cl("glyph")}>!</div>
                    <div className={cl("card-content")}>
                        <div className={cl("chip-row")}>
                            <span className={cl("chip", "chip-user")}>DSA Lookup</span>
                        </div>
                        <BaseText className={cl("category")} size="xl" weight="extrabold" defaultColor={false}>{title}</BaseText>
                        <BaseText className={cl("facts")} size="sm" weight="medium" defaultColor={false}>{message}</BaseText>
                    </div>
                </div>
            </div>
        </Clickable>
    );
}

const DsaWarningsCollection = ErrorBoundary.wrap(function DsaWarningsCollection({
    user,
    displayProfile,
    isSideBar = false
}: {
    user: User;
    displayProfile?: { themeColors?: number[] | null; accentColor?: number | null; };
    isSideBar?: boolean;
}) {
    const [refreshKey, setRefreshKey] = useState(0);
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
    const [warnings] = useAwaiter(() => fetchDsaWarnings(user.id), {
        deps: [user.id, refreshKey],
        fallbackValue: null
    });
    const [breaches] = useAwaiter(() => fetchCordCatBreaches(user.id), {
        deps: [user.id, refreshKey],
        fallbackValue: { breaches: [], breachStatus: "unavailable" as const }
    });

    const isExpanded = expandedUserId === user.id;
    const isLightTheme = hasLightProfileTheme(displayProfile);
    const subtitle = warnings == null
        ? "Loading DSA lookup..."
        : warnings.kind === "ready"
        ? breaches.breachStatus === "ready"
            ? `${warnings.actions.length} warnings • ${breaches.breaches.length} breaches`
            : `${warnings.actions.length} warnings • breach lookup unavailable`
        : "Direct API lookup is currently unavailable";
    const retryFetch = () => {
        invalidateWarnings(user.id);
        setRefreshKey(current => current + 1);
    };
    const openCaptchaWindow = async () => {
        if (Native.openCaptchaWindow) {
            await Native.openCaptchaWindow(user.id);
            retryFetch();
            return;
        }

        VencordNative.native.openExternal(buildDsaBrowseUrl(user.id));
        retryFetch();
    };
    const visibleActions = warnings?.kind === "ready" && isExpanded ? warnings.actions : warnings?.kind === "ready" ? warnings.actions.slice(0, MAX_VISIBLE_CARDS) : [];
    const visibleBreaches = isExpanded ? breaches.breaches : breaches.breaches.slice(0, MAX_VISIBLE_CARDS);
    const isReady = warnings?.kind === "ready";
    const isCaptcha = warnings?.kind === "captcha";
    const isUnavailable = warnings?.kind === "unavailable";
    const isError = warnings?.kind === "error";

    const content = (
        <section className={classes(cl("section"), isLightTheme && cl("light"))}>
            <div className={cl("header")}>
                <div className={cl("header-main")}>
                    <BaseText className={cl("title")} size="md" weight="bold" defaultColor={false}>Active DSA Warnings</BaseText>
                    <BaseText className={cl("count")} size="xs" weight="semibold" defaultColor={false}>{subtitle}</BaseText>
                </div>
                <Clickable className={cl("open")} onClick={() => VencordNative.native.openExternal(buildDsaBrowseUrl(user.id))}>
                    <BaseText tag="span" size="xs" weight="bold" defaultColor={false}>Open DSA Lookup</BaseText>
                </Clickable>
            </div>
            <div className={cl("list")}>
                {warnings == null && (
                    <StatusCard
                        title="Loading Warnings"
                        message="Fetching active DSA warnings for this profile."
                    />
                )}
                {isReady && visibleActions.length > 0 && visibleActions.map(action => {
                    const restrictionLabels = getActiveRestrictionLabels(action).slice(0, 2);
                    const tags = getCardTags(action);

                    return (
                        <Clickable
                            className={cl("card")}
                            key={action.uuid}
                            onClick={() => VencordNative.native.openExternal(buildDsaBrowseUrl(action.parsedId))}
                        >
                            <div className={cl("card-top")}>
                                <div className={cl("card-left")}>
                                    <div className={cl("glyph")}>!</div>
                                    <div className={cl("card-content")}>
                                        <div className={cl("chip-row")}>
                                            <span className={cl("chip", "chip-user")}>User Action</span>
                                            {restrictionLabels.map(label => (
                                                <span className={cl("chip", "chip-restriction")} key={label}>
                                                    {formatLabel(label)}
                                                </span>
                                            ))}
                                        </div>
                                        <BaseText className={cl("category")} size="xl" weight="extrabold" defaultColor={false}>
                                            {formatLabel(action.category)}
                                        </BaseText>
                                        <BaseText className={cl("facts")} size="sm" weight="medium" defaultColor={false}>
                                            {action.decisionFacts}
                                        </BaseText>
                                        {!!tags.length && (
                                            <div className={cl("chip-row")}>
                                                {tags.map(tag => (
                                                    <span className={cl("chip", "chip-tag")} key={tag}>
                                                        {formatLabel(tag)}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className={cl("card-meta")}>
                                    <BaseText className={cl("date")} size="xs" weight="bold" defaultColor={false}>
                                        {formatDate(action.applicationDate)}
                                    </BaseText>
                                </div>
                            </div>
                        </Clickable>
                    );
                })}
                {isReady && visibleBreaches.map((breach, index) => {
                    const tags = getBreachTags(breach);

                    return (
                        <Clickable
                            className={classes(cl("card"), cl("card-breach"))}
                            key={`${breach.source}-${breach.id || breach.no || index}`}
                            onClick={() => VencordNative.native.openExternal(buildCordCatUrl(user.id))}
                        >
                            <div className={cl("card-top")}>
                                <div className={cl("card-left")}>
                                    <div className={classes(cl("glyph"), cl("glyph-breach"))}>!</div>
                                    <div className={cl("card-content")}>
                                        <div className={cl("chip-row")}>
                                            <span className={cl("chip", "chip-breach")}>Data Breach</span>
                                            <span className={cl("chip", "chip-tag")}>{breach.source}</span>
                                        </div>
                                        <BaseText className={cl("category")} size="xl" weight="extrabold" defaultColor={false}>
                                            {getBreachName(breach)}
                                        </BaseText>
                                        <BaseText className={cl("facts")} size="sm" weight="medium" defaultColor={false}>
                                            {getBreachSummary(breach)}
                                        </BaseText>
                                        {!!tags.length && (
                                            <div className={cl("chip-row")}>
                                                {tags.map(tag => (
                                                    <span className={cl("chip", "chip-breach-tag")} key={tag}>
                                                        {formatLabel(tag)}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className={cl("card-meta")}>
                                    <BaseText className={cl("date")} size="xs" weight="bold" defaultColor={false}>
                                        {breach.date ? formatDate(breach.date) : "Unknown date"}
                                    </BaseText>
                                </div>
                            </div>
                        </Clickable>
                    );
                })}
                {isReady && warnings.actions.length === 0 && breaches.breaches.length === 0 && (
                    <StatusCard
                        title="No Intelligence Results"
                        message="No active warnings or breach results were returned for this profile."
                        onClick={() => VencordNative.native.openExternal(buildDsaBrowseUrl(user.id))}
                    />
                )}
                {isReady && breaches.breachStatus === "unavailable" && breaches.breaches.length === 0 && (
                    <StatusCard
                        title="Breach Lookup Unavailable"
                        message="CordCat returned the user intelligence report, but the upstream breach provider was blocked or unavailable for this lookup."
                        onClick={() => VencordNative.native.openExternal(buildCordCatUrl(user.id))}
                    />
                )}
                {isCaptcha && (
                    <StatusCard
                        title="Captcha Required"
                        message="Click to complete the DSA lookup challenge in a local Discord window, then this card will retry automatically."
                        onClick={openCaptchaWindow}
                    />
                )}
                {isUnavailable && (
                    <StatusCard
                        title="Lookup Unavailable"
                        message="The DSA service is temporarily unavailable. Click to retry in the public lookup page."
                        onClick={() => VencordNative.native.openExternal(buildDsaBrowseUrl(user.id))}
                    />
                )}
                {isError && (
                    <StatusCard
                        title="Lookup Failed"
                        message="The DSA lookup request failed. Click to retry with a local lookup window."
                        onClick={openCaptchaWindow}
                    />
                )}
            </div>
            {isReady && (warnings.actions.length > MAX_VISIBLE_CARDS || breaches.breaches.length > MAX_VISIBLE_CARDS || warnings.actions.length + breaches.breaches.length > MAX_VISIBLE_CARDS) && (
                <Clickable
                    className={cl("toggle")}
                    onClick={() => setExpandedUserId(current => current === user.id ? null : user.id)}
                >
                    <BaseText className={cl("toggle-text")} tag="span" size="xs" weight="bold" defaultColor={false}>
                        {isExpanded ? "Show Less" : `Show All ${warnings.actions.length + breaches.breaches.length} Results`}
                    </BaseText>
                </Clickable>
            )}
        </section>
    );

    return isSideBar
        ? <div className={classes(DMSideBarClasses.widgetPreviews, cl("sidebar"))}>{content}</div>
        : content;
}, { noop: true });

export default definePlugin({
    name: "DsaWarnings",
    description: "Shows active DSA standing warnings on user profiles.",
    authors: [EquicordDevs.omaw],
    managedStyle,
    renderProfileCollection: (props: { user: User; isSideBar?: boolean; displayProfile?: { themeColors?: number[] | null; accentColor?: number | null; }; }) => <DsaWarningsCollection {...props} />,
});
