/*
 * Equicord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { definePluginSettings } from "@api/Settings";
import { addContextMenuPatch, NavContextMenuPatchCallback, removeContextMenuPatch } from "@api/ContextMenu";
import { ModalCloseButton, ModalContent, ModalHeader, ModalRoot, openModal } from "@utils/modal";
import { FormSwitch } from "@components/FormSwitch";
import definePlugin, { OptionType } from "@utils/types";
import { React, useState, useRef, useMemo, GuildStore, RestAPI, UserStore, Toasts, Select, Button, Menu } from "@webpack/common";
import { findStoreLazy } from "@webpack";
import { Forms } from "@webpack/common";
const F = Forms as any;

const PermissionStore = findStoreLazy("PermissionStore");

const ADMIN_BIT = 0x8n;

function getToken(): string {
    try {
        const mod = (window as any).Vencord?.Webpack?.findByProps?.("getToken");
        return mod?.getToken?.() ?? "";
    } catch { return ""; }
}

function hasAdmin(guildId: string): boolean {
    try {
        const guild = GuildStore.getGuild(guildId);
        if (!guild) return false;
        const me = UserStore.getCurrentUser();
        if (guild.ownerId === me.id) return true;
        const perms = PermissionStore.getGuildPermissions({ id: guildId });
        if (typeof perms === "bigint") return (perms & ADMIN_BIT) === ADMIN_BIT;
        return false;
    } catch {
        return false;
    }
}

async function apiCall(method: "get" | "post" | "patch" | "put" | "del", url: string, body?: any): Promise<any> {
    const opts: any = { url };
    if (body) opts.body = body;
    const res = await (RestAPI as any)[method](opts);
    if (!res.ok) {
        const msg = res.body?.message || res.text || `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return res?.body;
}

async function wait(ms: number) { return new Promise(r => setTimeout(r, ms)); }

interface CloneOptions {
    roles: boolean;
    clearRoles: boolean;
    channels: boolean;
    noDeleteChannels: boolean;
    permissions: boolean;
    icon: boolean;
    emojis: boolean;
    embeds: boolean;
    guildSettings: boolean;
}

interface LogEntry { text: string; type: "ok" | "err" | "warn" | "info"; }

// ── Persistent state (survives component unmount/remount) ────────────────
let _running = false;
let _cancelled = false;
let _progress = 0;
let _logs: LogEntry[] = [];
const _listeners = new Set<() => void>();

function notifyListeners() { _listeners.forEach(fn => fn()); }

function persistLog(entry: LogEntry) {
    _logs = [..._logs, entry];
    notifyListeners();
}
function persistProgress(p: number) {
    _progress = p;
    notifyListeners();
}
function persistRunning(v: boolean) {
    _running = v;
    notifyListeners();
}
function cancelClone() {
    _cancelled = true;
}

// ── Clone Engine ─────────────────────────────────────────────────────────

async function cloneServer(
    sourceId: string,
    targetId: string,
    options: CloneOptions,
    log: (entry: LogEntry) => void,
    setProgress: (p: number) => void,
) {
    _cancelled = false;
    const token = getToken();
    if (!token) { log({ text: "Token not found!", type: "err" }); return; }

    const steps: string[] = [];
    if (options.guildSettings) steps.push("settings");
    if (options.icon) steps.push("icon");
    if (options.roles) steps.push("roles");
    if (options.channels) steps.push("channels");
    if (options.emojis) steps.push("emojis");
    if (options.embeds) steps.push("embeds");
    const totalSteps = steps.length;
    let currentStep = 0;

    function advance(stepName: string) {
        currentStep++;
        setProgress(Math.round((currentStep / totalSteps) * 100));
        log({ text: `── ${stepName} finished (${currentStep}/${totalSteps})`, type: "info" });
    }

    function isCancelled() {
        if (_cancelled) {
            log({ text: "═══ Cloning cancelled! ═══", type: "warn" });
            return true;
        }
        return false;
    }

    const sourceGuild = GuildStore.getGuild(sourceId);
    if (!sourceGuild) { log({ text: "Source server not found", type: "err" }); return; }

    log({ text: `Cloning of "${sourceGuild.name}" → target server...`, type: "info" });

    // ── Guild Settings ──────────────────────────────────────────────
    if (options.guildSettings && !isCancelled()) {
        try {
            log({ text: "Copying server settings...", type: "info" });
            const patch: any = {};
            if (sourceGuild.name) patch.name = sourceGuild.name;
            if (sourceGuild.description) patch.description = sourceGuild.description;
            if (sourceGuild.verificationLevel != null) patch.verification_level = sourceGuild.verificationLevel;
            if (sourceGuild.defaultMessageNotifications != null) patch.default_message_notifications = sourceGuild.defaultMessageNotifications;
            if (sourceGuild.explicitContentFilter != null) patch.explicit_content_filter = sourceGuild.explicitContentFilter;
            if (sourceGuild.afkTimeout != null) patch.afk_timeout = sourceGuild.afkTimeout;

            if (Object.keys(patch).length) {
                await apiCall("patch", `/guilds/${targetId}`, patch);
                log({ text: "Settings copied (name, description, etc.)", type: "ok" });
            }
        } catch (e: any) {
            log({ text: `Settings error: ${e?.message || e}`, type: "err" });
        }
        await wait(500);
        advance("Settings");
    }

    // ── Icon ────────────────────────────────────────────────────────
    if (options.icon && sourceGuild.icon && !isCancelled()) {
        try {
            log({ text: "Copying server icon...", type: "info" });
            const iconUrl = `https://cdn.discordapp.com/icons/${sourceId}/${sourceGuild.icon}.png?size=512`;
            const resp = await fetch(iconUrl);
            const blob = await resp.blob();
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
            await apiCall("patch", `/guilds/${targetId}`, { icon: base64 });
            log({ text: "Icon copied", type: "ok" });
        } catch (e: any) {
            log({ text: `Icon error: ${e?.message || e}`, type: "err" });
        }
        await wait(500);
        advance("Icon");
    } else if (options.icon) {
        advance("Icon");
    }

    // ── Roles ───────────────────────────────────────────────────────
    const roleMapping = new Map<string, string>();
    if (options.roles && !isCancelled()) {
        try {
            log({ text: "Copying roles...", type: "info" });
            const sourceRoles: any[] = await apiCall("get", `/guilds/${sourceId}/roles`);
            const targetRoles: any[] = await apiCall("get", `/guilds/${targetId}/roles`);

            // Optional: Clear existing roles in target server
            if (options.clearRoles) {
                log({ text: "Cleaning up existing roles in target server...", type: "warn" });
                for (const role of targetRoles) {
                    if (role.name === "@everyone" || role.managed) continue;
                    try {
                        await apiCall("del", `/guilds/${targetId}/roles/${role.id}`);
                        await wait(300);
                    } catch { /* ignore roles we can't delete */ }
                }
                log({ text: "Existing roles cleaned up", type: "ok" });
            }

            const sorted = sourceRoles.filter(r => r.name !== "@everyone").sort((a, b) => b.position - a.position);

            const everyoneSource = sourceRoles.find(r => r.name === "@everyone");
            const updatedTargetRoles: any[] = await apiCall("get", `/guilds/${targetId}/roles`);
            const everyoneTarget = updatedTargetRoles.find(r => r.name === "@everyone");
            if (everyoneSource && everyoneTarget) {
                roleMapping.set(everyoneSource.id, everyoneTarget.id);
                if (options.permissions) {
                    try {
                        await apiCall("patch", `/guilds/${targetId}/roles/${everyoneTarget.id}`, {
                            permissions: String(everyoneSource.permissions),
                        });
                    } catch { /* ignore */ }
                }
            }

            const positions: Array<{ id: string; position: number; }> = [];
            for (const role of sorted) {
                try {
                    const body: any = {
                        name: role.name, color: role.color,
                        hoist: role.hoist, mentionable: role.mentionable,
                    };
                    if (options.permissions && role.permissions != null) body.permissions = String(role.permissions);
                    const created = await apiCall("post", `/guilds/${targetId}/roles`, body);
                    roleMapping.set(role.id, created.id);
                    positions.push({ id: created.id, position: role.position });
                    log({ text: `  Role created: ${role.name}`, type: "ok" });
                    await wait(300);
                } catch (e: any) {
                    log({ text: `  Role error "${role.name}": ${e?.message || e}`, type: "err" });
                }
            }
            if (positions.length) {
                try {
                    await apiCall("patch", `/guilds/${targetId}/roles`, positions);
                    log({ text: `  Role positions reordered automatically`, type: "info" });
                } catch (e: any) {
                    log({ text: `  Failed to patch positions: ${e?.message || e}`, type: "warn" });
                }
            }
            log({ text: `${sorted.length} roles processed`, type: "ok" });
        } catch (e: any) {
            log({ text: `Roles error: ${e?.message || e}`, type: "err" });
        }
        await wait(500);
        advance("Roles");
    }

    // ── Channels ────────────────────────────────────────────────────
    const channelMapping = new Map<string, string>();
    if (options.channels && !isCancelled()) {
        try {
            log({ text: "Copying channels...", type: "info" });
            const sourceChannels: any[] = await apiCall("get", `/guilds/${sourceId}/channels`);
            const categories = sourceChannels.filter(c => c.type === 4).sort((a, b) => a.position - b.position);
            const nonCategories = sourceChannels.filter(c => c.type !== 4).sort((a, b) => a.position - b.position);

            if (!options.noDeleteChannels) {
                try {
                    const targetChannels: any[] = await apiCall("get", `/guilds/${targetId}/channels`);
                    for (const ch of targetChannels) {
                        try { await apiCall("del", `/channels/${ch.id}`); await wait(300); } catch { /* ignore */ }
                    }
                    log({ text: "Existing channels deleted", type: "warn" });
                } catch { /* ignore */ }
            }

            for (const cat of categories) {
                if (_cancelled) break;
                try {
                    const body: any = { name: cat.name, type: 4, position: cat.position };
                    if (options.permissions && cat.permission_overwrites?.length)
                        body.permission_overwrites = mapPermOverwrites(cat.permission_overwrites, roleMapping);
                    const created = await apiCall("post", `/guilds/${targetId}/channels`, body);
                    channelMapping.set(cat.id, created.id);
                    log({ text: `  Category created: ${cat.name}`, type: "ok" });
                    await wait(500);
                } catch (e: any) {
                    log({ text: `  Category error "${cat.name}": ${e?.message || JSON.stringify(e)}`, type: "err" });
                }
            }

            for (const ch of nonCategories) {
                if (_cancelled) break;
                try {
                    const body: any = {
                        name: ch.name, type: ch.type, position: ch.position,
                        topic: ch.topic ?? undefined, nsfw: ch.nsfw ?? false,
                        bitrate: ch.bitrate ?? undefined, user_limit: ch.user_limit ?? undefined,
                        rate_limit_per_user: ch.rate_limit_per_user ?? undefined,
                    };
                    if (ch.parent_id && channelMapping.has(ch.parent_id))
                        body.parent_id = channelMapping.get(ch.parent_id);
                    if (options.permissions && ch.permission_overwrites?.length)
                        body.permission_overwrites = mapPermOverwrites(ch.permission_overwrites, roleMapping);
                    const created = await apiCall("post", `/guilds/${targetId}/channels`, body);
                    channelMapping.set(ch.id, created.id);
                    log({ text: `  Channel created: #${ch.name} (type ${ch.type})`, type: "ok" });
                    await wait(500);
                } catch (e: any) {
                    log({ text: `  Channel error "${ch.name}": ${e?.message || JSON.stringify(e)}`, type: "err" });
                }
            }
            log({ text: `${categories.length + nonCategories.length} channels processed`, type: "ok" });
        } catch (e: any) {
            log({ text: `Channels error: ${e?.message || e}`, type: "err" });
        }
        await wait(500);
        advance("Channels");
    }

    // ── Emojis ──────────────────────────────────────────────────────
    if (options.emojis && !isCancelled()) {
        try {
            log({ text: "Copying emojis...", type: "info" });
            const sourceEmojis: any[] = await apiCall("get", `/guilds/${sourceId}/emojis`);
            let count = 0;
            for (const emoji of sourceEmojis) {
                if (_cancelled) break;
                try {
                    const ext = emoji.animated ? "gif" : "png";
                    const emojiUrl = `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}?size=128`;
                    const resp = await fetch(emojiUrl);
                    const blob = await resp.blob();
                    const base64 = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });
                    await apiCall("post", `/guilds/${targetId}/emojis`, { name: emoji.name, image: base64, roles: [] });
                    count++;
                    log({ text: `  Emoji copied: ${emoji.name} (${count}/${sourceEmojis.length})`, type: "ok" });
                    await wait(3000);
                } catch (e: any) {
                    log({ text: `  Emoji error "${emoji.name}": ${e?.message || e}`, type: "err" });
                }
            }
            log({ text: `${count}/${sourceEmojis.length} emojis copied`, type: "ok" });
        } catch (e: any) {
            log({ text: `Emojis error: ${e?.message || e}`, type: "err" });
        }
        await wait(500);
        advance("Emojis");
    }

    // ── Embeds ──────────────────────────────────────────────────────
    if (options.embeds && options.channels && !isCancelled()) {
        try {
            log({ text: "Copying bot embeds...", type: "info" });
            let embedCount = 0;
            for (const [sourceChId, targetChId] of channelMapping.entries()) {
                if (_cancelled) break;
                
                // Skip categories (they don't have messages)
                const sourceCh = sourceChannels.find(c => c.id === sourceChId);
                if (sourceCh?.type === 4) continue;

                try {
                    const messages: any[] = await apiCall("get", `/channels/${sourceChId}/messages?limit=100`);
                    if (!messages?.length) continue;
                    const botEmbedMsgs = messages.filter(m => m.author?.bot && m.embeds?.length > 0);
                    if (!botEmbedMsgs.length) continue;

                    log({ text: `  Channel ${sourceChId}: ${botEmbedMsgs.length} messages with embeds`, type: "info" });

                    let webhook: any;
                    try {
                        webhook = await apiCall("post", `/channels/${targetChId}/webhooks`, {
                            name: "ServerCloner",
                            enabledByDefault: true
                        });
                    } catch (e: any) {
                        log({ text: `  Webhook creation error for channel ${targetChId}: ${e?.message || e}`, type: "err" });
                        continue;
                    }

                    for (const msg of botEmbedMsgs) {
                        if (_cancelled) break;
                        try {
                            const cleanEmbeds = msg.embeds
                                .filter((e: any) => e.type === "rich" || e.title || e.description || e.fields?.length)
                                .map((e: any) => {
                                    const embed: any = {};
                                    if (e.title) embed.title = e.title;
                                    if (e.description) embed.description = e.description;
                                    if (e.url) embed.url = e.url;
                                    if (e.color != null) embed.color = e.color;
                                    if (e.timestamp) embed.timestamp = e.timestamp;
                                    if (e.footer?.text) embed.footer = { text: e.footer.text, icon_url: e.footer.icon_url };
                                    if (e.author?.name) embed.author = { name: e.author.name, url: e.author.url, icon_url: e.author.icon_url };
                                    if (e.thumbnail?.url) embed.thumbnail = { url: e.thumbnail.url };
                                    if (e.image?.url) embed.image = { url: e.image.url };
                                    if (e.fields?.length) embed.fields = e.fields.map((f: any) => ({
                                        name: f.name || "\u200b", value: f.value || "\u200b", inline: f.inline ?? false,
                                    }));
                                    return embed;
                                });

                            if (!cleanEmbeds.length) continue;

                            const webhookBody: any = {
                                username: msg.author.username,
                                embeds: cleanEmbeds,
                            };
                            if (msg.author.avatar) {
                                webhookBody.avatar_url = `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png`;
                            }
                            if (msg.content) webhookBody.content = msg.content;

                            const resp = await fetch(`https://discord.com/api/v9/webhooks/${webhook.id}/${webhook.token}?wait=true`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(webhookBody),
                            });
                            if (resp.ok) {
                                embedCount++;
                            } else {
                                const errText = await resp.text().catch(() => "?");
                                log({ text: `  Webhook error (${resp.status}): ${errText.slice(0, 200)}`, type: "err" });
                            }
                            await wait(800);
                        } catch (e: any) {
                            log({ text: `  Embed send error: ${e?.message || e}`, type: "err" });
                        }
                    }
                    try { await apiCall("del", `/webhooks/${webhook.id}`); } catch { /* ignore */ }
                    await wait(300);
                } catch (e: any) {
                    log({ text: `  Channel read error ${sourceChId}: ${e?.message || JSON.stringify(e)}`, type: "err" });
                }
            }
            log({ text: `${embedCount} embed messages copied`, type: "ok" });
        } catch (e: any) {
            log({ text: `Embeds error: ${e?.message || e}`, type: "err" });
        }
        advance("Embeds");
    } else if (options.embeds) {
        log({ text: "Embeds skipped (requires channel copy)", type: "warn" });
        advance("Embeds");
    }

    setProgress(100);
    if (_cancelled) {
        log({ text: "═══ Cloning cancelled! ═══", type: "warn" });
        Toasts.show({ message: "Cloning cancelled.", type: Toasts.Type.FAILURE, id: Toasts.genId() });
    } else {
        log({ text: "═══ Cloning finished! ═══", type: "info" });
        Toasts.show({ message: "Server cloning finished!", type: Toasts.Type.SUCCESS, id: Toasts.genId() });
    }
}

