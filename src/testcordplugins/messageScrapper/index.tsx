/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { showItemInFolder } from "@utils/native";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { Message } from "@vencord/discord-types";
import { Button, ChannelStore, Constants, ContextMenuApi, GuildChannelStore, GuildStore, Menu, MessageActions, React, RelationshipStore, RestAPI, Toasts, UserStore } from "@webpack/common";
import { ChatBarButton } from "@api/ChatButtons";

type DeletedLogItem = {
    channelId: string;
    guildId?: string | null;
    dmRecipientId?: string | null;
    isGuild: boolean;
    messageId: string;
    timestamp: string;
    content: string;
    attachments?: Array<{ filename?: string; url: string; content_type?: string; }>
};

const settings = definePluginSettings({
    whitelist: {
        type: OptionType.STRING,
        description: "Comma-separated user IDs to keep (whitelist)",
        default: ""
    },
    includeGuilds: {
        type: OptionType.BOOLEAN,
        description: "Also delete your messages in servers",
        default: true
    },
    includeGroupDMs: {
        type: OptionType.BOOLEAN,
        description: "Also delete messages in Group DMs (non-whitelisted participants)",
        default: false
    },
    selectedGuilds: {
        type: OptionType.STRING,
        description: "Comma-separated guild IDs to process",
        default: ""
    },
    selectedChannels: {
        type: OptionType.STRING,
        description: "Comma-separated channel IDs to whitelist (keep messages)",
        default: ""
    },
    lastLogFilePath: {
        type: OptionType.STRING,
        description: "Path of last deletion log (desktop only)",
        default: ""
    },
    logActions: {
        type: OptionType.COMPONENT,
        component: function LogActions() {
            const { lastLogFilePath } = settings.use(["lastLogFilePath"]);
            return (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Button
                        disabled={!lastLogFilePath}
                        onClick={() => lastLogFilePath && showItemInFolder(lastLogFilePath)}
                    >Open last log location</Button>
                    {!lastLogFilePath && <span style={{ opacity: .7 }}>No log saved yet</span>}
                </div>
            );
        }
    }
});

function parseCsv(csv: string): string[] {
    return csv
        .split(/[\s,]+/)
        .map(s => s.trim())
        .filter(Boolean);
}

function uniq(arr: string[]): string[] {
    return Array.from(new Set(arr));
}

function getWhitelist(): string[] {
    return uniq(parseCsv(settings.store.whitelist));
}

function setWhitelist(ids: string[]) {
    settings.store.whitelist = ids.join(",");
}

async function wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAllMessages(channelId: string, throttleMs = 250): Promise<Message[]> {
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
        // be gentle to avoid rate limits
        await wait(throttleMs);
    }

    return result.reverse();
}

function FriendTag({ id, onRemove }: { id: string; onRemove: (id: string) => void; }) {
    const user = UserStore.getUser(id);
    if (!user) return null as any;
    return (
        <div style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: 8, 
            padding: "6px 10px", 
            background: "var(--background-modifier-hover)", 
            borderRadius: 8, 
            marginRight: 8, 
            marginBottom: 8,
            border: "1px solid var(--background-modifier-accent)",
            transition: "all 0.2s ease"
        }}>
            <img src={user.getAvatarURL?.(undefined, 20, false)} width={20} height={20} style={{ borderRadius: "50%" }} />
            <span style={{ color: "var(--text-normal)", fontWeight: 500 }}>{(user as any).globalName || user.username}</span>
            <button 
                aria-label="remove" 
                onClick={() => onRemove(id)} 
                style={{ 
                    background: "transparent", 
                    border: 0, 
                    cursor: "pointer", 
                    color: "var(--interactive-normal)",
                    fontSize: "16px",
                    fontWeight: "bold",
                    padding: "2px 4px",
                    borderRadius: "4px",
                    transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--background-modifier-accent)";
                    e.currentTarget.style.color = "var(--text-danger)";
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--interactive-normal)";
                }}
            >×</button>
        </div>
    );
}

function SettingsRow({ label, right }: { label: string; right: React.ReactNode; }) {
    return (
        <div style={{ 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "space-between", 
            padding: "12px 0",
            borderBottom: "1px solid var(--background-modifier-accent)"
        }}>
            <div style={{ 
                color: "var(--text-normal)", 
                fontWeight: 500,
                fontSize: "14px"
            }}>{label}</div>
            <div>{right}</div>
        </div>
    );
}

