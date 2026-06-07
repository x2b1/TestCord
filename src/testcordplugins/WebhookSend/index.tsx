/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { HeaderBarButton } from "@api/HeaderBar";
import { DataStore } from "@api/index";
import { TestcordDevs } from "@utils/constants";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalRoot, ModalSize, openModal, type RenderModalProps } from "@utils/modal";
import definePlugin from "@utils/types";
import { Alerts, Button, React, showToast, TextArea, TextInput, Toasts, useEffect, useState } from "@webpack/common";

const WEBHOOK_HISTORY_KEY = "WebhookSend_history";
const MAX_HISTORY = 10;

type AllowedMentions = {
    parse?: string[];
    roles?: string[];
    users?: string[];
    replied_user?: boolean;
};

type EmbedField = {
    name: string;
    value: string;
    inline?: boolean;
};

type EmbedAuthor = {
    name?: string;
    url?: string;
    icon_url?: string;
};

type EmbedFooter = {
    text: string;
    icon_url?: string;
};

type EmbedMedia = {
    url: string;
};

type Embed = {
    title?: string;
    description?: string;
    url?: string;
    timestamp?: string;
    color?: number;
    footer?: EmbedFooter;
    image?: EmbedMedia;
    thumbnail?: EmbedMedia;
    author?: EmbedAuthor;
    fields?: EmbedField[];
};

type WebhookPayload = {
    content?: string;
    username?: string;
    avatar_url?: string;
    tts?: boolean;
    embeds?: Embed[];
    allowed_mentions?: AllowedMentions;
    thread_name?: string;
};

type HistoryEntry = {
    url: string;
    addedAt: number;
};

function WebhookIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor" {...props}>
            <path d="M10.5 4a6.5 6.5 0 0 0-6.36 5.14 4.5 4.5 0 0 0 .36 8.99h2v-2h-2a2.5 2.5 0 1 1 .31-4.98l1.03-.13.11-1.04A4.5 4.5 0 0 1 14.9 9.5a3.5 3.5 0 1 1 .6 6.95H13v2h2.5a5.5 5.5 0 0 0 .74-10.95A6.5 6.5 0 0 0 10.5 4Zm.5 7 4 4h-3v5h-2v-5H7l4-4Z" />
        </svg>
    );
}

async function loadHistory() {
    return await DataStore.get(WEBHOOK_HISTORY_KEY) as HistoryEntry[] | null ?? [];
}

async function saveHistory(url: string) {
    const normalizedUrl = url.trim();
    const history = await loadHistory();
    const next = [{ url: normalizedUrl, addedAt: Date.now() }, ...history.filter(entry => entry.url !== normalizedUrl)]
        .slice(0, MAX_HISTORY);
    await DataStore.set(WEBHOOK_HISTORY_KEY, next);
    return next;
}

function parseJson<T>(value: string, label: string): T | undefined {
    const trimmed = value.trim();
    if (!trimmed) return;

    try {
        return JSON.parse(trimmed) as T;
    } catch {
        throw new Error(`${label} must be valid JSON.`);
    }
}

async function ensureWebhookPermission(url: string) {
    if (await VencordNative.csp.isDomainAllowed(url, ["connect-src"])) return true;

    return await new Promise<boolean>(resolve => {
        Alerts.show({
            title: "Allow webhook host",
            body: "WebhookSend needs permission to connect to this webhook host. After allowing it, restart the client so the new CSP rule takes effect.",
            async onCloseCallback() {
                const result = await VencordNative.csp.requestAddOverride(url, ["connect-src"], "WebhookSend");
                if (result === "ok") {
                    showToast("Allowed webhook host. Restart the client before sending.", Toasts.Type.SUCCESS);
                } else if (result !== "cancelled") {
                    showToast("Webhook host permission was not granted.", Toasts.Type.FAILURE);
                }
                resolve(false);
            }
        });
    });
}

