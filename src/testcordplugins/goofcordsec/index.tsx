/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addChatBarButton, ChatBarButton, ChatBarButtonFactory, removeChatBarButton } from "@api/ChatButtons";
import { addMessagePreSendListener, MessageSendListener, removeMessagePreSendListener } from "@api/MessageEvents";
import { updateMessage } from "@api/MessageUpdater";
import { definePluginSettings } from "@api/Settings";
import { TestcordDevs } from "@utils/constants";
import { getStegCloak } from "@utils/dependencies";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { findExportedComponentLazy } from "@webpack";
import { FluxDispatcher } from "@webpack/common";

const LockIcon = findExportedComponentLazy("LockIcon");
const LockUnlockedIcon = findExportedComponentLazy("LockUnlockedIcon");

const logger = new Logger("GoofcordSecurity");

// ────────────────────────────────────────────────────────────────── settings

export const settings = definePluginSettings({
    // ── Firewall (native) ──────────────────────────────────────────────
    firewall: {
        type: OptionType.BOOLEAN, default: true, restartNeeded: true,
        description: "Block known telemetry / tracking / analytics endpoints (Sentry, Discord science, Google ads, etc.).",
    },
    customFirewallRules: {
        type: OptionType.BOOLEAN, default: false, restartNeeded: true,
        description: "Override the built-in firewall rules with your own.",
    },
    blocklist: {
        type: OptionType.STRING, restartNeeded: true,
        default: [
            "https://*/api/v*/science",
            "https://*/api/v*/applications/detectable",
            "https://*/api/v*/auth/location-metadata",
            "https://*/api/v*/premium-marketing",
            "https://*/api/v*/scheduled-maintenances/upcoming.json",
            "https://*/error-reporting-proxy/*",
            "https://cdn.discordapp.com/bad-domains/*",
            "https://www.youtube.com/youtubei/v*/next?*",
            "https://www.youtube.com/s/desktop/*",
            "https://www.youtube.com/youtubei/v*/log_event?*",
        ].join(", "),
        description: "Comma-separated URL patterns to block. Only used when 'Custom firewall rules' is on.",
    },
    blockedStrings: {
        type: OptionType.STRING, restartNeeded: true,
        default: ["sentry", "google", "tracking", "stats", "\\.spotify", "pagead", "analytics", "doubleclick"].join(", "),
        description: "Comma-separated substrings — any XHR URL containing one is blocked (regex syntax allowed).",
    },
    allowedStrings: {
        type: OptionType.STRING, restartNeeded: true,
        default: ["videoplayback", "discord-attachments", "googleapis", "search", "api.spotify", "discord.com/assets/sentry."].join(", "),
        description: "Comma-separated substrings whitelisted — overrides the blocklist (regex syntax allowed).",
    },

    // ── CSP / UA / Embeds (native) ─────────────────────────────────────
    unstrictCsp: {
        type: OptionType.BOOLEAN, default: true, restartNeeded: true,
        description: "Strip Content-Security-Policy on the main frame so external themes / fonts load.",
    },
    spoofChrome: {
        type: OptionType.BOOLEAN, default: true, restartNeeded: true,
        description: "Emulate Chrome (User-Agent + Client Hints) so Discord doesn't fingerprint Electron.",
    },
    spoofWindows: {
        type: OptionType.BOOLEAN, default: false, restartNeeded: true,
        description: "Report the OS as Windows (useful when Discord blocks your VPN on Linux).",
    },
    invidiousEmbeds: {
        type: OptionType.BOOLEAN, default: false, restartNeeded: true,
        description: "Replace YouTube embeds with Invidious embeds for privacy-friendly playback.",
    },
    invidiousInstance: {
        type: OptionType.STRING, default: "https://invidious.nerdvpn.de", restartNeeded: true,
        description: "Invidious instance URL.",
    },

    // ── Anti-tracking (native) ────────────────────────────────────────
    stripReferer: {
        type: OptionType.BOOLEAN, default: true, restartNeeded: true,
        description: "Strip the Referer header on outgoing requests.",
    },
    sendDnt: {
        type: OptionType.BOOLEAN, default: true, restartNeeded: true,
        description: "Send a DNT (Do Not Track) header on every request.",
    },
    disableCrashReporter: {
        type: OptionType.BOOLEAN, default: true, restartNeeded: true,
        description: "Disable the Chromium crash reporter at startup.",
    },

    // ── WebRTC (renderer) ─────────────────────────────────────────────
    webRtcLeakPrevent: {
        type: OptionType.BOOLEAN, default: true,
        description: "Force WebRTC ICE policy to relay-only so Discord cannot discover your real IP during voice calls.",
    },

    // ── Message encryption (renderer) ─────────────────────────────────
    messageEncryption: {
        type: OptionType.BOOLEAN, default: false, restartNeeded: true,
        description: "Enable StegCloak-based message encryption (toggle the lock button in the chat bar to encrypt messages).",
    },
    encryptionPasswords: {
        type: OptionType.STRING, default: "password",
        description: "Comma-separated list of passwords. The first is used for encryption; all are tried for decryption.",
    },
    encryptionCover: {
        type: OptionType.STRING, default: "Super secret message",
        description: "Visible cover text shown to anyone without the password (must contain at least 2 words).",
    },
    encryptionMark: {
        type: OptionType.STRING, default: "🔓 ",
        description: "String prepended to auto-decrypted messages so you can tell them apart from normal text.",
    },
    autoDecrypt: {
        type: OptionType.BOOLEAN, default: true,
        description: "Automatically attempt to decrypt incoming encrypted messages with your stored passwords.",
    },
});

