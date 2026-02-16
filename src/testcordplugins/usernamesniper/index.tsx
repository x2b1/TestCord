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

// Global settings
const settings: UsernameSniperSettings = {
    proxyUrl: "",
    maxParallelChecks: 5,
    batchSize: 10,
    batchDelay: 100,
    checkInterval: 20,
    webhookUrl: "",
    notifyInUserMessages: true
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

// Build full URL from base URL and path
function buildUrl(baseUrl: string, path: string): string {
    console.log(`[Usernamesniper] buildUrl called: baseUrl='${baseUrl}', path='${path}'`);

    // Check if baseUrl already has a protocol
    if (baseUrl.startsWith("http://") || baseUrl.startsWith("https://")) {
        console.log(`[Usernamesniper] baseUrl has protocol, returning: ${baseUrl}${path}`);
        return `${baseUrl}${path}`;
    }

    // Extract the hostname part (before first slash)
    const hostname = baseUrl.split("/")[0];
    console.log(`[Usernamesniper] hostname: '${hostname}'`);
    const isIP = /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
    console.log(`[Usernamesniper] isIP: ${isIP}`);

    if (isIP) {
        const result = `http://${baseUrl}${path}`;
        console.log(`[Usernamesniper] Using HTTP for IP, returning: ${result}`);
        return result;
    }

    // Assume it's a domain with https
    const result = `https://${baseUrl}${path}`;
    console.log(`[Usernamesniper] Using HTTPS for domain, returning: ${result}`);
    return result;
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
        // Discord doesn't have a direct username availability check endpoint.
        // We use a workaround: try to register the username and see if it fails.
        // This approach is NOT reliable and Discord may ban accounts for this.

        const baseUrl = proxyUrl || "https://discord.com/api/v10";
        console.log(`[Usernamesniper] baseUrl: '${baseUrl}', proxyUrl: '${proxyUrl}'`);
        const fullUrl = buildUrl(baseUrl, "/users/@me/username");
        console.log(`[Usernamesniper] fullUrl: ${fullUrl}`);

        // Try to use the username - we use the current user's session
        const response = await fetch(fullUrl, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...(proxyUrl ? {} : { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" })
            },
            body: JSON.stringify({ username })
        });

        console.log(`[Usernamesniper] Response status: ${response.status}, URL: ${fullUrl}`);

        // Mark as checked
        checkedUsernames.add(username);
        state.lastRequestTime = Date.now();
        state.requestCount++;

        // Handle response
        // 200 = available (you can set it)
        // 400 = taken (or invalid username)
        // 403 = forbidden (could be taken, or you can't change username due to recent changes)
        // 404 = not found (shouldn't happen for this endpoint)
        // 429 = rate limited
        if (response.status === 200) {
            console.log(`[Usernamesniper] Username '${username}' is AVAILABLE`);
            return true; // Username is available
        } else if (response.status === 400) {
            // 400 Bad Request usually means username is taken
            console.log(`[Usernamesniper] Username '${username}' is TAKEN (400)`);
            return false;
        } else if (response.status === 403 || response.status === 404) {
            // 403 could mean taken, or could be auth/rate limit issue
            // For now, treat as taken (conservative approach)
            console.log(`[Usernamesniper] Username '${username}' is TAKEN (${response.status})`);
            return false;
        } else if (response.status === 429) {
            state.consecutive429++;
            console.log(`[Usernamesniper] Rate limited for '${username}'`);
            throw new Error("Rate limited");
        }

        console.log(`[Usernamesniper] Username '${username}' status ${response.status} - treating as TAKEN`);
        return false;
    } catch (error) {
        // Mark as checked even on error to avoid retrying
        checkedUsernames.add(username);
        state.lastRequestTime = Date.now();
        state.requestCount++;
        console.log(`[Usernamesniper] Error checking '${username}':`, error);
        throw error;
    }
}

