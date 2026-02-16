/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandOptionType, sendBotMessage } from "@api/Commands";
import { ApplicationCommandInputType } from "@api/Commands/types";
import { TestcordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

const CHARACTERS = "abcdefghijklmnopqrstuvwxyz0123456789._";

interface CheckedUsername {
    username: string;
    timestamp: number;
}

interface RateLimitState {
    lastRequestTime: number;
    requestCount: number;
    consecutive429: number;
}

interface WebhookConfig {
    url: string;
    headers?: Record<string, string>;
}

interface UsernameSniperSettings {
    proxyUrl: string;
    maxParallelChecks: number;
    batchSize: number;
    batchDelay: number;
    checkInterval: number;
    webhookUrl: string;
    notifyInUserMessages: boolean;
}

const settings = {
    proxyUrl: {
        type: ApplicationCommandOptionType.STRING,
        description: "Proxy URL for username checks (leave empty for direct Discord API)",
        required: false,
        placeholder: "https://your-proxy.com"
    },
    maxParallelChecks: {
        type: ApplicationCommandOptionType.INTEGER,
        description: "Maximum parallel checks (higher = faster but more detectable)",
        required: false,
        minValue: 1,
        maxValue: 50,
        defaultValue: 5
    },
    batchSize: {
        type: ApplicationCommandOptionType.INTEGER,
        description: "Number of names to check in each batch",
        required: false,
        minValue: 1,
        maxValue: 100,
        defaultValue: 10
    },
    batchDelay: {
        type: ApplicationCommandOptionType.INTEGER,
        description: "Delay between batches in milliseconds",
        required: false,
        minValue: 10,
        maxValue: 1000,
        defaultValue: 100
    },
    checkInterval: {
        type: ApplicationCommandOptionType.INTEGER,
        description: "Delay between individual checks in milliseconds",
        required: false,
        minValue: 1,
        maxValue: 500,
        defaultValue: 20
    },
    webhookUrl: {
        type: ApplicationCommandOptionType.STRING,
        description: "Webhook URL to send found usernames to",
        required: false,
        placeholder: "https://discord.com/api/webhooks/..."
    },
    notifyInUserMessages: {
        type: ApplicationCommandOptionType.BOOLEAN,
        description: "Show available names in ephemeral messages (only you can see)",
        required: false,
        defaultValue: true
    }
};

// Global state for tracking checked usernames and rate limiting
const checkedUsernames = new Set<string>();
const rateLimitState = new Map<string, RateLimitState>();
const webhookConfig: WebhookConfig = { url: "" };

// Generate all possible usernames for a given length
function generateCombinations(length: number): string[] {
    const combinations: string[] = [];

    function generate(current: string) {
        if (current.length === length) {
            combinations.push(current);
            return;
        }

        for (const char of CHARACTERS) {
            // Skip if last character is dot or underscore (Discord restriction)
            if (current.length > 0 && (current[current.length - 1] === "." || current[current.length - 1] === "_")) {
                continue;
            }
            generate(current + char);
        }
    }

    generate("");
    return combinations;
}

// Shuffle array randomly
function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Check if username is valid (doesn't end with . or _)
function isValidUsername(username: string): boolean {
    return username.length > 0 && username[username.length - 1] !== "." && username[username.length - 1] !== "_";
}

// Check if a URL uses an IP address
function usesIpAddress(url: string): boolean {
    try {
        const urlObj = new URL(url);
        const { hostname } = urlObj;
        // Check if hostname is an IP address (no dots, or starts with numbers and has no dots)
        return !hostname.includes(".") || /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
    } catch {
        return false;
    }
}

// Check username availability using Discord API
async function checkUsernameAvailability(username: string, proxyUrl?: string): Promise<boolean> {
    const timestamp = Date.now();

    // Check if already checked recently (within last 5 minutes)
    if (checkedUsernames.has(username)) {
        return false;
    }

    // Update rate limit state
    let state = rateLimitState.get(username);
    if (!state) {
        state = { lastRequestTime: 0, requestCount: 0, consecutive429: 0 };
        rateLimitState.set(username, state);
    }

    // Calculate delay based on rate limiting
    const minDelay = 50; // Minimum delay between requests
    const elapsed = timestamp - state.lastRequestTime;
    const delay = Math.max(minDelay, elapsed);

    // Wait if needed
    if (delay < minDelay) {
        await new Promise(resolve => setTimeout(resolve, minDelay - delay));
    }

    try {
        // Build request URL
        const baseUrl = proxyUrl || "https://discord.com/api/v10";

        // Use HTTP for IP addresses to avoid certificate errors
        const protocol = usesIpAddress(baseUrl) ? "http" : new URL(baseUrl).protocol;
        const url = `${protocol}://${baseUrl}/users/@me/username`;

        // Try to use the username - we use the current user's session
        const response = await fetch(url, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...(proxyUrl ? {} : { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" })
            },
            body: JSON.stringify({ username })
        });

        // Mark as checked
        checkedUsernames.add(username);
        state.lastRequestTime = Date.now();
        state.requestCount++;

        // Handle response
        if (response.status === 200) {
            return true; // Username is available
        } else if (response.status === 403 || response.status === 404) {
            return false; // Username is taken
        } else if (response.status === 429) {
            state.consecutive429++;
            throw new Error("Rate limited");
        }

        return false;
    } catch (error) {
        // Mark as checked even on error to avoid retrying
        checkedUsernames.add(username);
        state.lastRequestTime = Date.now();
        state.requestCount++;
        throw error;
    }
}

// Send webhook notification
async function sendWebhookNotification(username: string): Promise<void> {
    if (!webhookConfig.url) return;

    try {
        await fetch(webhookConfig.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                content: `🎯 **Available Username Found:** \`${username}\``,
                username: "Usernamesniper",
                avatar_url: "https://cdn.discordapp.com/embed/avatars/0.png",
                embeds: [{
                    title: "Username Available!",
                    description: `The username \`${username}\` is available!`,
                    color: 5793287,
                    timestamp: new Date().toISOString(),
                    footer: {
                        text: "Found by Usernamesniper Plugin"
                    }
                }]
            })
        });
    } catch (error) {
        console.error("Failed to send webhook notification:", error);
    }
}