// ────────────────────────────────────────────────────────────────── webrtc

interface RTCPeerConnectionWithWebKit { webkitRTCPeerConnection?: typeof RTCPeerConnection; }
let originalRTC: { name: string; ctor: typeof RTCPeerConnection; }[] = [];

function patchWebRtc() {
    const conns: { name: string; ctor: typeof RTCPeerConnection; }[] = [];
    if (typeof RTCPeerConnection !== "undefined")
        conns.push({ name: "RTCPeerConnection", ctor: RTCPeerConnection });
    const win = window as Window & RTCPeerConnectionWithWebKit;
    if (typeof win.webkitRTCPeerConnection !== "undefined")
        conns.push({ name: "webkitRTCPeerConnection", ctor: win.webkitRTCPeerConnection! });
    if (!conns.length) return;
    originalRTC = conns;

    for (const { name, ctor } of conns) {
        const Patched = class extends ctor {
            constructor(config?: RTCConfiguration) {
                super({ ...config, iceTransportPolicy: "relay" });
            }
            setConfiguration(config: RTCConfiguration): void {
                super.setConfiguration({ ...config, iceTransportPolicy: "relay" });
            }
        } as typeof RTCPeerConnection;

        if (name === "webkitRTCPeerConnection") win.webkitRTCPeerConnection = Patched;
        else window.RTCPeerConnection = Patched;
    }
    logger.info("WebRTC leak prevention active (ICE policy: relay)");
}

function unpatchWebRtc() {
    if (!originalRTC.length) return;
    const win = window as Window & RTCPeerConnectionWithWebKit;
    for (const { name, ctor } of originalRTC) {
        if (name === "webkitRTCPeerConnection") win.webkitRTCPeerConnection = ctor;
        else window.RTCPeerConnection = ctor;
    }
    originalRTC = [];
}

// ────────────────────────────────────────────────────────────── stegcloak

let steggo: any = null;
let encryptNextMessage = false;

// matches strings produced by StegCloak (zero-width chars)
const INV_REGEX = /( \u200c|\u200d |[\u2060-\u2064])[^\u200b]/;

async function ensureStegCloak() {
    if (steggo) return steggo;
    const { default: StegCloak } = await getStegCloak();
    // (encrypt=true, integrity=false) — same as InvisibleChat
    steggo = new StegCloak(true, false);
    return steggo;
}

function getPasswords(): string[] {
    return settings.store.encryptionPasswords.split(",").map(s => s.trim()).filter(Boolean);
}

