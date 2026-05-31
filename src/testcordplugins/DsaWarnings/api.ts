/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { PluginNative } from "@utils/types";

import type { BreachRecord, DsaAction, DsaLookupResult } from "./types";

const logger = new Logger("DsaWarnings");
const SUCCESS_CACHE_TTL_MS = 5 * 60 * 1000;
const ERROR_CACHE_TTL_MS = 60 * 1000;
const Native = VencordNative.pluginHelpers.DsaWarnings as PluginNative<typeof import("./native")>;

const resultCache = new Map<string, { expiresAt: number; result: DsaLookupResult; }>();

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function getString(record: Record<string, unknown>, key: string) {
    return typeof record[key] === "string" ? record[key] : "";
}

function getNullableString(record: Record<string, unknown>, key: string) {
    const v = record[key];
    return v == null || typeof v === "string" ? (v as string | null) : null;
}

function isBreachRecord(value: unknown): value is BreachRecord {
    if (!isRecord(value) || typeof value.source !== "string") return false;
    return value.categories == null || Array.isArray(value.categories) && value.categories.every(item => typeof item === "string");
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

function asNonEmptyString(value: string | null | undefined) {
    return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeCordCatStatement(value: unknown, parsedId: string): DsaAction | null {
    if (!isRecord(value)) return null;

    const category = getString(value, "category");
    const decisionProvision = getNullableString(value, "decision_provision");
    if (!category && !decisionProvision) return null;

    return {
        uuid: getString(value, "uuid") || getString(value, "id") || `${parsedId}-${category}-${getString(value, "application_date")}`,
        parsedId,
        decisionVisibility: getNullableString(value, "decision_visibility"),
        endDateVisibilityRestriction: getNullableString(value, "end_date_visibility_restriction"),
        decisionMonetary: getNullableString(value, "decision_monetary"),
        endDateMonetaryRestriction: getNullableString(value, "end_date_monetary_restriction"),
        decisionProvision,
        endDateServiceRestriction: getNullableString(value, "end_date_service_restriction"),
        decisionAccount: getNullableString(value, "decision_account"),
        endDateAccountRestriction: getNullableString(value, "end_date_account_restriction"),
        decisionGround: getString(value, "decision_ground") || getString(value, "incompatible_content_ground"),
        incompatibleContentGround: getString(value, "incompatible_content_ground"),
        incompatibleContentExplanation: getString(value, "incompatible_content_explanation"),
        incompatibleContentIllegal: value.incompatible_content_illegal as string | boolean | null,
        category,
        categorySpecification: value.category_specification ?? value.category_specification_other as string | string[] | null,
        contentType: (value.content_type ?? value.decision_provision ?? "") as string | string[],
        applicationDate: getString(value, "application_date"),
        decisionFacts: getString(value, "decision_facts"),
        automatedDetection: (value.automated_detection ?? "") as string | boolean,
        sourceType: getString(value, "source_type"),
        createdAt: getString(value, "created_at") || getString(value, "application_date")
    };
}

function isRestrictionActive(endDate: string | null) {
    if (endDate == null || endDate.length === 0) return true;
    const parsed = Date.parse(endDate);
    if (Number.isNaN(parsed)) return true;
    return parsed > Date.now();
}

export function getActiveRestrictionLabels(action: DsaAction) {
    const labels: string[] = [];
    const decisionVisibility: string[] = Array.isArray(action.decisionVisibility)
        ? action.decisionVisibility.filter((v): v is string => typeof v === "string" && v.length > 0)
        : asNonEmptyString(action.decisionVisibility)
            ? [asNonEmptyString(action.decisionVisibility)!]
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

function setCache(parsedId: string, result: DsaLookupResult) {
    const ttl = result.kind === "ready" ? SUCCESS_CACHE_TTL_MS : ERROR_CACHE_TTL_MS;
    resultCache.set(parsedId, { expiresAt: Date.now() + ttl, result });
    return result;
}

export function invalidateWarnings(parsedId?: string) {
    if (parsedId) {
        resultCache.delete(parsedId);
        return;
    }
    resultCache.clear();
}

export async function fetchActiveWarnings(parsedId: string): Promise<DsaLookupResult> {
    const cached = resultCache.get(parsedId);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.result;
    }

    try {
        const nativeResult = await Native.fetchCordCatQuery?.(parsedId);
        if (!nativeResult?.ok) {
            return setCache(parsedId, { kind: "error" });
        }

        if (nativeResult.status === 503) {
            return setCache(parsedId, { kind: "unavailable" });
        }

        if (nativeResult.status < 200 || nativeResult.status >= 300) {
            return setCache(parsedId, { kind: "error" });
        }

        const payload: unknown = JSON.parse(nativeResult.body);
        if (!isRecord(payload)) {
            return setCache(parsedId, { kind: "error" });
        }

        const statements: unknown[] = Array.isArray(payload.statements) ? payload.statements : [];
        const actions = statements
            .map(s => normalizeCordCatStatement(s, parsedId))
            .filter((a): a is DsaAction => a !== null)
            .filter(a => getActiveRestrictionLabels(a).length > 0)
            .sort((a, b) => Date.parse(b.applicationDate) - Date.parse(a.applicationDate));

        const breachObj = isRecord(payload.breach) ? payload.breach : null;
        const breachSuccess = breachObj?.success === true;
        let breaches: BreachRecord[] = [];
        if (breachSuccess) {
            const breachData = isRecord(breachObj!.data) ? breachObj!.data : null;
            const results = Array.isArray(breachData?.results) ? breachData!.results : [];
            breaches = results.filter(isBreachRecord);
        }

        return setCache(parsedId, {
            kind: "ready",
            actions,
            breaches,
            breachStatus: breachSuccess ? "ready" : "unavailable"
        });
    } catch (error) {
        logger.error(`Failed to fetch CordCat data for ${parsedId}`, error);
        return setCache(parsedId, { kind: "error" });
    }
}