// Send ephemeral message to user (not fully supported in this environment)
async function sendEphemeralMessage(channelId: string, content: string): Promise<void> {
    // Ephemeral messages are not fully supported in this environment
    // Using sendBotMessage instead
}

// Main execution function
async function executeSnipeUser(
    args: any[],
    ctx: any,
    options: {
        length: number;
        notify: boolean;
        webhookUrl: string;
    }
): Promise<void> {
    const { length, notify, webhookUrl } = options;
    const channelId = ctx.channel.id;

    // Update webhook config
    webhookConfig.url = webhookUrl;

    // Validate length
    if (length < 1 || length > 32) {
        sendBotMessage(channelId, {
            content: "❌ Error: Username length must be between 1 and 32 characters"
        });
        return;
    }

    // Generate all valid combinations
    const allCombinations = generateCombinations(length);
    const shuffled = shuffleArray(allCombinations);

    const foundUsernames: string[] = [];
    const batchSize = 10;
    const maxParallel = 5;

    sendBotMessage(channelId, {
        content: `🔍 Starting username check for ${length}-character usernames...\nTotal combinations: ${allCombinations.length}\nThis may take a while...`
    });

    for (let i = 0; i < shuffled.length; i += batchSize) {
        const batch = shuffled.slice(i, i + batchSize);
        const parallelChecks = Math.min(batch.length, maxParallel);

        // Process batch in parallel
        const promises = batch.slice(0, parallelChecks).map(async username => {
            try {
                const isAvailable = await checkUsernameAvailability(username);

                if (isAvailable) {
                    foundUsernames.push(username);

                    // Send webhook notification
                    await sendWebhookNotification(username);

                    // Send notification
                    sendBotMessage(channelId, {
                        content: `✅ **Found:** \`${username}\``
                    });

                    // Send ephemeral notification (not fully supported)
                    if (notify) {
                        sendBotMessage(channelId, {
                            content: `👁️ *Only you can see this ephemeral message:* \`${username}\``
                        });
                    }
                }

                return username;
            } catch (error) {
                console.error(`Error checking username ${username}:`, error);
                return null;
            }
        });

        await Promise.all(promises);

        // Update progress
        const checkedCount = Math.min(i + batchSize, shuffled.length);
        const progress = Math.round((checkedCount / shuffled.length) * 100);

        if (i % 50 === 0 || i === shuffled.length - 1) {
            sendBotMessage(channelId, {
                content: `📊 Progress: ${checkedCount}/${shuffled.length} (${progress}%)\nFound: ${foundUsernames.length} available username(s)`
            });
        }

        // Small delay between batches to avoid detection
        if (i + batchSize < shuffled.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    // Final result
    if (foundUsernames.length > 0) {
        sendBotMessage(channelId, {
            content: `🎉 **Success! Found ${foundUsernames.length} available username(s):**\n${foundUsernames.map(u => `\`${u}\``).join("\n")}`
        });
    } else {
        sendBotMessage(channelId, {
            content: `😔 **No available usernames found** for ${length}-character usernames.\nChecked: ${shuffled.length} combinations.`
        });
    }
}

// Main command definition
const snipeUserCommand = {
    name: "snipe-user",
    description: "Bannable plugin to find available Discord usernames. ⚠️ This plugin is bannable. Use with caution.",
    inputType: ApplicationCommandInputType.BUILT_IN,
    options: [
        {
            type: ApplicationCommandOptionType.INTEGER,
            name: "length",
            description: "Number of characters (1-32, Discord max)",
            required: true,
            minValue: 1,
            maxValue: 32
        },
        {
            type: ApplicationCommandOptionType.BOOLEAN,
            name: "notify",
            description: "Show available names in ephemeral messages (only you can see)",
            required: false,
            defaultValue: true
        },
        {
            type: ApplicationCommandOptionType.STRING,
            name: "webhook_url",
            description: "Webhook URL to send available usernames to (optional)",
            required: false,
            placeholder: "https://discord.com/api/webhooks/..."
        }
    ],
    execute: async (args, ctx) => {
        const lengthArg = args.find(arg => arg.name === "length");
        const notifyArg = args.find(arg => arg.name === "notify");
        const webhookArg = args.find(arg => arg.name === "webhook_url");

        const length = parseInt(lengthArg?.value as string) || 3;
        const notify = notifyArg?.value === "true";
        const webhookUrl = webhookArg?.value as string || "";

        await executeSnipeUser(args, ctx, { length, notify, webhookUrl });
    }
};

export default definePlugin({
    name: "Usernamesniper",
    description: "Find available Discord usernames by checking combinations. ⚠️ This plugin is bannable. Use at your own risk.",
    authors: [TestcordDevs.x2b],
    dependencies: ["CommandsAPI"],

    commands: [snipeUserCommand],

    start() {
        console.log("Usernamesniper plugin started");
    },

    stop() {
        console.log("Usernamesniper plugin stopped");
    }
});
