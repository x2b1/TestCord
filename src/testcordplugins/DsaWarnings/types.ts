/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface DsaAction {
    uuid: string;
    parsedId: string;
    decisionVisibility: string | string[] | null;
    endDateVisibilityRestriction: string | null;
    decisionMonetary: string | null;
    endDateMonetaryRestriction: string | null;
    decisionProvision: string | null;
    endDateServiceRestriction: string | null;
    decisionAccount: string | null;
    endDateAccountRestriction: string | null;
    decisionGround: string;
    incompatibleContentGround: string;
    incompatibleContentExplanation: string;
    incompatibleContentIllegal: string | boolean | null;
    category: string;
    categorySpecification: string | string[] | null;
    contentType: string | string[];
    applicationDate: string;
    decisionFacts: string;
    automatedDetection: string | boolean;
    sourceType: string;
    createdAt: string;
}

export interface BreachRecord {
    source: string;
    categories?: string[];
    id?: string;
    no?: string;
    discordid?: string;
    username?: string;
    discordname?: string;
    discriminator?: string;
    tag?: string;
    ip?: string;
    date?: string;
}

export interface CordCatQueryResponse {
    statements: unknown[];
    breach?: {
        success: boolean;
        data?: {
            results?: BreachRecord[];
        };
        resultsCount?: number;
        error?: {
            status?: number;
            message?: string;
            details?: string;
        };
    };
}

export type DsaLookupResult =
    | {
        kind: "ready";
        actions: DsaAction[];
        breaches: BreachRecord[];
        breachStatus: "ready" | "unavailable";
    }
    | { kind: "captcha"; }
    | { kind: "unavailable"; }
    | { kind: "error"; };

export interface NativeSearchResultOk {
    ok: true;
    status: number;
    body: string;
}

export interface NativeSearchResultError {
    ok: false;
    error: string;
}

export type NativeSearchResult = NativeSearchResultOk | NativeSearchResultError;
