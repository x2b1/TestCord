/*
 * Esharq badge registry — Cloudflare Worker
 * https://github.com/LOSTSTR/Esharq
 *
 * Deploy:
 *   1. Workers & Pages → KV → create a namespace, bind it to this Worker as `BADGES`.
 *   2. Paste this script, Deploy.
 *   3. Put the Worker URL in src/equicordplugins/_core/esharqUserBadge/index.tsx (API).
 *
 * Storage: a single KV key "users" holding a JSON array of Discord IDs.
 * Endpoints:
 *   POST /register   body { userId }   → adds the ID once (validated)
 *   GET  /users                        → JSON array of all registered IDs
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🛡️  ENABLE RATE LIMITING (protect the free 100k/day quota) — 2 minutes:
 *   Cloudflare dashboard → your Worker → Settings → "Rate limiting" (or
 *   Security → WAF → Rate limiting rules) → Create rule:
 *     • If incoming requests match:  URI Path  equals  /register
 *     • Rate:  10 requests  per  1 minute  per  client IP (recommended: 5–10)
 *     • Action:  Block   (Duration: 1 minute)
 *   Deploy. This caps how fast any single IP can register, stopping spam/quota
 *   abuse. GET /users stays unlimited (it's a cheap single read).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const KEY = "users";
const SNOWFLAKE = /^\d{17,20}$/;            // valid Discord ID shape only
const MAX_USERS = 200000;                   // hard cap to bound storage/abuse
const MAX_BODY = 256;                       // reject oversized request bodies (bytes)
const CORS = {
    "Access-Control-Allow-Origin": "*",     // public read; POST is strictly validated below
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
};

const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS } });

export default {
    async fetch(request, env) {
        const { pathname } = new URL(request.url);

        if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

        if (request.method === "GET" && pathname === "/users") {
            const list = (await env.BADGES.get(KEY, "json")) ?? [];
            return json(list);
        }

        if (request.method === "POST" && pathname === "/register") {
            // reject oversized bodies before parsing
            const len = Number(request.headers.get("content-length") || 0);
            if (len > MAX_BODY) return json({ error: "too large" }, 413);

            let body;
            try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }

            // strict: only a single string field `userId`, exact Discord-snowflake shape
            const id = body?.userId;
            if (typeof id !== "string" || !SNOWFLAKE.test(id)) return json({ error: "invalid id" }, 400);

            const list = (await env.BADGES.get(KEY, "json")) ?? [];
            if (!list.includes(id)) {
                if (list.length >= MAX_USERS) return json({ error: "full" }, 507);
                list.push(id);
                await env.BADGES.put(KEY, JSON.stringify(list));
            }
            return json({ ok: true });
        }

        return json({ error: "not found" }, 404);
    },
};
