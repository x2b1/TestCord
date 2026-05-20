/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType, StartAt } from "@utils/types";

const logger = new Logger("WebCordHardened");

const DISCORD_HOSTS = [
    "discord.com",
    "discordapp.com",
    "discordapp.net",
    "discord.gg",
    "discord.media"
] as const;

const SAFE_EXTERNAL_PROTOCOLS = new Set(["https:", "http:", "mailto:", "tel:", "sms:"]);

const settings = definePluginSettings({
    blockTelemetry: {
        type: OptionType.BOOLEAN,
        description: "Block Discord telemetry endpoints.",
        default: true,
    },
    blockSentry: {
        type: OptionType.BOOLEAN,
        description: "Block Sentry crash reporting requests.",
        default: true,
    },
    blockFingerprinting: {
        type: OptionType.BOOLEAN,
        description: "Block known browser fingerprinting endpoints.",
        default: true,
    },
    webRtcIcePolicy: {
        type: OptionType.SELECT,
        description: "Choose how WebRTC connections reveal network routes.",
        options: [
            { label: "Relay only", value: "relay", default: true },
            { label: "Public", value: "all" },
        ],
    },
    allowDeviceEnumeration: {
        type: OptionType.BOOLEAN,
        description: "Allow Discord to list media devices.",
        default: false,
    },
    blockNotifications: {
        type: OptionType.BOOLEAN,
        description: "Block notification permission prompts.",
        default: true,
    },
    blockUnsafeExternalProtocols: {
        type: OptionType.BOOLEAN,
        description: "Block unsafe external link protocols.",
        default: true,
    },
    hideDownloadNag: {
        type: OptionType.BOOLEAN,
        description: "Hide Discord desktop download prompts.",
        default: true,
    },
    logBlockedRequests: {
        type: OptionType.BOOLEAN,
        description: "Log blocked privacy requests.",
        default: false,
    },
});

type XhrOpen = typeof XMLHttpRequest.prototype.open;
type XhrSend = typeof XMLHttpRequest.prototype.send;

interface WebKitRTCWindow {
    webkitRTCPeerConnection?: typeof RTCPeerConnection;
}

let originalFetch: typeof window.fetch | null = null;
let originalXhrOpen: XhrOpen | null = null;
let originalXhrSend: XhrSend | null = null;
let originalSendBeacon: Navigator["sendBeacon"] | null = null;
let originalWindowOpen: typeof window.open | null = null;
let originalEnumerateDevices: MediaDevices["enumerateDevices"] | null = null;
let originalNotificationRequestPermission: typeof Notification.requestPermission | null = null;
let originalNotificationPermissionDescriptor: PropertyDescriptor | undefined;
let originalConnections: Array<{ name: keyof Window | "webkitRTCPeerConnection"; ctor: typeof RTCPeerConnection; }> = [];

const blockedXhrUrls = new WeakMap<XMLHttpRequest, string>();

function matchesHost(hostname: string, root: string): boolean {
    return hostname === root || hostname.endsWith(`.${root}`);
}

function isDiscordHost(hostname: string): boolean {
    return DISCORD_HOSTS.some(root => matchesHost(hostname, root));
}

function getUrl(input: RequestInfo | URL | string): URL | null {
    const rawUrl = input instanceof Request ? input.url : String(input);

    try {
        return new URL(rawUrl, location.href);
    } catch (error) {
        if (settings.store.logBlockedRequests) logger.warn("Could not parse request URL.", error);
        return null;
    }
}

function getBlockedRequestKind(url: URL | null): string | null {
    if (!url) return null;

    const path = url.pathname;

    if (settings.store.blockTelemetry && isDiscordHost(url.hostname) && (
        path.endsWith("/science") ||
        path.endsWith("/track") ||
        path.endsWith("/tracing")
    )) {
        return "telemetry";
    }

    if (settings.store.blockSentry && (
        matchesHost(url.hostname, "sentry.io") ||
        (path.includes("/assets/sentry.") && path.endsWith(".js"))
    )) {
        return "sentry";
    }

    if (settings.store.blockFingerprinting && (
        path.startsWith("/cdn-cgi/") ||
        path.endsWith("/api.js")
    )) {
        return "fingerprinting";
    }

    return null;
}

