/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { PluginNative } from "@utils/types";

import type { BreachRecord, CordCatQueryResponse, DsaAction, DsaLookupResult } from "./types";

const logger = new Logger("DsaWarnings");
const DSA_SEARCH_URL = "https://dsa.discord.food/api/search";
const CORDCAT_QUERY_URL = "https://api.cord.cat/api/v1/query";
const REQUEST_TIMEOUT_MS = 8000;
const SUCCESS_CACHE_TTL_MS = 5 * 60 * 1000;
const ERROR_CACHE_TTL_MS = 60 * 1000;
const Native = VencordNative.pluginHelpers.DsaWarnings as PluginNative<typeof import("./native")>;

const dsaCache = new Map<string, { expiresAt: number; result: Exclude<DsaLookupResult, { kind: "ready"; }>; } | { expiresAt: number; result: { kind: "ready"; actions: DsaAction[]; }; }>();
const breachCache = new Map<string, { expiresAt: number; result: { breaches: BreachRecord[]; breachStatus: "ready" | "unavailable"; }; }>();

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function parseStringArray(value: unknown) {
    if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === "string" && item.length > 0);
    }

    if (value == null || typeof value !== "string" || value.length === 0) {
        return [];
    }

    try {
        const parsed: unknown = JSON.parse(value);
        return Array.isArray(parsed)
            ? parsed.filter((item): item is string => typeof item === "string" && item.length > 0)
            : [];
    } catch {
        return [];
    }
}

function isNullableString(value: unknown): value is string | null {
    return value == null || typeof value === "string";
}

function isCaptchaResponse(value: unknown) {
    return (
        isRecord(value) &&
        typeof value.message === "string" &&
        typeof value.code === "number" &&
        value.code === 10012 &&
        value.type === "cloudflare"
    );
}

function isDsaSearchResponse(value: unknown): value is { actions: unknown[]; } {
    return isRecord(value) && Array.isArray(value.actions);
}

function isCordCatResponse(value: unknown): value is CordCatQueryResponse {
    return isRecord(value) && Array.isArray(value.statements);
}

function isBreachRecord(value: unknown): value is BreachRecord {
    if (!isRecord(value) || typeof value.source !== "string") return false;

    return value.categories == null || Array.isArray(value.categories) && value.categories.every(item => typeof item === "string");
}

function getString(record: Record<string, unknown>, key: string) {
    return typeof record[key] === "string" ? record[key] : "";
}

function getNullableString(record: Record<string, unknown>, key: string) {
    return isNullableString(record[key]) ? record[key] : null;
}

function normalizeDsaAction(value: unknown): DsaAction | null {
    if (!isRecord(value) || typeof value.uuid !== "string" || typeof value.parsedId !== "string") {
        return null;
    }

    return {
        uuid: value.uuid,
        parsedId: value.parsedId,
        decisionVisibility: value.decisionVisibility as string | string[] | null,
        endDateVisibilityRestriction: getNullableString(value, "endDateVisibilityRestriction"),
        decisionMonetary: getNullableString(value, "decisionMonetary"),
        endDateMonetaryRestriction: getNullableString(value, "endDateMonetaryRestriction"),
        decisionProvision: getNullableString(value, "decisionProvision"),
        endDateServiceRestriction: getNullableString(value, "endDateServiceRestriction"),
        decisionAccount: getNullableString(value, "decisionAccount"),
        endDateAccountRestriction: getNullableString(value, "endDateAccountRestriction"),
        decisionGround: getString(value, "decisionGround"),
        incompatibleContentGround: getString(value, "incompatibleContentGround"),
        incompatibleContentExplanation: getString(value, "incompatibleContentExplanation"),
        incompatibleContentIllegal: value.incompatibleContentIllegal as string | boolean | null,
        category: getString(value, "category"),
        categorySpecification: value.categorySpecification as string | string[] | null,
        contentType: value.contentType as string | string[],
        applicationDate: getString(value, "applicationDate"),
        decisionFacts: getString(value, "decisionFacts"),
        automatedDetection: value.automatedDetection as string | boolean,
        sourceType: getString(value, "sourceType"),
        createdAt: getString(value, "createdAt")
    };
}

function isRestrictionActive(endDate: string | null) {
    if (endDate == null || endDate.length === 0) return true;

    const parsed = Date.parse(endDate);
    if (Number.isNaN(parsed)) return true;

    return parsed > Date.now();
}

function asNonEmptyString(value: string | null | undefined) {
    return typeof value === "string" && value.length > 0 ? value : null;
}

export function getActiveRestrictionLabels(action: DsaAction) {
    const labels: string[] = [];
    const decisionVisibility = Array.isArray(action.decisionVisibility)
        ? action.decisionVisibility
        : asNonEmptyString(action.decisionVisibility)
            ? [action.decisionVisibility]
            : [];

    if (action.decisionAccount && isRestrictionActive(action.endDateAccountRestriction)) {
        labels.push(action.decisionAccount);
    }

    if (action.decisionProvision && isRestrictionActive(action.endDateServiceRestriction)) {
        labels.push(action.decisionProvision);
    }

    if (action.decisionMonetary && isRestrictionActive(action.endDateMonetaryRestriction)) {
        labels.push(action.decisionMonetary);
    }

    if (decisionVisibility.length && isRestrictionActive(action.endDateVisibilityRestriction)) {
        labels.push(...decisionVisibility);
    }

    return Array.from(new Set(labels.filter(Boolean)));
}

