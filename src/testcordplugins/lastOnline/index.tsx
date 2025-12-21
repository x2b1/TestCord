/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { User } from "@vencord/discord-types";

import { moment, React } from "@webpack/common";
import { Logger } from "@utils/Logger";
import { DataStore } from "@api/index";

import { TestcordDevs } from "../../utils/constants";
import { addMemberListDecorator, removeMemberListDecorator } from "@api/MemberListDecorators";

const fs = (window as any).require?.("fs");
const os = (window as any).require?.("os");
const path = (window as any).require?.("path");

const log = new Logger("LastOnline");

interface PresenceStatus {
    hasBeenOnline: boolean;
    lastOffline: number | null;
}

const recentlyOnlineList: Map<string, PresenceStatus> = new Map();

function saveOnlineList() {
    const data = Object.fromEntries(recentlyOnlineList);
    DataStore.set("lastOnlineData", data);
    if (fs && os && path) {
        const filePath = path.join(os.homedir(), "Downloads", "onlinelist.json");
        try {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        } catch (e) {
            log.error("Failed to save online list to file:", e);
        }
    }
}

function loadOnlineList() {
    if (fs && os && path) {
        const filePath = path.join(os.homedir(), "Downloads", "onlinelist.json");
        try {
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
                for (const [userId, status] of Object.entries(data)) {
                    recentlyOnlineList.set(userId, status as PresenceStatus);
                }
                return;
            }
        } catch (e) {
            log.error("Failed to load online list from file:", e);
        }
    }
    // Fallback to DataStore
    DataStore.get("lastOnlineData").then((data: any) => {
        if (data) {
            for (const [userId, status] of Object.entries(data)) {
                recentlyOnlineList.set(userId, status as PresenceStatus);
            }
        }
    });
}

function handlePresenceUpdate(status: string, userId: string) {
    if (recentlyOnlineList.has(userId)) {
        const presenceStatus = recentlyOnlineList.get(userId)!;
        if (status !== "offline") {
            presenceStatus.hasBeenOnline = true;
            presenceStatus.lastOffline = null;
        } else if (presenceStatus.hasBeenOnline && presenceStatus.lastOffline == null) {
            presenceStatus.lastOffline = Date.now();
        }
    } else {
        recentlyOnlineList.set(userId, {
            hasBeenOnline: status !== "offline",
            lastOffline: status === "offline" ? Date.now() : null
        });
    }
    saveOnlineList();
}

function formatTime(time: number) {
    const diff = moment.duration(moment().diff(time));
    const d = Math.floor(diff.asDays());
    const h = Math.floor(diff.asHours());
    const m = Math.floor(diff.asMinutes());

    if (d > 0) return `${d}d`;
    if (h > 0) return `${h}h`;
    if (m > 0) return `${m}m`;
    return "1m";
}

export default definePlugin({
    name: "LastOnline",
    description: "Adds a last online indicator under usernames in your DM list and guild and GDM member list",
    authors: [TestcordDevs.x2b],
    flux: {
        PRESENCE_UPDATES({ updates }) {
            log.debug(`Received PRESENCE_UPDATES with ${updates.length} updates`);
            updates.forEach(update => {
                handlePresenceUpdate(update.status, update.user.id);
            });
        }
    },
    patches: [
        {
            find: '"UserProfilePopoutBody"',
            replacement: {
                match: /(?<=(\i)\.id\)\}\)\),(\i).*?)\(0,.{0,100}\i\.id,onClose:\i\}\)/,
                replace: "$self.buildRecentlyOffline({ id: $1.id })"
            },
            predicate: () => true
        }
    ],
    async start() {
        log.info("LastOnline plugin started");

        await loadOnlineList();

        // Add decorator to member list
        addMemberListDecorator("last-online-indicator", (props) => {
            if (!props.user) {
                log.debug(`Decorator called with no user, type: ${props.type}`);
                return null;
            }
            log.debug(`Decorator called for user ${props.user.username}#${props.user.discriminator}, type: ${props.type}`);
            if (this.shouldShowRecentlyOffline(props.user)) {
                log.debug(`Showing last online for user ${props.user.username}#${props.user.discriminator}`);
                return this.buildRecentlyOffline(props.user);
            }
            log.debug(`Not showing last online for user ${props.user.username}#${props.user.discriminator}`);
            return null;
        });

        // Also add to DM list and other locations
        // This might need additional API calls or patches
        log.info("LastOnline decorators added");
    },
    stop() {
        removeMemberListDecorator("last-online-indicator");
    },
    shouldShowRecentlyOffline(user: User) {
        const presenceStatus = recentlyOnlineList.get(user.id);
        if (!presenceStatus) {
            log.debug(`No presence status found for user ${user.username}#${user.discriminator}`);
            return false;
        }

        // Show if online or recently offline
        if (presenceStatus.lastOffline === null) {
            // Online now
            return true;
        }

        const timeSinceOffline = Date.now() - (presenceStatus.lastOffline || 0);
        // Only show if offline for less than 7 days (604800000 ms)
        if (timeSinceOffline > 604800000) {
            log.debug(`User ${user.username}#${user.discriminator} offline too long (${Math.floor(timeSinceOffline / 86400000)} days), not showing indicator`);
            return false;
        }

        return true;
    },
    buildRecentlyOffline(user: User) {
        const presenceStatus = recentlyOnlineList.get(user.id);
        if (!presenceStatus) {
            log.warn(`buildRecentlyOffline called for user ${user.username}#${user.discriminator} but no presence status found`);
            return null;
        }

        let text: string;
        if (presenceStatus.lastOffline === null) {
            // Online now
            text = "now";
        } else {
            const formattedTime = formatTime(presenceStatus.lastOffline);
            if (!formattedTime) {
                log.warn(`formatTime returned empty string for user ${user.username}#${user.discriminator}`);
                return null;
            }
            text = `${formattedTime} ago`;
        }

        return (
            <div style={{
                color: "var(--text-muted)",
                fontSize: "12px",
                lineHeight: "16px",
                marginTop: "2px"
            }}>
                Last online <strong>{text}</strong>
            </div>
        );
    }
});





