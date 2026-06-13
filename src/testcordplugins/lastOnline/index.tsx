/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { TestcordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";
import { User } from "@vencord/discord-types";


const fs = (window as any).require?.("fs");
const os = (window as any).require?.("os");
const pathModule = (window as any).require?.("path");

const log = new Logger("LastOnline");

interface PresenceStatus {
    hasBeenOnline: boolean;
    lastOffline: number | null;
}

const recentlyOnlineList: Map<string, PresenceStatus> = new Map();
const MAX_DISPLAY_AGE = 604800000; // 7 days, matches the display window
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function getFilePath() {
    if (!fs || !os || !pathModule) return null;
    return pathModule.join(os.homedir(), "Downloads", "onlinelist.json");
}

function pruneOnlineList() {
    const now = Date.now();
    for (const [userId, status] of recentlyOnlineList) {
        if (status.lastOffline !== null && now - status.lastOffline > MAX_DISPLAY_AGE) {
            recentlyOnlineList.delete(userId);
        }
    }
}

function writeOnlineList() {
    const data = Object.fromEntries(recentlyOnlineList);
    const filePath = getFilePath();
    if (fs && filePath) {
        try {
            fs.writeFile(filePath, JSON.stringify(data, null, 2), (e: any) => {
                if (e) log.error("Failed to save online list to file:", e);
            });
        } catch (e) {
            log.error("Failed to save online list to file:", e);
        }
    }
}

// Debounce writes so a burst of presence updates results in a single async write
function saveOnlineList() {
    if (saveTimer !== null) return;
    saveTimer = setTimeout(() => {
        saveTimer = null;
        pruneOnlineList();
        writeOnlineList();
    }, 2000);
}

function loadOnlineList() {
    const filePath = getFilePath();
    if (fs && filePath) {
        try {
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
                for (const [userId, status] of Object.entries(data)) {
                    recentlyOnlineList.set(userId, status as PresenceStatus);
                }
            }
        } catch (e) {
            log.error("Failed to load online list from file:", e);
        }
    }
}

function handlePresenceUpdate(status: string, userId: string) {
    let changed = false;
    if (recentlyOnlineList.has(userId)) {
        const presenceStatus = recentlyOnlineList.get(userId)!;
        if (status !== "offline") {
            if (!presenceStatus.hasBeenOnline || presenceStatus.lastOffline !== null) {
                presenceStatus.hasBeenOnline = true;
                presenceStatus.lastOffline = null;
                changed = true;
            }
        } else if (presenceStatus.hasBeenOnline && presenceStatus.lastOffline == null) {
            presenceStatus.lastOffline = Date.now();
            changed = true;
        }
    } else {
        recentlyOnlineList.set(userId, {
            hasBeenOnline: status !== "offline",
            lastOffline: status === "offline" ? Date.now() : null
        });
        changed = true;
    }
    // Only schedule a write when something actually changed
    if (changed) saveOnlineList();
}

function formatTime(time: number) {
    const diff = Date.now() - time;
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (d > 0) return `${d}d`;
    if (h > 0) return `${h}h`;
    if (m > 0) return `${m}m`;
    return "1m";
}



export default definePlugin({
    name: "LastOnline",
    description: "Adds a last online indicator under usernames in your DM list and guild member list",
    tags: ["Friends", "Utility"],
    authors: [TestcordDevs.x2b],
    flux: {
        PRESENCE_UPDATES({ updates }) {
            log.debug(`Received PRESENCE_UPDATES with ${updates.length} updates`);
            updates.forEach(update => {
                handlePresenceUpdate(update.status, update.user.id);
            });
        }
    },

    start() {
        log.info("LastOnline plugin started");

        loadOnlineList();

        try {
            // Lazy import to avoid early execution
            const { addMemberListDecorator } = require("@api/MemberListDecorators");

            // Add decorator to member list
            addMemberListDecorator("last-online-indicator", props => {
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

            log.info("LastOnline decorators added");
        } catch (e) {
            log.error("Failed to add member list decorator:", e);
        }
    },
    stop() {
        try {
            const { removeMemberListDecorator } = require("@api/MemberListDecorators");
            removeMemberListDecorator("last-online-indicator");
        } catch (e) {
            log.error("Failed to remove member list decorator:", e);
        }
        // Flush any pending debounced write so data isn't lost, and clear the timer
        if (saveTimer !== null) {
            clearTimeout(saveTimer);
            saveTimer = null;
            pruneOnlineList();
            writeOnlineList();
        }
    },
    shouldShowRecentlyOffline(user: User) {
        const presenceStatus = recentlyOnlineList.get(user.id);
        if (!presenceStatus) {
            log.debug(`No presence status found for user ${user.username}#${user.discriminator}`);
            return false;
        }

        const shouldShow = presenceStatus.hasBeenOnline && presenceStatus.lastOffline !== null;
        if (shouldShow) {
            const timeSinceOffline = Date.now() - (presenceStatus.lastOffline || 0);
            // Only show if offline for less than 7 days (604800000 ms)
            if (timeSinceOffline > 604800000) {
                log.debug(`User ${user.username}#${user.discriminator} offline too long (${Math.floor(timeSinceOffline / 86400000)} days), not showing indicator`);
                return false;
            }
        }

        return shouldShow;
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

        const { React } = (globalThis as any).Vencord.Webpack.Common;
        return React.createElement("div", {
            style: {
                color: "var(--text-muted)",
                fontSize: "12px",
                lineHeight: "16px",
                marginTop: "2px"
            }
        }, "Last online ", React.createElement("strong", null, text));
    }
});