export function getActionTags(action: DsaAction) {
    return parseStringArray(action.categorySpecification);
}

function setDsaCache(parsedId: string, result: Exclude<DsaLookupResult, { kind: "ready"; }> | { kind: "ready"; actions: DsaAction[]; }) {
    const ttl = result.kind === "ready" ? SUCCESS_CACHE_TTL_MS : ERROR_CACHE_TTL_MS;
    dsaCache.set(parsedId, {
        expiresAt: Date.now() + ttl,
        result
    });

    return result;
}

function setBreachCache(parsedId: string, result: { breaches: BreachRecord[]; breachStatus: "ready" | "unavailable"; }) {
    breachCache.set(parsedId, {
        expiresAt: Date.now() + SUCCESS_CACHE_TTL_MS,
        result
    });

    return result;
}

export function invalidateWarnings(parsedId?: string) {
    if (parsedId) {
        dsaCache.delete(parsedId);
        breachCache.delete(parsedId);
        return;
    }

    dsaCache.clear();
    breachCache.clear();
}

async function fetchJson(url: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(url, { signal: controller.signal });
        const payload: unknown = await response.json().catch(() => null);
        return { response, payload };
    } finally {
        clearTimeout(timeout);
    }
}

export async function fetchDsaWarnings(parsedId: string) {
    const cached = dsaCache.get(parsedId);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.result;
    }

    const nativeResult = await Native.fetchSearch?.(parsedId);
    if (nativeResult?.ok) {
        const payload: unknown = JSON.parse(nativeResult.body);

        if (nativeResult.status === 503) {
            return setDsaCache(parsedId, { kind: "unavailable" });
        }

        if (nativeResult.status >= 200 && nativeResult.status < 300 && isDsaSearchResponse(payload)) {
            return setDsaCache(parsedId, {
                kind: "ready",
                actions: payload.actions
                    .map(normalizeDsaAction)
                    .filter((action): action is DsaAction => action !== null)
                    .filter(action => getActiveRestrictionLabels(action).length > 0)
                    .sort((a, b) => Date.parse(b.applicationDate) - Date.parse(a.applicationDate))
            });
        }
    }

    const url = new URL(DSA_SEARCH_URL);
    url.searchParams.set("parsedId", parsedId);
    url.searchParams.set("limit", "50");
    url.searchParams.set("sort", "applicationDate");
    url.searchParams.set("order", "desc");
    url.searchParams.set("includeTotalCount", "true");

    const { response, payload } = await fetchJson(url.toString());

    if (response.status === 503) {
        return setDsaCache(parsedId, { kind: "unavailable" });
    }

    if (!response.ok) {
        if (isCaptchaResponse(payload)) {
            return setDsaCache(parsedId, { kind: "captcha" });
        }

        return setDsaCache(parsedId, { kind: "error" });
    }

    if (!isDsaSearchResponse(payload)) {
        return setDsaCache(parsedId, { kind: "error" });
    }

    return setDsaCache(parsedId, {
        kind: "ready",
        actions: payload.actions
            .map(normalizeDsaAction)
            .filter((action): action is DsaAction => action !== null)
            .filter(action => getActiveRestrictionLabels(action).length > 0)
            .sort((a, b) => Date.parse(b.applicationDate) - Date.parse(a.applicationDate))
    });
}

export async function fetchCordCatBreaches(parsedId: string) {
    const cached = breachCache.get(parsedId);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.result;
    }

    try {
        const { response, payload } = await fetchJson(`${CORDCAT_QUERY_URL}/${encodeURIComponent(parsedId)}`);
        if (!response.ok || !isCordCatResponse(payload)) {
            return setBreachCache(parsedId, { breaches: [], breachStatus: "unavailable" });
        }

        return setBreachCache(parsedId, {
            breaches: payload.breach?.success ? (payload.breach.data?.results ?? []).filter(isBreachRecord) : [],
            breachStatus: payload.breach?.success ? "ready" as const : "unavailable" as const
        });
    } catch (error) {
        logger.error(`Failed to fetch CordCat breaches for ${parsedId}`, error);
        return setBreachCache(parsedId, { breaches: [], breachStatus: "unavailable" });
    }
}

export async function fetchActiveWarnings(parsedId: string): Promise<DsaLookupResult> {
    try {
        const [warnings, breaches] = await Promise.all([
            fetchDsaWarnings(parsedId),
            fetchCordCatBreaches(parsedId)
        ]);

        if (warnings.kind !== "ready") {
            return warnings;
        }

        return {
            kind: "ready",
            actions: warnings.actions,
            breaches: breaches.breaches,
            breachStatus: breaches.breachStatus
        };
    } catch (error) {
        logger.error(`Failed to fetch DSA warnings for ${parsedId}`, error);
        return { kind: "error" };
    }
}