function mapPermOverwrites(overwrites: any[], roleMapping: Map<string, string>): any[] {
    return overwrites
        .filter(ow => roleMapping.has(ow.id))
        .map(ow => ({
            id: roleMapping.get(ow.id)!,
            type: ow.type,
            allow: String(ow.allow),
            deny: String(ow.deny),
        }));
}

// ── Settings Component (inline, no modal) ───────────────────────────────

function ServerClonerUI({ initialSourceId = "" }: { initialSourceId?: string }) {
    const [sourceId, setSourceId] = useState<string>(initialSourceId);
    const [targetId, setTargetId] = useState<string>("");
    const [opts, setOpts] = useState<CloneOptions>({
        roles: true, clearRoles: true, channels: true, noDeleteChannels: false, permissions: true,
        icon: true, emojis: true, embeds: true, guildSettings: true,
    });
    const [, forceUpdate] = useState(0);
    const logRef = useRef<HTMLDivElement>(null);

    // Subscribe to persistent state changes
    React.useEffect(() => {
        const listener = () => forceUpdate(n => n + 1);
        _listeners.add(listener);
        return () => { _listeners.delete(listener); };
    }, []);

    // Auto-scroll logs
    React.useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [_logs.length]);

    const allGuilds = useMemo(() =>
        Object.values(GuildStore.getGuilds() as Record<string, any>)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(g => ({ label: g.name, value: g.id })),
        []);

    const adminGuilds = useMemo(() =>
        allGuilds.filter(g => hasAdmin(g.value)),
        [allGuilds]);

    async function startClone() {
        if (!sourceId || !targetId || _running) return;
        if (sourceId === targetId) { persistLog({ text: "Source and destination cannot be identical!", type: "err" }); return; }
        persistRunning(true);
        _progress = 0;
        _logs = [];
        notifyListeners();
        try {
            await cloneServer(sourceId, targetId, opts, persistLog, persistProgress);
        } catch (e: any) {
            persistLog({ text: `Fatal error: ${e?.message || e}`, type: "err" });
        }
        persistRunning(false);
    }

    function stopClone() {
        cancelClone();
        persistLog({ text: "Cancellation requested...", type: "warn" });
    }

    const SWITCH_OPTS: Array<{ key: keyof CloneOptions; label: string; }> = [
        { key: "guildSettings", label: "Server settings" },
        { key: "icon", label: "Icon" },
        { key: "roles", label: "Roles" },
        { key: "clearRoles", label: "Delete existing roles" },
        { key: "channels", label: "Channels" },
        { key: "noDeleteChannels", label: "Do not delete existing channels" },
        { key: "permissions", label: "Permissions" },
        { key: "emojis", label: "Emojis" },
        { key: "embeds", label: "Bot embeds" },
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Source */}
            <F.FormSection>
                <F.FormTitle>Source server</F.FormTitle>
                <Select
                    options={allGuilds}
                    placeholder="Choose a server..."
                    isSelected={v => v === sourceId}
                    select={v => setSourceId(v)}
                    serialize={v => v}
                />
            </F.FormSection>

            {/* Target */}
            <F.FormSection>
                <F.FormTitle>Target server (ADMIN required)</F.FormTitle>
                {adminGuilds.length === 0 ? (
                    <F.FormText style={{ color: "var(--text-danger)" }}>
                        No server with ADMIN permission found.
                    </F.FormText>
                ) : (
                    <Select
                        options={adminGuilds}
                        placeholder="Choose a server..."
                        isSelected={v => v === targetId}
                        select={v => setTargetId(v)}
                        serialize={v => v}
                    />
                )}
            </F.FormSection>

            <F.FormDivider />

            {/* Options */}
            <F.FormSection>
                <F.FormTitle>Cloning options</F.FormTitle>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
                    {SWITCH_OPTS.map(o => (
                        <FormSwitch
                            key={o.key}
                            title={o.label}
                            value={opts[o.key]}
                            onChange={v => setOpts(prev => ({ ...prev, [o.key]: v }))}
                            disabled={_running}
                            hideBorder
                        />
                    ))}
                </div>
            </F.FormSection>

            <F.FormDivider />

            {/* Start / Stop buttons */}
            <div style={{ display: "flex", gap: 8 }}>
                <Button
                    size={Button.Sizes.MEDIUM}
                    color={_running ? Button.Colors.PRIMARY : Button.Colors.BRAND}
                    disabled={!sourceId || !targetId || _running}
                    onClick={startClone}
                    style={{ flex: 1 }}
                >
                    {_running ? "Cloning in progress..." : "Start cloning"}
                </Button>
                {_running && (
                    <Button
                        size={Button.Sizes.MEDIUM}
                        color={Button.Colors.RED}
                        onClick={stopClone}
                        style={{ minWidth: 120 }}
                    >
                        Stop
                    </Button>
                )}
            </div>

            {/* Progress */}
            {_running && (
                <div className="sc-progress-bar">
                    <div className="sc-progress-fill" style={{ width: `${_progress}%` }} />
                </div>
            )}

            {/* Logs */}
            {_logs.length > 0 && (
                <div className="sc-log-area" ref={logRef}>
                    {_logs.map((l, i) => (
                        <div key={i} className={`sc-log-${l.type}`}>{l.text}</div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Modal & Context Menu ────────────────────────────────────────────────

function ServerClonerModal({ rootProps, guildId }: { rootProps: any; guildId: string }) {
    return (
        <ModalRoot {...rootProps} size="large">
            <ModalHeader separator={false}>
                <F.FormTitle tag="h4" style={{ margin: 0 }}>Server Cloner</F.FormTitle>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent style={{ paddingBottom: 24 }}>
                <ServerClonerUI initialSourceId={guildId} />
            </ModalContent>
        </ModalRoot>
    );
}

const patchGuildContext: NavContextMenuPatchCallback = (children, { guild }) => {
    if (!children || !Array.isArray(children)) return;
    try {
        if (!guild) return;

        children.push(
            <Menu.MenuItem
                id="server-cloner"
                key="server-cloner"
                label="ServerCloner"
                action={() => openModal(props => <ServerClonerModal rootProps={props} guildId={guild.id} />)}
            />
        );
    } catch (e) {
        console.error("[ServerCloner] Context menu patch error:", e);
    }
};

// ── Plugin ───────────────────────────────────────────────────────────────

const settings = definePluginSettings({
    cloner: {
        type: OptionType.COMPONENT,
        description: "",
        component: ServerClonerUI,
    },
});

export default definePlugin({
    name: "ServerCloner",
    enabledByDefault: true,
    description: "Clone an entire server (channels, roles, permissions, icon, emojis, embeds) to a server where you have ADMIN permission. Can be opened from server context menu.",
    authors: [{ name: "Nightcord", id: 0n }],
    settings,
    start() {
        addContextMenuPatch("guild-context", patchGuildContext);
    },
    stop() {
        removeContextMenuPatch("guild-context", patchGuildContext);
    }
});
