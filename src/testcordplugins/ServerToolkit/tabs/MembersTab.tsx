/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { copyWithToast } from "@utils/discord";
import { Guild } from "@vencord/discord-types";
import { Forms, GuildMemberCountStore, GuildMemberStore, React, Text, TextInput, useMemo, UserStore, useState } from "@webpack/common";

export function MembersTab({ guild }: { guild: Guild; }) {
    const [filter, setFilter] = useState("");

    const members = useMemo(() => {
        const m = (GuildMemberStore as any).getMembers?.(guild.id) ?? [];
        return m;
    }, [guild.id]);

    const totalMembers = useMemo(() => {
        return GuildMemberCountStore?.getMemberCount(guild.id) ?? (guild as any).memberCount ?? "?";
    }, [guild.id]);

    const filtered = useMemo(() => {
        if (!filter) return members.slice(0, 500);
        const f = filter.toLowerCase();
        return members.filter((m: any) => {
            const u = UserStore.getUser(m.userId);
            return (
                m.userId?.includes(filter) ||
                m.nick?.toLowerCase().includes(f) ||
                u?.username?.toLowerCase().includes(f) ||
                (u as any)?.globalName?.toLowerCase().includes(f)
            );
        }).slice(0, 500);
    }, [members, filter]);

    return (
        <div className="gt-members">
            <Forms.FormTitle tag="h2" style={{ marginBottom: 12 }}>
                {`Members (${members.length} cached, ${totalMembers} total)`}
            </Forms.FormTitle>
            <Text variant="text-xs/normal" style={{ color: "var(--text-muted)", marginBottom: 8 }}>
                Only members currently loaded by your client are shown. Scroll the member list in Discord to load more.
            </Text>
            <TextInput
                placeholder="Filter by name, nick, or ID…"
                value={filter}
                onChange={setFilter}
                className="gt-input gt-search"
            />
            <div className="gt-member-list">
                {filtered.map((m: any) => {
                    const u = UserStore.getUser(m.userId);
                    return (
                        <div key={m.userId} className="gt-member-row">
                            <span
                                className="gt-member-name"
                                onClick={() => copyWithToast(m.nick || (u as any)?.globalName || u?.username || "Unknown")}
                                style={{ cursor: "pointer" }}
                            >
                                {m.nick || (u as any)?.globalName || u?.username || "Unknown"}
                            </span>
                            <span
                                className="gt-member-tag"
                                onClick={() => u?.username && copyWithToast(u.username)}
                                style={{ cursor: u?.username ? "pointer" : undefined }}
                            >
                                {u?.username ? `@${u.username}` : ""}
                            </span>
                            <span
                                className="gt-member-id"
                                onClick={() => copyWithToast(m.userId)}
                                style={{ cursor: "pointer" }}
                            >
                                {m.userId}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