function logBlocked(kind: string, url: URL): void {
    if (!settings.store.logBlockedRequests) return;
    logger.info(`Blocked ${kind}: ${url.hostname}${url.pathname}`);
}

function patchFetch(): void {
    if (originalFetch) return;

    originalFetch = window.fetch;

    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const url = getUrl(input);
        const blockedKind = getBlockedRequestKind(url);

        if (blockedKind && url) {
            logBlocked(blockedKind, url);
            return Promise.resolve(new Response(null, {
                status: 204,
                statusText: "Blocked by WebCordHardened",
            }));
        }

        return originalFetch!.call(window, input, init);
    };
}

function patchXhr(): void {
    if (originalXhrOpen || originalXhrSend) return;

    originalXhrOpen = XMLHttpRequest.prototype.open;
    originalXhrSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method: string, urlLike: string | URL, async = true, username?: string | null, password?: string | null) {
        const url = getUrl(urlLike);
        const blockedKind = getBlockedRequestKind(url);

        if (blockedKind && url) {
            logBlocked(blockedKind, url);
            const blobUrl = URL.createObjectURL(new Blob([""], { type: "text/plain" }));
            blockedXhrUrls.set(this, blobUrl);
            return originalXhrOpen!.call(this, "GET", blobUrl, async, username, password);
        }

        return originalXhrOpen!.call(this, method, urlLike, async, username, password);
    };

    XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
        const blockedUrl = blockedXhrUrls.get(this);

        if (!blockedUrl) return originalXhrSend!.call(this, body);

        this.addEventListener("loadend", () => {
            URL.revokeObjectURL(blockedUrl);
            blockedXhrUrls.delete(this);
        }, { once: true });

        return originalXhrSend!.call(this, null);
    };
}

function patchBeacon(): void {
    if (originalSendBeacon || typeof navigator.sendBeacon !== "function") return;

    originalSendBeacon = navigator.sendBeacon;

    navigator.sendBeacon = function (urlLike: string | URL, data?: BodyInit | null) {
        const url = getUrl(urlLike);
        const blockedKind = getBlockedRequestKind(url);

        if (blockedKind && url) {
            logBlocked(blockedKind, url);
            return true;
        }

        return originalSendBeacon!.call(this, urlLike, data);
    };
}

function patchMediaDevices(): void {
    const { mediaDevices } = navigator;
    if (!mediaDevices) return;

    if (!originalEnumerateDevices && typeof mediaDevices.enumerateDevices === "function") {
        originalEnumerateDevices = mediaDevices.enumerateDevices;

        mediaDevices.enumerateDevices = function () {
            if (!settings.store.allowDeviceEnumeration) return Promise.resolve([]);
            return originalEnumerateDevices!.call(this);
        };
    }
}

function patchNotifications(): void {
    if (typeof Notification === "undefined" || originalNotificationRequestPermission) return;

    originalNotificationRequestPermission = Notification.requestPermission;
    originalNotificationPermissionDescriptor = Object.getOwnPropertyDescriptor(Notification, "permission");

    Notification.requestPermission = (deprecatedCallback?: NotificationPermissionCallback) => {
        if (!settings.store.blockNotifications) {
            return originalNotificationRequestPermission!.call(Notification, deprecatedCallback);
        }

        deprecatedCallback?.("denied");
        return Promise.resolve("denied");
    };

    Object.defineProperty(Notification, "permission", {
        configurable: true,
        get() {
            if (settings.store.blockNotifications) return "denied";

            const getter = originalNotificationPermissionDescriptor?.get;
            if (getter) return getter.call(Notification) as NotificationPermission;

            return originalNotificationPermissionDescriptor?.value as NotificationPermission ?? "default";
        },
    });
}

function isSafeWindowOpenUrl(urlLike: string | URL | undefined): boolean {
    if (!urlLike) return true;

    const url = getUrl(urlLike);
    if (!url) return false;
    if (url.origin === location.origin) return true;

    return SAFE_EXTERNAL_PROTOCOLS.has(url.protocol);
}

