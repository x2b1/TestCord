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

import { DONOR_BADGES } from "./registry";
import type { DonorBadge } from "./types";

const DEFAULT_RING = "#a01b2d";

// ─── Badge visual — circular image with colored ring ─────────────────────────
function DonorIcon({ size, badge }: { size: number; badge: DonorBadge; }): JSX.Element {
    const clipId = useRef(`donor-${Math.random().toString(36).slice(2, 9)}`).current;
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <defs>
                <clipPath id={clipId}><circle cx="12" cy="12" r="10" /></clipPath>
            </defs>
            <circle cx="12" cy="12" r="12" fill={badge.ring ?? DEFAULT_RING} />
            <image
                href={badge.image}
                x="2" y="2" width="20" height="20"
                preserveAspectRatio="xMidYMid slice"
                clipPath={`url(#${clipId})`}
            />
        </svg>
    );
}

function DonorBadgeView({ size, badge }: { size: number; badge: DonorBadge; }): JSX.Element {
    return (
        <ErrorBoundary noop>
            <Tooltip text={badge.name} position="top">
                {({ onMouseEnter, onMouseLeave }) => (
                    <div
                        className="esharq-donor-badge"
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                        style={{ width: size, height: size }}
                        role="img"
                        aria-label={badge.name}
                    >
                        <DonorIcon size={size} badge={badge} />
                    </div>
                )}
            </Tooltip>
        </ErrorBoundary>
    );
}

// ─── One profile badge per donor entry ────────────────────────────────────────
const profileBadges: ProfileBadge[] = DONOR_BADGES.map((badge, i) => {
    const idSet = new Set(badge.ids);
    return {
        id: `esharq-donor-${i}`,
        key: `esharq-donor-${i}`,
        description: badge.name,
        position: BadgePosition.START,
        shouldShow: ({ userId }: BadgeUserArgs) => idSet.has(userId),
        component: () => <DonorBadgeView size={22} badge={badge} />,
    };
});

// required: true → cannot be disabled; hidden: true → not listed in settings
export default definePlugin({
    name: "EsharqDonorBadges",
    description: "Custom badges for Esharq donors",
    authors: [],
    required: true,
    hidden: true,
    dependencies: ["BadgesAPI"],

    start() {
        for (const b of profileBadges) addProfileBadge(b);
    },

    stop() {
        for (const b of profileBadges) removeProfileBadge(b);
    },
});
