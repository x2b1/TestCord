/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findStoreLazy } from "@webpack";

export enum BadgePosition {
    START = 0,
    END = 1
}

export interface ProfileBadge {
    description: string;
    image: string;
    position: BadgePosition;
    shouldShow: (info: { userId: string; }) => boolean;
    link?: string;
}

let badges: ProfileBadge[] = [];

export const Badges = {
    addBadge,
    removeBadge,
    clearBadges,
    /**
     * Add a badge that conditionally shows on profiles.
     */
    addBadge(badge: ProfileBadge) {
        badges.push(badge);
    },

    /**
     * Remove a badge.
     */
    removeBadge(badge: ProfileBadge) {
        const index = badges.indexOf(badge);
        if (index > -1) {
            badges.splice(index, 1);
        }
    },

    /**
     * Clear all badges.
     */
    clearBadges() {
        badges = [];
    }
};

// Patch UserProfileStore to inject badges
const UserProfileStore = findStoreLazy("UserProfileStore");

let originalGetUserProfile: any = null;

const patchesApplied = {
    getUserProfile: false
};

applyBadgesPatches() {
    if (patchesApplied.getUserProfile || !UserProfileStore.getUserProfile) return;

    originalGetUserProfile = UserProfileStore.getUserProfile;
    UserProfileStore.getUserProfile = function (userId: string) {
        const profile = originalGetUserProfile.call(this, userId);
        if (!profile || !profile.badges) return profile;

        const filteredBadges = badges
            .filter(badge => badge.shouldShow({ userId }))
            .sort((a, b) => a.position - b.position);

        // Prepend/append based on position
        const startBadges = filteredBadges.filter(b => b.position === BadgePosition.START);
        const endBadges = filteredBadges.filter(b => b.position === BadgePosition.END);

        profile.badges = [
            ...startBadges.map(b => ({
                id: Math.random().toString(36), // Fake ID for client-side
                description: b.description,
                icon: b.image.startsWith("http") ? b.image : `https://cdn.discordapp.com/badge-icons/${b.image}.png`,
                link: b.link
            })),
            ...profile.badges,
            ...endBadges.map(b => ({
                id: Math.random().toString(36),
                description: b.description,
                icon: b.image.startsWith("http") ? b.image : `https://cdn.discordapp.com/badge-icons/${b.image}.png`,
                link: b.link
            }))
        ];

        return profile;
    };

    patchesApplied.getUserProfile = true;
}

export function removeBadgesPatches() {
    if (originalGetUserProfile && patchesApplied.getUserProfile) {
        UserProfileStore.getUserProfile = originalGetUserProfile;
        patchesApplied.getUserProfile = false;
    }
    Badges.clearBadges();
}