function patchWindowOpen(): void {
    if (originalWindowOpen) return;

    originalWindowOpen = window.open;

    window.open = function (url?: string | URL, target?: string, features?: string) {
        if (settings.store.blockUnsafeExternalProtocols && !isSafeWindowOpenUrl(url)) {
            if (settings.store.logBlockedRequests) logger.warn("Blocked unsafe external link.", url);
            return null;
        }

        return originalWindowOpen!.call(this, url, target, features);
    };
}

function getWebRtcConfiguration(configuration?: RTCConfiguration): RTCConfiguration | undefined {
    if (settings.store.webRtcIcePolicy !== "relay") return configuration;

    return {
        ...configuration,
        iceTransportPolicy: "relay",
    };
}

function createPatchedConnection(OriginalConnection: typeof RTCPeerConnection): typeof RTCPeerConnection {
    return class extends OriginalConnection {
        constructor(configuration?: RTCConfiguration) {
            super(getWebRtcConfiguration(configuration));
        }

        setConfiguration(configuration: RTCConfiguration): void {
            super.setConfiguration(getWebRtcConfiguration(configuration));
        }
    };
}

function patchWebRtc(): void {
    if (originalConnections.length) return;

    if (typeof RTCPeerConnection !== "undefined") {
        originalConnections.push({ name: "RTCPeerConnection", ctor: RTCPeerConnection });
        window.RTCPeerConnection = createPatchedConnection(RTCPeerConnection);
    }

    const win = window as Window & WebKitRTCWindow;
    if (typeof win.webkitRTCPeerConnection !== "undefined") {
        originalConnections.push({ name: "webkitRTCPeerConnection", ctor: win.webkitRTCPeerConnection });
        win.webkitRTCPeerConnection = createPatchedConnection(win.webkitRTCPeerConnection);
    }
}

function setHideNag(): void {
    if (!settings.store.hideDownloadNag) return;

    try {
        localStorage.setItem("hideNag", "true");
    } catch (error) {
        logger.warn("Could not hide Discord download prompts.", error);
    }
}

function restoreNetwork(): void {
    if (originalFetch) {
        window.fetch = originalFetch;
        originalFetch = null;
    }

    if (originalXhrOpen) {
        XMLHttpRequest.prototype.open = originalXhrOpen;
        originalXhrOpen = null;
    }

    if (originalXhrSend) {
        XMLHttpRequest.prototype.send = originalXhrSend;
        originalXhrSend = null;
    }

    if (originalSendBeacon) {
        navigator.sendBeacon = originalSendBeacon;
        originalSendBeacon = null;
    }
}

function restorePermissions(): void {
    const { mediaDevices } = navigator;

    if (mediaDevices && originalEnumerateDevices) {
        mediaDevices.enumerateDevices = originalEnumerateDevices;
        originalEnumerateDevices = null;
    }

    if (typeof Notification !== "undefined" && originalNotificationRequestPermission) {
        Notification.requestPermission = originalNotificationRequestPermission;
        originalNotificationRequestPermission = null;

        if (originalNotificationPermissionDescriptor) {
            Object.defineProperty(Notification, "permission", originalNotificationPermissionDescriptor);
        } else {
            Reflect.deleteProperty(Notification, "permission");
        }
    }
}

function restoreWindowOpen(): void {
    if (!originalWindowOpen) return;

    window.open = originalWindowOpen;
    originalWindowOpen = null;
}

function restoreWebRtc(): void {
    if (!originalConnections.length) return;

    const win = window as Window & WebKitRTCWindow;

    for (const { name, ctor } of originalConnections) {
        if (name === "webkitRTCPeerConnection") {
            win.webkitRTCPeerConnection = ctor;
        } else {
            window.RTCPeerConnection = ctor;
        }
    }

    originalConnections = [];
}

export default definePlugin({
    name: "WebCordHardened",
    description: "Adds WebCord privacy hardening with network, permission, and WebRTC protections.",
    tags: ["Privacy", "Utility", "Voice"],
    authors: [{ name: "irritably", id: 928787166916640838n }],
    settings,
    startAt: StartAt.Init,

    start() {
        patchFetch();
        patchXhr();
        patchBeacon();
        patchMediaDevices();
        patchNotifications();
        patchWindowOpen();
        patchWebRtc();
        setHideNag();
    },

    stop() {
        restoreNetwork();
        restorePermissions();
        restoreWindowOpen();
        restoreWebRtc();
    },
});
