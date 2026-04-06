/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { showNotification } from "@api/Notifications/Notifications";
import { TestcordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { Logger } from "@utils/Logger";
import definePlugin, { PluginNative } from "@utils/types";
import { UserStore } from "@webpack/common";

import { settings } from "./settings";
import { DEFAULT_SNIPER_DIR } from "./utils/constants";

export const cl = classNameFactory("vc-api-sniper-");
export const Flogger = new Logger("ApiSniper", "#ff4444");
export const Native = VencordNative.pluginHelpers.ApiSniper as PluginNative<typeof import("./native")>;

// Regex patterns to detect various API keys, tokens, and credentials
const PATTERNS = {
    // ==================== DISCORD TOKENS ====================
    // Standard Discord token format: base64_userid.base64_timestamp.base64_hash
    // Example: MTIzNDU2Nzg5MDEyMzQ1Njc.Gh8jKl.Mn0pQrStUvWxYz0123456789
    discordTokenStandard: /[A-Za-z\d_-]{20,}\.[A-Za-z\d_-]{6,}\.[A-Za-z\d_-]{20,}/,

    // Discord token starting with M, N, or O (most common)
    discordTokenClassic: /(?:M|N|O)[A-Za-z\d_-]{23,}\.[A-Za-z\d_-]{6,}\.[A-Za-z\d_-]{27,}/,

    // Discord bot token format
    discordBotToken: /[A-Za-z\d_-]{24}\.[A-Za-z\d_-]{6}\.[A-Za-z\d_-]{27,}/,

    // ==================== GENERIC API KEYS WITH LABELS ====================
    apiKey: /(?:api[_-]?key|apikey|api[_-]?token|apitoken)["\s]*[:=]["\s]*["']?([a-zA-Z0-9_-]{16,})["']/i,
    authToken: /(?:auth[_-]?token|authtoken|access[_-]?token|accesstoken)["\s]*[:=]["\s]*["']?([a-zA-Z0-9_-]{16,})["']/i,
    secretKey: /(?:secret[_-]?key|secretkey|private[_-]?key|privatekey)["\s]*[:=]["\s]*["']?([a-zA-Z0-9_-]{16,})["']/i,

    // ==================== AWS KEYS ====================
    awsAccessKey: /(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}/,
    awsSecretKey: /(?:"?aws_secret_access_key"?|"?aws_secret_key"?)["\s]*[:=]["\s]*["']?([a-zA-Z0-9/+=]{40})["']/i,
    awsAccountId: /(?:account|acct)[_-]?(?:id)?["\s]*[:=]["\s]*["']?\d{12}["']/i,

    // ==================== GITHUB TOKENS ====================
    githubToken: /ghp_[a-zA-Z0-9_]{36}/,
    githubOAuth: /gho_[a-zA-Z0-9_]{36}/,
    githubAppToken: /ghu_[a-zA-Z0-9_]{36}/,
    githubRefresh: /ghr_[a-zA-Z0-9_]{36}/,
    githubPat: /github_pat_[a-zA-Z0-9_]{82}/,
    githubAppInstall: /ghs_[a-zA-Z0-9_]{36}/,
    githubDependabot: /ghd_[a-zA-Z0-9_]{36}/,

    // ==================== GOOGLE API KEYS ====================
    googleApiKey: /AIza[0-9A-Za-z_-]{35}/,
    googleOAuthSecret: /GOCSPX-[a-zA-Z0-9_-]{28}/,
    googleOAuthClient: /[0-9]+-[a-z0-9_]+\.apps\.googleusercontent\.com/i,

    // ==================== SLACK TOKENS ====================
    slackToken: /xox[baprs]-[0-9a-zA-Z-]+/,
    slackWebhook: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/i,

    // ==================== TELEGRAM BOT TOKENS ====================
    telegramBotToken: /\d+:[a-zA-Z0-9_-]{35}/,

    // ==================== JWT & OAUTH TOKENS ====================
    jwt: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/,
    oauthToken: /ya29\.[a-zA-Z0-9_-]+/,

    // ==================== GENERIC BEARER/AUTH TOKENS ====================
    bearerToken: /(?:bearer|authorization)[\s]+[a-zA-Z0-9_.-]{20,}/i,

    // ==================== EMAIL:PASSWORD COMBOS ====================
    emailPassword: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}:[^\s]{4,}/,

    // ==================== PASSWORD PATTERNS ====================
    password: /(?:password|passwd|pwd|pass)["\s]*[:=]["\s]*["']?[^\s"']{6,}["']/i,
    credential: /(?:username|user|email)["\s]*[:=]["\s]*["']?[^\s"']+["'].*?(?:password|passwd|pwd|pass)["\s]*[:=]["\s]*["']?[^\s"']+["']/is,

    // ==================== PRIVATE KEYS ====================
    privateKey: /-----BEGIN\s+(?:RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE\s+KEY-----/,
    sshKey: /ssh-(?:rsa|dss|ed25519)\s+[A-Za-z0-9+/]+={0,3}/,

    // ==================== HEROKU API KEYS ====================
    herokuApiKey: /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/,

    // ==================== STRIPE KEYS ====================
    stripeKey: /(?:sk|pk|rk)_(?:live|test)_[a-zA-Z0-9]{24,}/,
    stripeRestricted: /rk_(?:live|test)_[a-zA-Z0-9]{24,}/,

    // ==================== TWILIO KEYS ====================
    twilioKey: /SK[a-f0-9]{32}/,
    twilioAccount: /AC[a-f0-9]{32}/,

    // ==================== SENDGRID KEYS ====================
    sendGridKey: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/,

    // ==================== OPENAI/ANTHROPIC/AI KEYS ====================
    openaiKey: /sk-[a-zA-Z0-9_-]{20,}/,
    anthropicKey: /sk-ant-[a-zA-Z0-9_-]{20,}/,
    deepseekKey: /sk-[a-zA-Z0-9_-]{32,}/,
    cohereKey: /[a-zA-Z0-9]{40,}/,
    mistralKey: /[a-zA-Z0-9_-]{32,}/,
    groqKey: /gsk_[a-zA-Z0-9]{52}/,

    // ==================== CLOUDFLARE KEYS ====================
    cloudflareApiKey: /[a-zA-Z0-9_-]{37,}/,
    cloudflareGlobalKey: /[a-f0-9]{37}/,

    // ==================== DIGITALOCEAN KEYS ====================
    digitalOceanToken: /dop_v1_[a-f0-9]{64}/,

    // ==================== GITLAB TOKENS ====================
    gitlabToken: /glpat-[a-zA-Z0-9_-]{20,}/,

    // ==================== BITBUCKET TOKENS ====================
    bitbucketToken: /ATBB[a-zA-Z0-9]{8,}/,

    // ==================== NPM TOKENS ====================
    npmToken: /npm_[a-zA-Z0-9]{36}/,

    // ==================== PYPI/TWINE TOKENS ====================
    pypiToken: /pypi-[a-zA-Z0-9_-]+/,

    // ==================== FIGMA TOKENS ====================
    figmaToken: /figd_[a-zA-Z0-9_-]+/,

    // ==================== DISCORD WEBHOOK URLs ====================
    discordWebhook: /https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[a-zA-Z0-9_-]+/i,

    // ==================== GENERIC HEX TOKEN/KEY ====================
    // Matches patterns like: 033d491randomshia3d32221579da90d.fGAfxjSwJgrNHO8f
    genericHexKey: /[a-f0-9]{20,}\.[a-zA-Z0-9_-]{10,}/,

    // ==================== GENERIC ALPHANUMERIC KEY WITH DOTS ====================
    genericDotKey: /[a-zA-Z0-9_-]{16,}\.[a-zA-Z0-9_-]{10,}/,

    // ==================== LONG ALPHANUMERIC STRINGS ====================
    longAlphanumericKey: /[a-zA-Z0-9]{40,}/,

    // ==================== KEYS WITH COMMON PREFIXES ====================
    skKey: /sk[_-][a-zA-Z0-9_-]{20,}/,
    pkKey: /pk[_-][a-zA-Z0-9_-]{20,}/,
    rkKey: /rk[_-][a-zA-Z0-9_-]{20,}/,
    tkKey: /tk[_-][a-zA-Z0-9_-]{20,}/,
    liveKey: /live[_-][a-zA-Z0-9_-]{20,}/i,
    testKey: /test[_-][a-zA-Z0-9_-]{20,}/i,

    // ==================== BASE64-ENCODED KEYS ====================
    base64Key: /(?:[A-Za-z0-9+/]{4}){10,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/,

    // ==================== GENERIC SECRET/KEY PATTERNS ====================
    secret: /(?:secret|token|key|auth|credential)[_\s-]*(?:=|:)\s*["']?[a-zA-Z0-9_-]{16,}/i,

    // ==================== API KEY IN URL FORMAT ====================
    apiKeyInUrl: /[?&](?:api[_-]?key|apikey|token|auth|access_token|client_secret)=([a-zA-Z0-9_-]{16,})/i,

    // ==================== DATABASE CONNECTION STRINGS ====================
    mongodbUri: /mongodb(?:\+srv)?:\/\/[^\s]+:[^\s]+@[^\s]+/i,
    postgresUri: /postgresql?:\/\/[^\s]+:[^\s]+@[^\s]+/i,
    mysqlUri: /mysql?:\/\/[^\s]+:[^\s]+@[^\s]+/i,
    redisUri: /redis(?:s)?:\/\/[^\s]+:[^\s]+@[^\s]+/i,

    // ==================== FIREBASE KEYS ====================
    firebaseKey: /AIza[0-9A-Za-z_-]{35}/,
    firebaseProject: /[a-z0-9-]+\.firebaseio\.com/i,

    // ==================== MAILGUN KEYS ====================
    mailgunKey: /key-[a-f0-9]{32}/,
    mailgunDomain: /sandbox[a-f0-9]+\.mailgun\.org/i,

    // ==================== ALGOLIA KEYS ====================
    algoliaKey: /[a-f0-9]{32}/,

    // ==================== DATADOG KEYS ====================
    datadogKey: /[a-f0-9]{32}/,

    // ==================== SHOPIFY KEYS ====================
    shopifyKey: /shpat_[a-fA-F0-9]{32}/,
    shopifyCustom: /shpca_[a-fA-F0-9]{32}/,
    shopifyPrivate: /shppa_[a-fA-F0-9]{32}/,

    // ==================== SQUARESPACE KEYS ====================
    squarespaceKey: /sq0[a-z]{3}-[a-zA-Z0-9_-]{20,}/,

    // ==================== PAYPAL KEYS ====================
    paypalToken: /access_token\$production\$[a-zA-Z0-9]+/i,

    // ==================== GENERIC SERVICE KEYS ====================
    serviceKey: /(?:service|svc)[_-]?(?:key|token|secret)[_\s-]*(?:=|:)\s*["']?[a-zA-Z0-9_-]{16,}/i,
};

interface SnipedCredential {
    username: string;
    userId: string;
    channelId: string;
    messageId: string;
    credentialType: string;
    credentialValue: string;
    timestamp: string;
    content: string;
}

function checkForCredentials(content: string): Array<{ type: string; value: string; }> {
    const findings: Array<{ type: string; value: string; }> = [];

    for (const [type, pattern] of Object.entries(PATTERNS)) {
        const matches = content.match(pattern);
        if (matches) {
            // For email:password pattern, extract the full match
            if (type === "emailPassword") {
                findings.push({ type, value: matches[0] });
            } else {
                // Use the full match or the first capture group
                findings.push({ type, value: matches[0] });
            }
        }
    }

    return findings;
}

async function handleSnipedCredential(credential: SnipedCredential) {
    try {
        // Save to file via native module
        const fileName = `snipe_${Date.now()}_${Math.random().toString(36).substring(7)}.txt`;
        const content = [
            "=== API SNIPER REPORT ===",
            "",
            `Username: ${credential.username}`,
            `User ID: ${credential.userId}`,
            `Channel ID: ${credential.channelId}`,
            `Message ID: ${credential.messageId}`,
            "",
            `Credential Type: ${credential.credentialType}`,
            `Credential Value: ${credential.credentialValue}`,
            "",
            `Timestamp: ${credential.timestamp}`,
            "",
            "Original Message Content:",
            "---",
            credential.content,
            "---",
            "",
            "Reported by: TestcordDevs.x2b",
        ].join("\n");

        await Native.saveSnipe(fileName, content);

        // Send notification
        showNotification({
            title: "🎯 API Sniper Alert",
            body: `Caught ${credential.credentialType} from ${credential.username}`,
            color: "#ff4444",
            onClick: () => {
                // Could open folder or show details
            },
        });

        Flogger.info(`Sniped ${credential.credentialType} from ${credential.username}`);
    } catch (error) {
        Flogger.error("Failed to save sniped credential:", error);
    }
}

function messageCreateHandler(payload: any) {
    const { message } = payload;
    if (!message || !message.content || !message.author) return;

    // Skip own messages if configured
    if (message.author.id === UserStore.getCurrentUser()?.id) {
        if (!settings.store.snipeOwnMessages) return;
    }

    const credentials = checkForCredentials(message.content);

    for (const cred of credentials) {
        const snipedData: SnipedCredential = {
            username: message.author.username || "Unknown",
            userId: message.author.id || "Unknown",
            channelId: message.channel_id || payload.channelId || "Unknown",
            messageId: message.id || "Unknown",
            credentialType: cred.type,
            credentialValue: cred.value,
            timestamp: new Date().toLocaleString(),
            content: message.content,
        };

        handleSnipedCredential(snipedData);
    }
}

function messageUpdateHandler(payload: any) {
    const { message } = payload;
    if (!message || !message.content || !message.author) return;

    const credentials = checkForCredentials(message.content);

    for (const cred of credentials) {
        const snipedData: SnipedCredential = {
            username: message.author.username || "Unknown",
            userId: message.author.id || "Unknown",
            channelId: message.channel_id || payload.channelId || "Unknown",
            messageId: message.id || "Unknown",
            credentialType: cred.type,
            credentialValue: cred.value,
            timestamp: new Date().toLocaleString(),
            content: message.content,
        };

        handleSnipedCredential(snipedData);
    }
}

export default definePlugin({
    name: "ApiSniper",
    description: "Detects and logs API keys, tokens, and credentials from chat messages",
    authors: [TestcordDevs.x2b],

    settings,

    flux: {
        "MESSAGE_CREATE": messageCreateHandler,
        "MESSAGE_UPDATE": messageUpdateHandler,
    },

    async start() {
        const { sniperDir } = await Native.getSettings();
        settings.store.sniperDir = sniperDir || DEFAULT_SNIPER_DIR;
    },

    stop() {
        // Cleanup if needed
    },
});
