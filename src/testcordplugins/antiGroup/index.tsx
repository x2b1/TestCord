/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, Constants, RestAPI, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Enable the AntiGroup plugin",
        default: true
    },
    showNotifications: {
        type: OptionType.BOOLEAN,
        description: "Show notifications when automatically leaving",
        default: true
    },
    verboseLogs: {
        type: OptionType.BOOLEAN,
        description: "Show detailed logs in the console",
        default: true
    },
    delay: {
        type: OptionType.NUMBER,
        description: "Delay before leaving the group (in milliseconds)",
        default: 1000,
        min: 100,
        max: 10000
    },
    whitelist: {
        type: OptionType.STRING,
        description: "IDs of users allowed to add you (separated by commas)",
        default: ""
    },
    autoReply: {
        type: OptionType.BOOLEAN,
        description: "Send an automatic message before leaving",
        default: true
    },
    replyMessage: {
        type: OptionType.STRING,
        description: "Message to send before leaving",
        default: "I do not wish to be added to groups. Please contact me privately."
    }
});

// Log function with prefix
function log(message: string, level: "info" | "warn" | "error" = "info") {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[AntiGroup ${timestamp}]`;

    switch (level) {
        case "warn":
            console.warn(prefix, message);
            break;
        case "error":
            console.error(prefix, message);
            break;
        default:
            console.log(prefix, message);
    }
}

// Verbose log function (only if enabled)
function verboseLog(message: string) {
    if (settings.store.verboseLogs) {
        log(message);
    }
}

// Function to leave a group DM
async function leaveGroupDM(channelId: string) {
    try {
        const channel = ChannelStore.getChannel(channelId);
        const channelName = channel?.name || "Unnamed group";
        const recipients = channel?.recipients || [];

        log(`🚀 Starting group exit procedure "${channelName}" (ID: ${channelId})`);
        verboseLog(`📊 Group information:
- Name: ${channelName}
- ID: ${channelId}
- Type: ${channel?.type}
- Owner: ${channel?.ownerId}
- Member count: ${recipients.length + 1}`);

        // Send automatic message if enabled
        if (settings.store.autoReply && settings.store.replyMessage.trim()) {
            log(`💬 Sending automatic message: "${settings.store.replyMessage}"`);

            try {
                await RestAPI.post({
                    url: Constants.Endpoints.MESSAGES(channelId),
                    body: {
                        content: settings.store.replyMessage
                    }
                });

                log("✅ Automatic message sent successfully");
                verboseLog("⏱️ Waiting 500ms for message to be delivered...");

                // Wait a bit before leaving so the message is sent
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (msgError) {
                log(`❌ Error sending automatic message: ${msgError}`, "error");
            }
        } else {
            verboseLog("🔇 Automatic message disabled or empty");
        }

        // Leave the group
        log("🚪 Attempting to leave the group...");
        await RestAPI.del({
            url: Constants.Endpoints.CHANNEL(channelId)
        });

        log(`✅ Group left successfully: "${channelName}"`);

        // Success notification
        if (settings.store.showNotifications) {
            showNotification({
                title: "🛡️ AntiGroup - Group left",
                body: `You have automatically left the group "${channelName}"`,
                icon: undefined
            });
            verboseLog("🔔 Success notification displayed");
        }

        // Final log with statistics
        log(`📈 Exit statistics:
- Group: "${channelName}" (${channelId})
- Auto message sent: ${settings.store.autoReply ? "Yes" : "No"}
- Delay applied: ${settings.store.delay}ms
- Notification displayed: ${settings.store.showNotifications ? "Yes" : "No"}`);

    } catch (error) {
        const channel = ChannelStore.getChannel(channelId);
        const channelName = channel?.name || "Unknown group";

        log(`❌ ERROR leaving group "${channelName}" (${channelId}): ${error}`, "error");

        // Detailed error log
        if (settings.store.verboseLogs) {
            console.error("[AntiGroup] Error details:", {
                channelId,
                channelName,
                error,
                stack: error instanceof Error ? error.stack : undefined
            });
        }

        // Error notification
        if (settings.store.showNotifications) {
            showNotification({
                title: "❌ AntiGroup - Error",
                body: `Unable to automatically leave the group "${channelName}"`,
                icon: undefined
            });
            verboseLog("🔔 Error notification displayed");
        }
    }
}

// Function to check if a user is in the whitelist
function isUserWhitelisted(userId: string): boolean {
    const whitelist = settings.store.whitelist
        .split(",")
        .map(id => id.trim())
        .filter(id => id.length > 0);

    const isWhitelisted = whitelist.includes(userId);
    verboseLog(`🔍 Whitelist check for user ${userId}: ${isWhitelisted ? "ALLOWED" : "NOT ALLOWED"}`);

    return isWhitelisted;
}

// Function to check if the current user was recently added to the group
function wasRecentlyAdded(channel: any, currentUserId: string): boolean {
    // Check if it's a group DM (type 3)
    if (channel.type !== 3) {
        verboseLog(`❌ Channel ${channel.id} is not a group DM (type: ${channel.type})`);
        return false;
    }

    // If the channel was just created and the user is not the owner
    const wasAdded = channel.ownerId !== currentUserId;
    verboseLog(`🔍 Recent addition check: ${wasAdded ? "ADDED BY SOMEONE ELSE" : "CREATED BY YOU"} (Owner: ${channel.ownerId})`);

    return wasAdded;
}

export default definePlugin({
    name: "AntiGroup",
    description: "Automatically leaves group DMs as soon as you are added",
    authors: [{
        name: "Bash",
        id: 1327483363518582784n
    }],
    settings,

    flux: {
        // Event triggered when a new channel is created (including group DMs)
        CHANNEL_CREATE(event: { channel: any; }) {
            verboseLog(`📺 CHANNEL_CREATE event detected for channel ${event.channel?.id}`);

            if (!settings.store.enabled) {
                verboseLog("🔒 Plugin disabled, ignored");
                return;
            }

            const { channel } = event;
            const currentUserId = UserStore.getCurrentUser()?.id;

            if (!channel || !currentUserId) {
                verboseLog(`❌ Missing data: channel=${!!channel}, currentUserId=${!!currentUserId}`);
                return;
            }

            verboseLog(`📋 Channel analysis:
- ID: ${channel.id}
- Type: ${channel.type}
- Name: ${channel.name || "Unnamed"}
- Owner: ${channel.ownerId}
- Current user: ${currentUserId}`);

            // Check if it's a group DM (type 3)
            if (channel.type !== 3) {
                verboseLog(`⏭️ Ignored: not a group DM (type ${channel.type})`);
                return;
            }

            // Check if the user was recently added
            if (!wasRecentlyAdded(channel, currentUserId)) {
                verboseLog("⏭️ Ignored: you are the group creator");
                return;
            }

            log(`🎯 NEW GROUP DM DETECTED: "${channel.name || "Unnamed"}" (${channel.id})`);

            // Check if the group owner is in the whitelist
            if (channel.ownerId && isUserWhitelisted(channel.ownerId)) {
                log(`✅ Owner ${channel.ownerId} is in whitelist, group allowed`);
                return;
            }

            // Check if other group members are in the whitelist
            const whitelistedMember = channel.recipients?.find((recipient: any) =>
                isUserWhitelisted(recipient.id)
            );

            if (whitelistedMember) {
                log(`✅ Member ${whitelistedMember.id} is in whitelist, group allowed`);
                return;
            }

            log(`⚠️ NO ALLOWED MEMBERS FOUND - Scheduling automatic exit in ${settings.store.delay}ms`);

            // Immediate detection notification
            if (settings.store.showNotifications) {
                showNotification({
                    title: "🚨 AntiGroup - Group detected",
                    body: `Added to group "${channel.name || "Unnamed"}" - Automatic exit in ${settings.store.delay / 1000}s`,
                    icon: undefined
                });
            }

            // Wait for the configured delay before leaving
            setTimeout(() => {
                verboseLog("⏰ Delay elapsed, executing automatic exit");
                leaveGroupDM(channel.id);
            }, settings.store.delay);
        }
    },

    start() {
        log("🚀 AntiGroup plugin started");
        log(`⚙️ Current configuration:
- Notifications: ${settings.store.showNotifications ? "ON" : "OFF"}
- Verbose logs: ${settings.store.verboseLogs ? "ON" : "OFF"}
- Auto message: ${settings.store.autoReply ? "ON" : "OFF"}
- Delay: ${settings.store.delay}ms
- Whitelist: ${settings.store.whitelist || "Empty"}`);

        if (settings.store.showNotifications) {
            showNotification({
                title: "🛡️ AntiGroup activated",
                body: "Protection against unwanted group DMs activated",
                icon: undefined
            });
        }
    },

    stop() {
        log("🛑 AntiGroup plugin stopped");

        if (settings.store.showNotifications) {
            showNotification({
                title: "🛡️ AntiGroup deactivated",
                body: "Protection against unwanted group DMs deactivated",
                icon: undefined
            });
        }
    }
});