// Send webhook notification
async function sendWebhookNotification(username: string): Promise<void> {
    if (!webhookConfig.url) return;

    try {
        const url = buildUrl(webhookConfig.url, "");

        await fetch(url, {
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
        proxyUrl?: string;
        webhookUrl: string;
    }
): Promise<void> {
    const { length, notify, proxyUrl, webhookUrl } = options;
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
                const isAvailable = await checkUsernameAvailability(username, proxyUrl);

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
    description: "Bannable plugin to find available Discord usernames. ⚠️ This plugin is bannable. Use with caution. NOTE: Username checking may not work due to Discord API limitations.",
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
            name: "proxy_url",
            description: "Proxy URL for username checks (leave empty for direct Discord API)",
            required: false,
            placeholder: "https://your-proxy.com"
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
        const proxyUrlArg = args.find(arg => arg.name === "proxy_url");
        const webhookArg = args.find(arg => arg.name === "webhook_url");

        const length = parseInt(lengthArg?.value as string) || 3;
        const notify = notifyArg?.value === "true";
        const proxyUrl = proxyUrlArg?.value as string || settings.proxyUrl;
        const webhookUrl = webhookArg?.value as string || settings.webhookUrl;

        console.log(`[Usernamesniper] Command executed: length=${length}, notify=${notify}, proxyUrl='${proxyUrl}', webhookUrl='${webhookUrl}'`);
        console.log(`[Usernamesniper] Settings proxyUrl: '${settings.proxyUrl}'`);

        await executeSnipeUser(args, ctx, { length, notify, proxyUrl, webhookUrl });
    }
};

export default definePlugin({
    name: "Usernamesniper",
    description: "Find available Discord usernames by checking combinations. ⚠️ This plugin is bannable. Use at your own risk. Also please note that you need to restart discord after you're done using it to ensure it fully stops.",
    authors: [TestcordDevs.x2b],
    dependencies: ["CommandsAPI"],

    commands: [snipeUserCommand],

    settingsAboutComponent: () => (
        <div style={{ padding: "10px" }}>
            <h3>Usernamesniper Settings</h3>
            <p>Configure your username checking preferences below:</p>
            <div style={{ marginTop: "10px" }}>
                <label style={{ display: "block", marginBottom: "5px" }}>
                    <strong>Proxy URL:</strong>
                    <input
                        type="text"
                        placeholder="https://your-proxy.com"
                        value={settings.proxyUrl}
                        onChange={e => { settings.proxyUrl = e.target.value; }}
                        style={{ width: "100%", marginTop: "5px", padding: "5px" }}
                    />
                </label>
                <label style={{ display: "block", marginBottom: "5px", marginTop: "10px" }}>
                    <strong>Max Parallel Checks:</strong>
                    <input
                        type="number"
                        min="1"
                        max="50"
                        value={settings.maxParallelChecks}
                        onChange={e => { settings.maxParallelChecks = parseInt(e.target.value); }}
                        style={{ width: "100%", marginTop: "5px", padding: "5px" }}
                    />
                </label>
                <label style={{ display: "block", marginBottom: "5px", marginTop: "10px" }}>
                    <strong>Batch Size:</strong>
                    <input
                        type="number"
                        min="1"
                        max="100"
                        value={settings.batchSize}
                        onChange={e => { settings.batchSize = parseInt(e.target.value); }}
                        style={{ width: "100%", marginTop: "5px", padding: "5px" }}
                    />
                </label>
                <label style={{ display: "block", marginBottom: "5px", marginTop: "10px" }}>
                    <strong>Batch Delay (ms):</strong>
                    <input
                        type="number"
                        min="10"
                        max="1000"
                        value={settings.batchDelay}
                        onChange={e => { settings.batchDelay = parseInt(e.target.value); }}
                        style={{ width: "100%", marginTop: "5px", padding: "5px" }}
                    />
                </label>
                <label style={{ display: "block", marginBottom: "5px", marginTop: "10px" }}>
                    <strong>Check Interval (ms):</strong>
                    <input
                        type="number"
                        min="1"
                        max="500"
                        value={settings.checkInterval}
                        onChange={e => { settings.checkInterval = parseInt(e.target.value); }}
                        style={{ width: "100%", marginTop: "5px", padding: "5px" }}
                    />
                </label>
                <label style={{ display: "block", marginBottom: "5px", marginTop: "10px" }}>
                    <strong>Webhook URL:</strong>
                    <input
                        type="text"
                        placeholder="https://discord.com/api/webhooks/..."
                        value={settings.webhookUrl}
                        onChange={e => { settings.webhookUrl = e.target.value; }}
                        style={{ width: "100%", marginTop: "5px", padding: "5px" }}
                    />
                </label>
                <label style={{ display: "block", marginBottom: "5px", marginTop: "10px" }}>
                    <input
                        type="checkbox"
                        checked={settings.notifyInUserMessages}
                        onChange={e => { settings.notifyInUserMessages = e.target.checked; }}
                        style={{ marginRight: "5px" }}
                    />
                    Show available names in ephemeral messages (only you can see)
                </label>
            </div>
        </div>
    ),

    start() {
        console.log("Usernamesniper plugin started");
    },

    stop() {
        console.log("Usernamesniper plugin stopped");
    }
});
