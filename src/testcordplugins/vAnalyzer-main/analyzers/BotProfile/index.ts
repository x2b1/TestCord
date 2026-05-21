import { User } from "@vencord/discord-types";

import { AnalysisValue, pruneMap } from "../../utils";

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
const BOT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const BOT_CACHE_MAX_SIZE = 2000;

interface BotCacheEntry {
    analysis: AnalysisValue;
    expiresAt: number;
}

const analyzedBots = new Map<string, BotCacheEntry>();

function pruneBotCache(now: number) {
    pruneMap(analyzedBots, entry => entry.expiresAt <= now, BOT_CACHE_MAX_SIZE);
}

export function analyzeBotProfile(user: User): AnalysisValue | null {
    if (!user?.bot) return null;
    const now = Date.now();

    pruneBotCache(now);

    const cached = analyzedBots.get(user.id);
    if (cached && cached.expiresAt > now) {
        return {
            details: [...cached.analysis.details],
            timestamp: now
        };
    }

    const details: AnalysisValue["details"] = [];
    const isVerifiedBot = typeof user.isVerifiedBot === "function" && user.isVerifiedBot();
    const createdAt = user.createdAt;
    const accountAgeMs = createdAt instanceof Date ? Date.now() - createdAt.getTime() : Number.POSITIVE_INFINITY;

    if (isVerifiedBot) {
        if (accountAgeMs <= FIVE_DAYS_MS) {
            details.push({
                message: "[Bot] Verified bot account created within the last 5 days",
                type: "suspicious"
            });
            details.push({
                message: "[Bot] Be careful with QR codes, external forms, and URL buttons in bot messages",
                type: "suspicious"
            });
        } else {
            details.push({
                message: "[Bot] Verified bot account",
                type: "neutral"
            });
        }
    } else {
        details.push({
            message: "[Bot] Unverified bot account",
            type: "neutral"
        });
    }

    details.push({
        message: `[Bot] Account age: ${Number.isFinite(accountAgeMs) ? `${Math.max(0, Math.floor(accountAgeMs / (24 * 60 * 60 * 1000)))} day(s)` : "unknown"}`,
        type: "neutral"
    });

    const result = { details, timestamp: now };
    analyzedBots.set(user.id, {
        analysis: result,
        expiresAt: now + BOT_CACHE_TTL_MS
    });
    return result;
}