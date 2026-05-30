/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { addProfileBadge, BadgePosition, BadgeUserArgs, ProfileBadge, removeProfileBadge } from "@api/Badges";
import ErrorBoundary from "@components/ErrorBoundary";
import definePlugin from "@utils/types";
import { Tooltip, useRef } from "@webpack/common";
import type { JSX } from "react";

import { FOUNDERS_IMAGE } from "./image";

const BADGE_ID = "esharq-founder";
const RING = "#a01b2d";
const NAME = "Esharq Founder · مؤسِّس إِشراق";

// ─── Authorized IDs — هذه الشارة الخاصة تظهر فقط لهؤلاء ──────────────────────
const FOUNDER_IDS: ReadonlySet<string> = new Set([
    "681465758127226900",
    "1072961475125182564",
]);

// ─── Badge visual — circular image with crimson ring ─────────────────────────
function FounderIcon({ size }: { size: number; }): JSX.Element {
    const clipId = useRef(`founder-${Math.random().toString(36).slice(2, 9)}`).current;
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <defs>
                <clipPath id={clipId}><circle cx="12" cy="12" r="10" /></clipPath>
            </defs>
            <circle cx="12" cy="12" r="12" fill={RING} />
            <image
                href={FOUNDERS_IMAGE}
                x="2" y="2" width="20" height="20"
                preserveAspectRatio="xMidYMid slice"
                clipPath={`url(#${clipId})`}
            />
        </svg>
    );
}

function FounderBadge({ size }: { size: number; }): JSX.Element {
    return (
        <ErrorBoundary noop>
            <Tooltip text={NAME} position="top">
                {({ onMouseEnter, onMouseLeave }) => (
                    <div
                        className="esharq-founder-badge"
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                        style={{ width: size, height: size }}
                        role="img"
                        aria-label={NAME}
                    >
                        <FounderIcon size={size} />
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
    shouldShow: ({ userId }: BadgeUserArgs) => FOUNDER_IDS.has(userId),
    component: () => <FounderBadge size={22} />,
};

// required: true → cannot be disabled; hidden: true → not listed in settings
export default definePlugin({
    name: "EsharqFounderBadge",
    description: "Special Esharq founder badge",
    authors: [],
    required: true,
    hidden: true,
    dependencies: ["BadgesAPI"],

    start() {
        addProfileBadge(profileBadge);
    },

    stop() {
        removeProfileBadge(profileBadge);
    },
});
