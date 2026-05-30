/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { addProfileBadge, BadgePosition, BadgeUserArgs, ProfileBadge, removeProfileBadge } from "@api/Badges";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { Tooltip, useRef, UserStore } from "@webpack/common";
import type { JSX } from "react";

import { EA_BADGE } from "./image";

// ⚠️ ضع هنا رابط الـ Worker بعد نشره على Cloudflare:
const API = "https://esharq-badges.YOUR-SUBDOMAIN.workers.dev";

const BADGE_ID = "esharq-user";
const NAME = "Esharq User · مستخدم إِشراق";
const SNOWFLAKE = /^\d{17,20}$/;
const logger = new Logger("EsharqUserBadge");

// in-memory cache of registered Esharq user IDs (filled once at startup)
const esharqUsers = new Set<string>();

// ─── Privacy notice (shown under the toggle, in both languages) ──────────────
function PrivacyNote() {
    return (
        <div className="esharq-badge-note">
            <p className="esharq-badge-note-ar" dir="rtl" lang="ar">
                عند تفعيل هذا الخيار (تلقائي)، سيقوم عميل إشراق بتسجيل معرّف الحساب (User ID) لمرة واحدة فقط
                بشكل آمن وبدون أي خادم ثقيل، وذلك لإظهار شارة تميز (EA) لك أمام مستخدمي النسخة الآخرين ولرؤية
                شاراتهم. يمكنك تعطيل الخيار في أي وقت لإيقاف الاتصال الخارجي تماماً وحماية خصوصيتك.
            </p>
            <p className="esharq-badge-note-en" dir="ltr" lang="en">
                When enabled (default), Esharq will securely register your User ID once using a serverless
                system to display your exclusive (EA) badge to other Esharq users and allow you to see theirs.
                You can disable this at any time to completely stop external requests and maintain full privacy.
            </p>
        </div>
    );
}

const settings = definePluginSettings({
    // master privacy switch — ON by default. Controls all network + badge display.
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Esharq Badge · شارة إشراق",
        default: true,
        onChange(value: boolean) {
            if (value) {
                // turned back on → fetch the list and register (if not already)
                fetchUsers().then(registerOnce);
            } else {
                // turned off → stop showing badges; no further network requests
                esharqUsers.clear();
            }
        },
    },
    // bilingual explanation rendered right under the toggle
    info: {
        type: OptionType.COMPONENT,
        component: () => <PrivacyNote />,
    },
    // persistent flag — true once this client has registered its ID
    registered: { type: OptionType.BOOLEAN, description: "", default: false, hidden: true },
});

// ─── Network: fetch once, register once ──────────────────────────────────────
async function fetchUsers() {
    try {
        const res = await fetch(`${API}/users`, { method: "GET" });
        if (!res.ok) return;
        const list = await res.json();
        if (!Array.isArray(list)) return;
        for (const id of list) if (typeof id === "string" && SNOWFLAKE.test(id)) esharqUsers.add(id);
    } catch (e) {
        logger.warn("failed to fetch Esharq users", e);
    }
}

async function registerOnce() {
    if (settings.store.registered) return;            // already registered — never hit again
    const id = UserStore.getCurrentUser()?.id;
    if (!id || !SNOWFLAKE.test(id)) return;           // user not ready — try next boot
    try {
        const res = await fetch(`${API}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: id }),
        });
        if (res.ok) {
            settings.store.registered = true;          // persist — one-time only
            esharqUsers.add(id);                        // show on self immediately
        }
    } catch (e) {
        logger.warn("failed to register", e);
    }
}

// ─── Badge visual ────────────────────────────────────────────────────────────
function EaBadgeIcon({ size }: { size: number; }): JSX.Element {
    const clipId = useRef(`ea-${Math.random().toString(36).slice(2, 9)}`).current;
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <defs><clipPath id={clipId}><circle cx="12" cy="12" r="12" /></clipPath></defs>
            <image href={EA_BADGE} x="0" y="0" width="24" height="24" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`} />
        </svg>
    );
}

function EaBadge({ size }: { size: number; }): JSX.Element {
    return (
        <ErrorBoundary noop>
            <Tooltip text={NAME} position="top">
                {({ onMouseEnter, onMouseLeave }) => (
                    <div
                        className="esharq-user-badge"
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                        style={{ width: size, height: size }}
                        role="img"
                        aria-label={NAME}
                    >
                        <EaBadgeIcon size={size} />
                    </div>
                )}
            </Tooltip>
        </ErrorBoundary>
    );
}

const profileBadge: ProfileBadge = {
    id: BADGE_ID,
    key: BADGE_ID,
    description: NAME,
    position: BadgePosition.START,
    // reads only from the in-memory cache — no network per render, no polling
    shouldShow: ({ userId }: BadgeUserArgs) => settings.store.enabled && esharqUsers.has(userId),
    component: () => <EaBadge size={22} />,
};

// required: true → core plugin, can't be removed; the "Esharq Badge" toggle
// inside its settings is what users flip for privacy (default ON).
export default definePlugin({
    name: "EsharqUserBadge",
    description: "Shows an EA badge on users running Esharq",
    authors: [],
    required: true,
    dependencies: ["BadgesAPI"],
    settings,

    async start() {
        addProfileBadge(profileBadge);
        // privacy: if the user turned the toggle off, do no network at all.
        if (!settings.store.enabled) return;
        // one GET (cache) + one conditional POST (first run only). No intervals.
        await fetchUsers();
        registerOnce();
    },

    stop() {
        removeProfileBadge(profileBadge);
    },
});