function tryDecrypt(content: string): string | null {
    if (!steggo || !INV_REGEX.test(content)) return null;
    // workaround from InvisibleChat: stegcloak chokes on leading non-word
    let stripped = content;
    if (/^\W/.test(content)) stripped = `d ${content}d`;
    for (const password of getPasswords()) {
        try {
            const decrypted: string = steggo.reveal(stripped, password);
            // We mark every encrypted payload with a trailing zero-width space (\u200b).
            // If the decryption used the right password, the marker survives.
            if (decrypted.endsWith("\u200b"))
                return decrypted.slice(0, -1);
        } catch { /* wrong password — keep trying */ }
    }
    return null;
}

const ChatBarIcon: ChatBarButtonFactory = ({ isMainChat }) => {
    const { messageEncryption } = settings.use(["messageEncryption"]);
    if (!isMainChat || !messageEncryption) return null;
    return (
        <ChatBarButton
            tooltip={encryptNextMessage ? "Encryption ON" : "Encryption OFF"}
            onClick={() => {
                encryptNextMessage = !encryptNextMessage;
                FluxDispatcher.dispatch({ type: "GOOFCORDSEC_ENC_TOGGLE" });
            }}
            buttonProps={{ "aria-haspopup": "dialog" }}
        >
            {encryptNextMessage ? <LockIcon /> : <LockUnlockedIcon />}
        </ChatBarButton>
    );
};

const onSend: MessageSendListener = async (_channelId, msg) => {
    if (!settings.store.messageEncryption || !encryptNextMessage) return;
    if (!msg.content) return;

    const passwords = getPasswords();
    if (!passwords.length) {
        logger.warn("Encryption requested but no passwords configured.");
        return;
    }
    const cover = settings.store.encryptionCover.trim();
    if (cover.split(/\s+/).length < 2) {
        logger.warn("Cover text must contain at least 2 words. Falling back to default.");
    }
    try {
        const sc = await ensureStegCloak();
        const safeCover = cover.split(/\s+/).length >= 2 ? cover : "Super secret message";
        // \u200b acts as our "correct password" sentinel — see tryDecrypt
        msg.content = sc.hide(msg.content + "\u200b", passwords[0], safeCover);
    } catch (err) {
        logger.error("Failed to encrypt outgoing message:", err);
    }
};

function onMessageCreate(event: { message: any; }) {
    if (!settings.store.autoDecrypt || !settings.store.messageEncryption) return;
    const m = event.message;
    if (!m?.content || typeof m.content !== "string") return;
    if (!INV_REGEX.test(m.content)) return;
    const decrypted = tryDecrypt(m.content);
    if (!decrypted) return;
    updateMessage(m.channel_id, m.id, { content: settings.store.encryptionMark + decrypted });
}

// ────────────────────────────────────────────────────────────────── plugin

export default definePlugin({
    name: "GoofcordSecurity",
    description:
        "Ports GoofCord's privacy & security features: telemetry firewall, CSP unstricter, Chrome UA spoofer, Invidious embeds, anti-tracking headers, WebRTC leak prevention, and StegCloak message encryption.",
    tags: ["Privacy", "Utility"],
    authors: [TestcordDevs.sirphantom89],
    dependencies: ["MessageEventsAPI", "MessageUpdaterAPI", "ChatInputButtonAPI"],
    settings,

    // exported so native.ts can see toggles, and for debugging
    INV_REGEX,

    async start() {
        if (settings.store.webRtcLeakPrevent) {
            try { patchWebRtc(); } catch (e) { logger.error("WebRTC patch failed:", e); }
        }

        if (settings.store.messageEncryption) {
            try {
                await ensureStegCloak();
                addChatBarButton("GoofcordSecurityEncrypt", ChatBarIcon, LockIcon);
                addMessagePreSendListener(onSend);
                FluxDispatcher.subscribe("MESSAGE_CREATE", onMessageCreate);
                FluxDispatcher.subscribe("MESSAGE_UPDATE", onMessageCreate);
            } catch (e) {
                logger.error("Failed to initialize message encryption:", e);
            }
        }
    },

    stop() {
        unpatchWebRtc();
        removeChatBarButton("GoofcordSecurityEncrypt");
        removeMessagePreSendListener(onSend);
        try {
            FluxDispatcher.unsubscribe("MESSAGE_CREATE", onMessageCreate);
            FluxDispatcher.unsubscribe("MESSAGE_UPDATE", onMessageCreate);
        } catch { /* already gone */ }
    },
});