function ServerSelectionModal({ modalProps }: { modalProps: ModalProps; }) {
    const [selectedGuilds, setSelectedGuilds] = React.useState<string[]>(parseCsv(settings.store.selectedGuilds));
    const [selectedChannels, setSelectedChannels] = React.useState<string[]>(parseCsv(settings.store.selectedChannels));
    const [currentGuild, setCurrentGuild] = React.useState<string | null>(null);

    const guilds = Object.values(GuildStore.getGuilds?.() || {} as Record<string, any>);
    const channels = currentGuild ? GuildChannelStore.getChannels?.(currentGuild)?.SELECTABLE || [] : [];

    function saveServerSelection() {
        settings.store.selectedGuilds = selectedGuilds.join(",");
        settings.store.selectedChannels = selectedChannels.join(",");
        modalProps.onClose();
    }

    function toggleGuild(guildId: string) {
        setSelectedGuilds(prev => 
            prev.includes(guildId) 
                ? prev.filter(id => id !== guildId)
                : [...prev, guildId]
        );
    }

    function toggleChannel(channelId: string) {
        setSelectedChannels(prev => 
            prev.includes(channelId) 
                ? prev.filter(id => id !== channelId)
                : [...prev, channelId]
        );
    }

    return (
        <ModalRoot {...modalProps}>
            <ModalHeader>
                <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                    <h2 style={{ margin: 0 }}>Sunucu ve Kanal Seçimi</h2>
                    <div style={{ flex: 1 }} />
                    <ModalCloseButton onClick={modalProps.onClose} />
                </div>
            </ModalHeader>
            <ModalContent>
                <div style={{ 
                    marginBottom: 16, 
                    color: "var(--text-normal)", 
                    fontWeight: 600,
                    fontSize: "16px"
                }}>Hangi sunuculardaki mesajlarınızı işlemek istiyorsunuz?</div>
                
                <div style={{ 
                    display: "grid", 
                    gridTemplateColumns: "1fr 1fr", 
                    gap: "16px",
                    height: "400px"
                }}>
                    {/* Sunucu Listesi */}
                    <div style={{ 
                        background: "var(--background-secondary)",
                        borderRadius: "8px",
                        border: "1px solid var(--background-modifier-accent)",
                        padding: "12px"
                    }}>
                        <div style={{ 
                            marginBottom: 12, 
                            color: "var(--text-normal)", 
                            fontWeight: 600,
                            fontSize: "14px"
                        }}>Sunucular</div>
                        <div style={{ 
                            maxHeight: "320px", 
                            overflow: "auto",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px"
                        }}>
                            {guilds.map((guild: any) => (
                                <div 
                                    key={guild.id}
                                    style={{ 
                                        display: "flex", 
                                        alignItems: "center", 
                                        padding: "8px 12px", 
                                        borderRadius: 6, 
                                        gap: 12,
                                        background: selectedGuilds.includes(guild.id) ? "var(--brand-experiment)" : "var(--background-modifier-hover)",
                                        color: selectedGuilds.includes(guild.id) ? "var(--white-500)" : "var(--text-normal)",
                                        cursor: "pointer",
                                        transition: "all 0.2s ease"
                                    }}
                                    onClick={() => {
                                        toggleGuild(guild.id);
                                        setCurrentGuild(guild.id);
                                    }}
                                >
                                    <img 
                                        src={guild.getIconURL?.({ size: 32 })} 
                                        width={32} 
                                        height={32} 
                                        style={{ borderRadius: "50%" }} 
                                    />
                                    <div style={{ flex: 1, fontWeight: 500 }}>{guild.name}</div>
                                    {selectedGuilds.includes(guild.id) && (
                                        <div style={{ fontSize: "18px" }}>✓</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Kanal Listesi */}
                    <div style={{ 
                        background: "var(--background-secondary)",
                        borderRadius: "8px",
                        border: "1px solid var(--background-modifier-accent)",
                        padding: "12px"
                    }}>
                        <div style={{ 
                            marginBottom: 12, 
                            color: "var(--text-normal)", 
                            fontWeight: 600,
                            fontSize: "14px"
                        }}>
                            {currentGuild ? "Kanallar" : "Önce bir sunucu seçin"}
                        </div>
                        <div style={{ 
                            maxHeight: "320px", 
                            overflow: "auto",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px"
                        }}>
                            {currentGuild && channels.map(channel => {
                                const ch = channel.channel || channel;
                                return (
                                    <div 
                                        key={ch.id}
                                        style={{ 
                                            display: "flex", 
                                            alignItems: "center", 
                                            padding: "8px 12px", 
                                            borderRadius: 6, 
                                            gap: 12,
                                            background: selectedChannels.includes(ch.id) ? "var(--brand-experiment)" : "var(--background-modifier-hover)",
                                            color: selectedChannels.includes(ch.id) ? "var(--white-500)" : "var(--text-normal)",
                                            cursor: "pointer",
                                            transition: "all 0.2s ease"
                                        }}
                                        onClick={() => toggleChannel(ch.id)}
                                    >
                                        <div style={{ 
                                            width: 32, 
                                            height: 32, 
                                            borderRadius: "50%", 
                                            background: "var(--background-modifier-accent)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: "16px"
                                        }}>#</div>
                                        <div style={{ flex: 1, fontWeight: 500 }}>{ch.name}</div>
                                        {selectedChannels.includes(ch.id) && (
                                            <div style={{ fontSize: "18px" }}>✓</div>
                                        )}
                                    </div>
                                );
                            })}
                            {!currentGuild && (
                                <div style={{ 
                                    padding: "20px",
                                    textAlign: "center",
                                    color: "var(--text-muted)", 
                                    fontStyle: "italic"
                                }}>Sunucu seçin</div>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ 
                    marginTop: 16,
                    padding: "12px",
                    background: "var(--background-modifier-hover)",
                    borderRadius: "8px",
                    border: "1px solid var(--background-modifier-accent)"
                }}>
                    <div style={{ 
                        color: "var(--text-normal)", 
                        fontWeight: 500,
                        fontSize: "14px",
                        marginBottom: 8
                    }}>ℹ️ Bilgi:</div>
                    <div style={{ 
                        color: "var(--text-muted)", 
                        fontSize: "13px",
                        lineHeight: "1.4"
                    }}>
                        Seçilen kanallardaki mesajlarınız korunacak, diğer kanallardaki mesajlarınız silinecektir.
                    </div>
                </div>
            </ModalContent>
            <ModalFooter>
                <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    width: "100%",
                    gap: "12px"
                }}>
                    <Button 
                        onClick={modalProps.onClose}
                        style={{
                            background: "var(--background-modifier-hover)",
                            color: "var(--text-normal)",
                            border: "1px solid var(--background-modifier-accent)"
                        }}
                    >İptal</Button>
                    <Button 
                        onClick={saveServerSelection}
                        style={{
                            background: "var(--brand-experiment)",
                            color: "var(--white-500)"
                        }}
                    >Kaydet</Button>
                </div>
            </ModalFooter>
        </ModalRoot>
    );
}

function WhitelistModal({ modalProps }: { modalProps: ModalProps; }) {
    const [query, setQuery] = React.useState("");
    const [wl, setWl] = React.useState<string[]>(getWhitelist());
    const [includeGuilds, setIncludeGuilds] = React.useState<boolean>(settings.store.includeGuilds);
    const [includeGroupDMs, setIncludeGroupDMs] = React.useState<boolean>(settings.store.includeGroupDMs);

    const friendIds = RelationshipStore.getFriendIDs?.() ?? [];
    const dms = ChannelStore.getSortedPrivateChannels().filter(c => c.isDM?.());
    const candidateIds: string[] = React.useMemo(() => {
        const lower = query.toLowerCase();
        const base = (friendIds.length ? friendIds : dms.map(c => c.recipients?.[0]).filter(Boolean)) as string[];
        return base
            .filter(id => !wl.includes(id))
            .filter(id => {
                const u: any = UserStore.getUser(id);
                const name = (u?.globalName || u?.username || "").toLowerCase();
                return name.includes(lower);
            })
            .slice(0, 25);
    }, [query, wl, friendIds, dms]);

    function save() {
        setWhitelist(wl);
        settings.store.includeGuilds = includeGuilds;
        settings.store.includeGroupDMs = includeGroupDMs;
        modalProps.onClose();
    }

    async function start() {
        // persist
        setWhitelist(wl);
        settings.store.includeGuilds = includeGuilds;
        settings.store.includeGroupDMs = includeGroupDMs;

        const whitelistSet = new Set(wl);
        const myId = UserStore.getCurrentUser()?.id;
        if (!myId) {
            Toasts.show({ id: Toasts.genId(), type: Toasts.Type.FAILURE, message: "Could not determine current user." });
            return;
        }

        // Build target channel list
        const dmChannels = ChannelStore.getSortedPrivateChannels()
            .filter(c => typeof c.isDM === "function" ? c.isDM() : c.type === 1)
            .filter(c => {
                const recipientId = c.recipients?.[0];
                return recipientId && !whitelistSet.has(recipientId);
            });

        const groupDmChannels = includeGroupDMs ? ChannelStore.getSortedPrivateChannels()
            .filter(c => typeof c.isGroupDM === "function" ? c.isGroupDM() : c.type === 3)
            .filter(c => {
                const recips: string[] = (c.recipients || []).filter((id: string) => id !== myId);
                return recips.length > 0 && !recips.some(id => whitelistSet.has(id));
            }) : [];

        const guildTextChannels: any[] = [];
        if (includeGuilds) {
            const selectedGuildIds = parseCsv(settings.store.selectedGuilds);
            const selectedChannelIds = parseCsv(settings.store.selectedChannels);
            
            if (selectedGuildIds.length > 0) {
                // Sadece seçilen sunuculardaki kanalları işle
                for (const guildId of selectedGuildIds) {
                    const info: any = GuildChannelStore.getChannels?.(guildId);
                    const selectable = info?.SELECTABLE || [];
                    for (const item of selectable) {
                        const ch = item.channel || item; // compat
                        // 0 = GUILD_TEXT, 11/12 = threads, include threads too
                        if ([0, 11, 12].includes(ch?.type)) {
                            // Eğer kanal whitelist'te değilse silinecek kanallara ekle
                            if (!selectedChannelIds.includes(ch.id)) {
                                guildTextChannels.push(ch);
                            }
                        }
                    }
                }
            } else {
                // Eski davranış: tüm sunuculardaki kanalları işle
                const guilds = Object.values(GuildStore.getGuilds?.() || {} as Record<string, any>);
                for (const g of guilds) {
                    const guild = g as any;
                    const info: any = GuildChannelStore.getChannels?.(guild.id);
                    const selectable = info?.SELECTABLE || [];
                    for (const item of selectable) {
                        const ch = item.channel || item; // compat
                        // 0 = GUILD_TEXT, 11/12 = threads, include threads too
                        if ([0, 11, 12].includes(ch?.type)) guildTextChannels.push(ch);
                    }
                }
            }
        }

        const targets = [...dmChannels, ...groupDmChannels, ...guildTextChannels];
        if (!targets.length) {
            Toasts.show({ id: Toasts.genId(), type: Toasts.Type.MESSAGE, message: "No channels to process." });
            modalProps.onClose();
            return;
        }

        Toasts.show({ id: Toasts.genId(), type: Toasts.Type.MESSAGE, message: `Processing ${targets.length} channels...` });

        const deleted: DeletedLogItem[] = [];
        let deletedCount = 0, failedCount = 0;

        // conservative delays to avoid rate limits
        const perDeleteDelayMs = 900 + Math.floor(Math.random() * 300);

        for (const ch of targets) {
            try {
                const messages = await fetchAllMessages(ch.id);
                const toDelete = messages.filter((m: any) => m?.author?.id === myId);
                for (const m of toDelete) {
                    try {
                        await MessageActions.deleteMessage(ch.id, m.id);
                        deletedCount++;
                        deleted.push({
                            channelId: ch.id,
                            guildId: ch.guild_id ?? null,
                            dmRecipientId: typeof ch.isDM === "function" && ch.isDM() ? ch.recipients?.[0] : null,
                            isGuild: !!ch.guild_id,
                            messageId: m.id,
                            timestamp: String(m.timestamp),
                            content: String(m.content ?? ""),
                            attachments: (m.attachments || []).map((a: any) => ({ filename: a.filename, url: a.url, content_type: a.content_type }))
                        });
                        await wait(perDeleteDelayMs);
                    } catch {
                        failedCount++;
                        // on 429 or generic error, slow down
                        await wait(perDeleteDelayMs + 1500);
                    }
                }
                // light pause between channels
                await wait(500);
            } catch {
                // ignore channel fetch errors
            }
        }

        // Build and save log
        const runId = new Date().toISOString().replace(/[:.]/g, "-");
        const body = {
            runId,
            startedAt: runId,
            finishedAt: new Date().toISOString(),
            userId: myId,
            includeGuilds,
            includeGroupDMs,
            whitelist: wl,
            selectedGuilds: parseCsv(settings.store.selectedGuilds),
            selectedChannels: parseCsv(settings.store.selectedChannels),
            stats: { deleted: deletedCount, failed: failedCount, channels: targets.length },
            deleted
        };

        const filename = `delete-log-${runId}.json`;
        try {
            if ((window as any).IS_DISCORD_DESKTOP) {
                const data = new TextEncoder().encode(JSON.stringify(body, null, 2));
                const savedPath = await (window as any).DiscordNative.fileManager.saveWithDialog(data, filename, "application/json");
                if (savedPath) {
                    settings.store.lastLogFilePath = savedPath;
                    Toasts.show({ id: Toasts.genId(), type: Toasts.Type.SUCCESS, message: `Saved log: ${filename}` });
                } else {
                    Toasts.show({ id: Toasts.genId(), type: Toasts.Type.FAILURE, message: "Log save canceled" });
                }
            } else {
                const blob = new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
                Toasts.show({ id: Toasts.genId(), type: Toasts.Type.SUCCESS, message: `Downloaded log: ${filename}` });
            }
        } catch {
            Toasts.show({ id: Toasts.genId(), type: Toasts.Type.FAILURE, message: "Failed to save log" });
        }

        Toasts.show({ id: Toasts.genId(), type: failedCount ? Toasts.Type.FAILURE : Toasts.Type.SUCCESS, message: `Done. Deleted ${deletedCount}${failedCount ? `, failed ${failedCount}` : ""}.` });
        modalProps.onClose();
    }

    return (
        <ModalRoot {...modalProps}>
            <ModalHeader>
                <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                    <h2 style={{ margin: 0 }}>Messages Scrapper</h2>
                    <div style={{ flex: 1 }} />
                    <ModalCloseButton onClick={modalProps.onClose} />
                </div>
            </ModalHeader>
            <ModalContent>
                <div style={{ 
                    marginBottom: 12, 
                    color: "var(--text-normal)", 
                    fontWeight: 600,
                    fontSize: "14px"
                }}>Whitelist (kept users):</div>
                <div style={{ 
                    display: "flex", 
                    flexWrap: "wrap",
                    minHeight: "40px",
                    padding: "8px",
                    background: "var(--background-secondary)",
                    borderRadius: "8px",
                    border: "1px solid var(--background-modifier-accent)"
                }}>
                    {wl.map(id => <FriendTag key={id} id={id} onRemove={(idToRemove: string) => setWl(wl.filter(x => x !== idToRemove))} />)}
                    {wl.length === 0 && (
                        <div style={{ 
                            color: "var(--text-muted)", 
                            fontStyle: "italic",
                            alignSelf: "center"
                        }}>No users in whitelist</div>
                    )}
                </div>
                <div style={{ 
                    marginTop: 16, 
                    marginBottom: 8,
                    color: "var(--text-normal)", 
                    fontWeight: 600,
                    fontSize: "14px"
                }}>Add from your friends/DMs</div>
                <input
                    placeholder="Search users by name"
                    value={query}
                    onChange={e => setQuery((e.target as HTMLInputElement).value)}
                    style={{ 
                        width: "100%", 
                        padding: "10px 12px", 
                        borderRadius: 8, 
                        border: "1px solid var(--background-modifier-accent)",
                        background: "var(--input-background)",
                        color: "var(--text-normal)",
                        fontSize: "14px",
                        outline: "none",
                        transition: "border-color 0.2s ease"
                    }}
                    onFocus={(e) => {
                        e.target.style.borderColor = "var(--brand-experiment)";
                    }}
                    onBlur={(e) => {
                        e.target.style.borderColor = "var(--background-modifier-accent)";
                    }}
                />
                <div style={{ 
                    marginTop: 12, 
                    maxHeight: 200, 
                    overflow: "auto",
                    background: "var(--background-secondary)",
                    borderRadius: "8px",
                    border: "1px solid var(--background-modifier-accent)"
                }}>
                    {candidateIds.map((id: string) => {
                        const u: any = id ? UserStore.getUser(id) : null;
                        const label = (u?.globalName || u?.username || id || "Unknown") as string;
                        const avatar = u?.getAvatarURL?.(undefined, 32, false);
                        return (
                            <div key={id} style={{ 
                                display: "flex", 
                                alignItems: "center", 
                                padding: "12px", 
                                borderRadius: 6, 
                                gap: 12,
                                borderBottom: "1px solid var(--background-modifier-accent)",
                                transition: "background-color 0.2s ease"
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = "var(--background-modifier-hover)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = "transparent";
                            }}>
                                {avatar && <img src={avatar} width={32} height={32} style={{ borderRadius: "50%" }} />}
                                <div style={{ 
                                    flex: 1, 
                                    color: "var(--text-normal)",
                                    fontWeight: 500,
                                    fontSize: "14px"
                                }}>{label}</div>
                                <Button 
                                    size={Button.Sizes.SMALL} 
                                    onClick={() => setWl(uniq([...wl, id]))} 
                                    disabled={!id}
                                    style={{
                                        background: "var(--brand-experiment)",
                                        color: "var(--white-500)"
                                    }}
                                >Add</Button>
                            </div>
                        );
                    })}
                    {candidateIds.length === 0 && (
                        <div style={{ 
                            padding: "20px",
                            textAlign: "center",
                            color: "var(--text-muted)", 
                            fontStyle: "italic"
                        }}>No matches found</div>
                    )}
                </div>
                <div style={{ 
                    marginTop: 20,
                    background: "var(--background-secondary)",
                    borderRadius: "8px",
                    border: "1px solid var(--background-modifier-accent)",
                    padding: "16px"
                }}>
                    <div style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "space-between", 
                        padding: "12px 0",
                        borderBottom: "1px solid var(--background-modifier-accent)"
                    }}>
                        <div style={{ 
                            color: "var(--text-normal)", 
                            fontWeight: 500,
                            fontSize: "14px"
                        }}>Sunucu ve Kanal Seçimi</div>
                        <Button 
                            size={Button.Sizes.SMALL} 
                            onClick={() => openModal(props => <ServerSelectionModal modalProps={props} />)}
                            style={{
                                background: "var(--brand-experiment)",
                                color: "var(--white-500)"
                            }}
                        >Sunucu Seç</Button>
                    </div>
                    <SettingsRow label="Include server channels" right={<Button size={Button.Sizes.SMALL} onClick={() => setIncludeGuilds(!includeGuilds)} style={{ background: includeGuilds ? "var(--brand-experiment)" : "var(--background-modifier-hover)", color: includeGuilds ? "var(--white-500)" : "var(--text-normal)" }}>{includeGuilds ? "Enabled" : "Disabled"}</Button>} />
                    <SettingsRow label="Include Group DMs" right={<Button size={Button.Sizes.SMALL} onClick={() => setIncludeGroupDMs(!includeGroupDMs)} style={{ background: includeGroupDMs ? "var(--brand-experiment)" : "var(--background-modifier-hover)", color: includeGroupDMs ? "var(--white-500)" : "var(--text-normal)" }}>{includeGroupDMs ? "Enabled" : "Disabled"}</Button>} />
                </div>
            </ModalContent>
            <ModalFooter>
                <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    width: "100%",
                    gap: "12px"
                }}>
                    <Button 
                        onClick={save}
                        style={{
                            background: "var(--background-modifier-hover)",
                            color: "var(--text-normal)",
                            border: "1px solid var(--background-modifier-accent)"
                        }}
                    >Save</Button>
                    <Button 
                        color={Button.Colors.RED} 
                        onClick={start}
                        style={{
                            background: "var(--button-danger-background)",
                            color: "var(--white-500)"
                        }}
                    >Start</Button>
                </div>
            </ModalFooter>
        </ModalRoot>
    );
}

export default definePlugin({
    name: "MessagesScrapper",
    description: "Delete your own messages in DMs and servers except whitelisted users. Logs each run to JSON.",
    authors: [Devs.feelslove],
    settings,
    renderChatBarButton: ({ isMainChat }) => {
        if (!isMainChat) return null;
        return (
            <ChatBarButton
                tooltip="Messages Scrapper"
                onClick={() => openModal(props => <WhitelistModal modalProps={props} />)}
                onContextMenu={e =>
                    ContextMenuApi.openContextMenu(e, () => (
                        <Menu.Menu navId="pc-messages-scrapper-menu" onClose={ContextMenuApi.closeContextMenu} aria-label="Messages Scrapper">
                            <Menu.MenuItem id="pc-messages-scrapper-open" label="Open Messages Scrapper" action={() => openModal(props => <WhitelistModal modalProps={props} />)} />
                        </Menu.Menu>
                    ))
                }
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="currentColor" d="M9 3h6a1 1 0 0 1 1 1v1h4v2H4V5h4V4a1 1 0 0 1 1-1Zm-3 6h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 9Z" />
                </svg>
            </ChatBarButton>
        );
    }
});