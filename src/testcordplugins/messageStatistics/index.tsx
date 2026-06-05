/*
 * MallCord, a vaporwave-inspired Discord client mod
 * Copyright (c) 2026 Dann
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { sendBotMessage } from "@api/Commands";
import * as DataStore from "@api/DataStore";
import { addMessagePreSendListener, removeMessagePreSendListener } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { React, useEffect, useState } from "@webpack/common";

const KEY = "MallCord_MessageStats";
const DAY = 24 * 60 * 60 * 1000;

async function record() {
    const now = Date.now();
    const cutoff = now - 365 * DAY;
    await DataStore.update<number[]>(KEY, old => [...(old ?? []).filter(t => t > cutoff), now]);
}

function startOfDay(ts: number) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

function streak(timestamps: number[], goal: number) {
    const perDay = new Map<number, number>();
    for (const t of timestamps) perDay.set(startOfDay(t), (perDay.get(startOfDay(t)) ?? 0) + 1);

    let count = 0;
    let day = startOfDay(Date.now());
    // allow today to still be in progress: only break the streak on a *past* day that missed the goal
    while (true) {
        const hit = (perDay.get(day) ?? 0) >= goal;
        if (hit) count++;
        else if (day < startOfDay(Date.now())) break;
        day -= DAY;
        if (count > 0 && !hit) break;
        if (day < startOfDay(Date.now()) - 400 * DAY) break;
    }
    return count;
}

const row = (label: string, value: React.ReactNode, color?: string) => (
    <tr style={{ borderBottom: "1px solid var(--background-modifier-accent)" }}>
        <td style={{ padding: "10px" }}>{label}</td>
        <td style={{ padding: "10px", fontWeight: "bold", color }}>{value}</td>
    </tr>
);

function StatsPanel() {
    const { dailyGoal } = settings.use(["dailyGoal"]);
    const [timestamps, setTimestamps] = useState<number[]>([]);

    const reload = () => DataStore.get<number[]>(KEY).then(v => setTimestamps(v ?? []));
    useEffect(() => { reload(); }, []);

    const now = Date.now();
    const since = (ms: number) => timestamps.filter(t => now - t < ms).length;

    const goal = dailyGoal || 100;
    const today = since(DAY);
    const pct = Math.min(Math.round((today / goal) * 100), 100);

    const days = Math.max(1, Math.ceil((now - Math.min(now, ...timestamps)) / DAY));
    const avg = Math.round(timestamps.length / days);

    const perDay = new Map<number, number>();
    for (const t of timestamps) perDay.set(startOfDay(t), (perDay.get(startOfDay(t)) ?? 0) + 1);
    const best = perDay.size ? Math.max(...perDay.values()) : 0;

    return (
        <div style={{ color: "var(--text-normal)" }}>
            <div style={{ marginBottom: 20, background: "var(--background-secondary)", padding: 15, borderRadius: 8 }}>
                <h3 style={{ marginTop: 0, color: "var(--header-primary)" }}>🎯 Daily goal</h3>
                <p>Aiming for <strong>{goal}</strong> messages a day.</p>
                <div style={{ background: "var(--background-modifier-accent)", height: 20, borderRadius: 10, overflow: "hidden", marginTop: 10 }}>
                    <div style={{ background: "var(--brand-experiment)", width: `${pct}%`, height: "100%", textAlign: "center", color: "white", fontSize: 12, lineHeight: "20px", fontWeight: "bold" }}>
                        {pct}%
                    </div>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 5 }}>Sent today: {today} / {goal}</p>
            </div>

            <h3 style={{ color: "var(--header-primary)", marginBottom: 10 }}>📊 Stats</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", background: "var(--background-secondary)", borderRadius: 8, overflow: "hidden" }}>
                <tbody>
                    {row("Today", today, "var(--text-positive)")}
                    {row("This week", since(7 * DAY))}
                    {row("This month", since(30 * DAY))}
                    {row("This year", since(365 * DAY))}
                    {row("All time (tracked)", timestamps.length)}
                    {row("Daily average", avg)}
                    {row("Best day", best)}
                    {row("Current streak", `${streak(timestamps, goal)} day(s)`, "var(--text-brand)")}
                </tbody>
            </table>

            <button
                onClick={async () => { await DataStore.set(KEY, []); reload(); }}
                style={{ marginTop: 15, background: "var(--background-tertiary)", color: "var(--text-normal)", border: "1px solid var(--background-modifier-accent)", padding: "8px 12px", borderRadius: 4, cursor: "pointer" }}
            >
                Reset stats
            </button>
        </div>
    );
}

const settings = definePluginSettings({
    dailyGoal: {
        type: OptionType.NUMBER,
        description: "How many messages you want to send per day",
        default: 100
    },
    display: {
        type: OptionType.COMPONENT,
        description: "",
        component: StatsPanel
    }
});

export default definePlugin({
    name: "MessageStatistics",
    description: "Tracks how many messages you send per day, week, month and year, with a daily goal and streaks.",
    authors: [{ name: "Dann", id: 0n }],
    dependencies: ["CommandsAPI"],
    settings,

    commands: [
        {
            name: "mystats",
            description: "Show your message stats here in chat",
            options: [],
            execute: async (_, ctx) => {
                const ts = (await DataStore.get<number[]>(KEY)) ?? [];
                const now = Date.now();
                const since = (ms: number) => ts.filter(t => now - t < ms).length;
                sendBotMessage(ctx.channel.id, {
                    content: `📊 **Your messages** — today **${since(DAY)}** · week **${since(7 * DAY)}** · month **${since(30 * DAY)}** · year **${since(365 * DAY)}** · all-time **${ts.length}**`
                });
            }
        }
    ],

    start() {
        this.pre = addMessagePreSendListener(() => { record(); });
    },
    stop() {
        removeMessagePreSendListener(this.pre);
    }
});
