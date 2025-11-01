/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Message } from "@vencord/discord-types";
import { ChannelStore, Constants, ContextMenuApi, Menu, React, RestAPI, Toasts } from "@webpack/common";
import { ChatBarButton } from "@api/ChatButtons";

const settings = definePluginSettings({
    includeImages: { type: OptionType.BOOLEAN, default: true, description: "Include image attachments" },
});

async function fetchAllMessages(channelId: string): Promise<Message[]> {
    const result: Message[] = [] as any;
    let before: string | undefined = undefined;

    while (true) {
        const res = await RestAPI.get({
            url: Constants.Endpoints.MESSAGES(channelId),
            query: { limit: 100, ...(before ? { before } : {}) },
            retries: 2
        }).catch(() => null as any);

        const batch = res?.body ?? [];
        if (!batch.length) break;
        result.push(...batch);
        before = batch[batch.length - 1].id;
        if (batch.length < 100) break;
    }

    return result.reverse();
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function renderHtml(channelId: string, messages: Message[]): string {
    const channel = ChannelStore.getChannel(channelId);
    const title = channel?.name || "DM Export";
    const rows = messages.map((m: any) => {
        const time = new Date(m.timestamp).toLocaleString();
        const author = (m.author?.globalName || m.author?.username || "");
        const content = escapeHtml(m.content || "");
        const attachments = (settings.store.includeImages ? (m.attachments || []) : [])
            .map((a: any) => `<div class="att"><a href="${a.url}" target="_blank">${escapeHtml(a.filename || a.url)}</a>${a.content_type?.startsWith("image/") ? `<br/><img src="${a.url}" style="max-width:480px;max-height:360px"/>` : ""}</div>`)?.join("") || "";
        return `<article class="msg">
  <header class="meta">
    <span class="author">${escapeHtml(author)}</span>
    <time class="time" datetime="${escapeHtml(new Date(m.timestamp).toISOString())}">${escapeHtml(time)}</time>
  </header>
  <div class="body">${content}${attachments}</div>
</article>`;
    }).join("");

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · Chat Export</title>
  <style>
    :root{
      --bg-primary:#0f1115;
      --bg-elevated:#161a21;
      --text-primary:#e6e8eb;
      --text-muted:#a5acb8;
      --accent:#5865f2;
      --border:rgba(255,255,255,0.06);
    }
    @media (prefers-color-scheme: light){
      :root{ --bg-primary:#f6f7f9; --bg-elevated:#ffffff; --text-primary:#0b0d12; --text-muted:#4b5563; --border:rgba(0,0,0,0.08); }
    }
    html,body{ height:100%; }
    body{
      margin:0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height:1.5;
    }
    .container{ max-width: 980px; margin: 0 auto; padding: 24px; }
    header.page{
      display:flex; align-items:center; gap:12px; margin-bottom:16px; border-bottom:1px solid var(--border); padding-bottom:12px;
    }
    header.page h1{ font-size: 20px; margin: 0; }
    header.page .badge{ padding:2px 8px; border-radius:999px; font-size:12px; color: var(--text-muted); background: var(--bg-elevated); border:1px solid var(--border); }
    .messages{ display:flex; flex-direction:column; gap: 8px; background: var(--bg-elevated); border:1px solid var(--border); border-radius:12px; padding: 8px; }
    .msg{ padding: 10px 12px; border-radius:10px; }
    .msg:nth-child(odd){ background: color-mix(in oklab, var(--bg-primary) 80%, black); }
    .meta{ display:flex; align-items: baseline; gap: 8px; color: var(--text-muted); margin-bottom: 4px; }
    .author{ font-weight: 600; color: var(--text-primary); }
    .time{ font-size: .82rem; }
    .body{ white-space: pre-wrap; overflow-wrap: anywhere; }
    .att{ margin-top:6px; }
    .att a{ color: var(--accent); text-decoration: none; }
    .att a:hover{ text-decoration: underline; }
    img{ border-radius: 8px; max-width: 100%; height: auto; box-shadow: 0 1px 2px rgba(0,0,0,.15); }
    footer.page{ margin-top: 20px; color: var(--text-muted); font-size: 12px; text-align:center; }
  </style>
</head>
<body>
  <div class="container">
    <header class="page">
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 16l-4-4h3V4h2v8h3l-4 4Zm-8 2h16v2H4v-2Z"/></svg>
      <h1>${escapeHtml(title)}</h1>
      <span class="badge">${escapeHtml(new Date().toLocaleString())}</span>
    </header>
    <section class="messages">
      ${rows}
    </section>
    <footer class="page">Generated by Exporter</footer>
  </div>
</body>
</html>`;
}

async function exportChannel(channelId: string) {
    Toasts.show({ id: Toasts.genId(), type: Toasts.Type.MESSAGE, message: "Exporting..." });
    const messages = await fetchAllMessages(channelId);
    const html = renderHtml(channelId, messages as any);

    const filename = `export-${channelId}-${new Date().toISOString().split("T")[0]}.html`;
    if ((window as any).IS_DISCORD_DESKTOP) {
        const data = new TextEncoder().encode(html);
        const saved = await (window as any).DiscordNative.fileManager.saveWithDialog(data, filename, "text/html");
        if (saved) Toasts.show({ id: Toasts.genId(), type: Toasts.Type.SUCCESS, message: "Export saved." });
        else Toasts.show({ id: Toasts.genId(), type: Toasts.Type.FAILURE, message: "Export canceled." });
    } else {
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        Toasts.show({ id: Toasts.genId(), type: Toasts.Type.SUCCESS, message: "Export downloaded." });
    }
}

export default definePlugin({
    name: "Exporter",
    description: "Right-click DM/Group -> Export full chat as HTML with unlimited pagination.",
    authors: [Devs.feelslove],
    settings,
    renderChatBarButton: ({ channel, isMainChat }) => {
        if (!isMainChat || !channel?.id) return null;
        return (
            <ChatBarButton
                tooltip="Exporter"
                onClick={() => exportChannel(channel.id)}
                onContextMenu={e =>
                    ContextMenuApi.openContextMenu(e, () => (
                        <Menu.Menu navId="pc-exporter-menu" onClose={ContextMenuApi.closeContextMenu} aria-label="Exporter">
                            <Menu.MenuCheckboxItem
                                id="pc-exporter-include-images"
                                label="Include images"
                                checked={settings.store.includeImages}
                                action={() => settings.store.includeImages = !settings.store.includeImages}
                            />
                            <Menu.MenuSeparator />
                            <Menu.MenuItem id="pc-exporter-run" label="Export chat" action={() => exportChannel(channel.id)} />
                        </Menu.Menu>
                    ))
                }
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M12 16l-4-4h3V4h2v8h3l-4 4Zm-8 2h16v2H4v-2Z" />
                </svg>
            </ChatBarButton>
        );
    }
});