function WebhookSendModal({ rootProps }: { rootProps: RenderModalProps; }) {
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [webhookUrl, setWebhookUrl] = useState("");
    const [content, setContent] = useState("");
    const [username, setUsername] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");
    const [threadId, setThreadId] = useState("");
    const [threadName, setThreadName] = useState("");
    const [embedsJson, setEmbedsJson] = useState("[]");
    const [allowedMentionsJson, setAllowedMentionsJson] = useState("");
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        loadHistory().then(setHistory).catch(() => { });
    }, []);

    async function onSend() {
        const trimmedUrl = webhookUrl.trim();
        if (!trimmedUrl) {
            showToast("Webhook URL is required.", Toasts.Type.FAILURE);
            return;
        }

        let parsedUrl: URL;
        try {
            parsedUrl = new URL(trimmedUrl);
        } catch {
            showToast("Webhook URL is invalid.", Toasts.Type.FAILURE);
            return;
        }

        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
            showToast("Webhook URL must use HTTP or HTTPS.", Toasts.Type.FAILURE);
            return;
        }

        if (!parsedUrl.pathname.includes("/api/webhooks/")) {
            showToast("This does not look like a Discord webhook URL.", Toasts.Type.FAILURE);
            return;
        }

        const embeds = parseJson<Embed[]>(embedsJson, "Embeds");
        const allowedMentions = parseJson<AllowedMentions>(allowedMentionsJson, "Allowed mentions");

        if (!content.trim() && !embeds?.length) {
            showToast("Add content or at least one embed.", Toasts.Type.FAILURE);
            return;
        }

        if (!await ensureWebhookPermission(trimmedUrl)) return;

        const payload: WebhookPayload = {};
        if (content.trim()) payload.content = content;
        if (username.trim()) payload.username = username.trim();
        if (avatarUrl.trim()) payload.avatar_url = avatarUrl.trim();
        if (embeds?.length) payload.embeds = embeds;
        if (allowedMentions) payload.allowed_mentions = allowedMentions;
        if (threadName.trim()) payload.thread_name = threadName.trim();

        if (threadId.trim()) {
            parsedUrl.searchParams.set("thread_id", threadId.trim());
        }
        parsedUrl.searchParams.set("wait", "true");

        setIsSending(true);
        try {
            const response = await fetch(parsedUrl.toString(), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => "");
                throw new Error(errorText || `Webhook request failed with ${response.status}.`);
            }

            setHistory(await saveHistory(trimmedUrl));
            showToast("Webhook sent.", Toasts.Type.SUCCESS);
            rootProps.onClose();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown webhook error.";
            showToast(message, Toasts.Type.FAILURE);
        } finally {
            setIsSending(false);
        }
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.LARGE}>
            <ModalHeader>
                <div style={{ flex: 1, fontWeight: 700 }}>Send Webhook</div>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>

            <ModalContent>
                {history.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>Saved webhooks</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {history.map(entry => (
                                <Button
                                    key={entry.url}
                                    size={Button.Sizes.SMALL}
                                    onClick={() => setWebhookUrl(entry.url)}
                                >
                                    {new URL(entry.url).host}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}

                <div style={{ display: "grid", gap: 12 }}>
                    <TextInput value={webhookUrl} placeholder="Webhook URL" onChange={setWebhookUrl} />
                    <TextInput value={username} placeholder="Username override" onChange={setUsername} />
                    <TextInput value={avatarUrl} placeholder="Avatar URL override" onChange={setAvatarUrl} />
                    <TextInput value={threadId} placeholder="Thread ID" onChange={setThreadId} />
                    <TextInput value={threadName} placeholder="Thread name for forum webhooks" onChange={setThreadName} />
                    <TextArea value={content} placeholder="Message content" rows={5} onChange={setContent} />
                    <TextArea value={embedsJson} placeholder="Embeds JSON" rows={10} onChange={setEmbedsJson} />
                    <TextArea value={allowedMentionsJson} placeholder="Allowed mentions JSON" rows={5} onChange={setAllowedMentionsJson} />
                </div>
            </ModalContent>

            <ModalFooter>
                <Button color={Button.Colors.PRIMARY} disabled={isSending} onClick={onSend}>
                    {isSending ? "Sending..." : "Send webhook"}
                </Button>
                <Button color={Button.Colors.TRANSPARENT} look={Button.Looks.LINK} onClick={rootProps.onClose}>
                    Cancel
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
}

function WebhookSendButton() {
    return (
        <HeaderBarButton
            icon={WebhookIcon}
            tooltip="Send Webhook"
            onClick={() => openModal(props => <WebhookSendModal rootProps={props} />)}
        />
    );
}

export default definePlugin({
    name: "WebhookSend",
    description: "Send Discord webhooks from a top bar modal with saved webhook history.",
    authors: [TestcordDevs.x2b, TestcordDevs.nerdful],
    dependencies: ["HeaderBarAPI"],

    headerBarButton: {
        icon: WebhookIcon,
        render: WebhookSendButton,
        priority: 100,
    },
});
