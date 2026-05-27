/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import ErrorBoundary from "@components/ErrorBoundary";
import { HeadingPrimary, HeadingTertiary } from "@components/Heading";
import { SettingsTab, wrapTab } from "@components/settings";
import { copyToClipboard } from "@utils/clipboard";
import { classNameFactory } from "@utils/css";
import { classes } from "@utils/misc";
import { ModalCloseButton, ModalContent, ModalHeader, type ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import { ChannelStore, GuildStore, React, Select, TextInput, Toasts, useEffect, useMemo, UserStore, useState, useStateFromStores } from "@webpack/common";

import { addServerTarget, getServerTargets, getTargets, removeServerTarget, removeTarget, setTargets, settings, subscribeServerTargets, subscribeTargets } from "..";
import { clearEvents, getEvents, loadEvents, subscribe } from "../store";
import type { SurveillanceEvent, SurveillanceEventType } from "../types";

type EventFilter = "all" | "activity" | "message" | "presence" | "reaction" | "server" | "typing" | "voice";

interface GuildOption {
    label: string;
    value: string;
}

const EVENT_PAGE_SIZE = 250;
const cl = classNameFactory("vc-surveillance-");

const filterOptions: Array<{ label: string; value: EventFilter; }> = [
    { label: "All", value: "all" },
    { label: "Messages", value: "message" },
    { label: "Server", value: "server" },
    { label: "Reactions", value: "reaction" },
    { label: "Presence", value: "presence" },
    { label: "Voice", value: "voice" },
    { label: "Activities", value: "activity" },
    { label: "Typing", value: "typing" },
];

const typeLabels: Record<SurveillanceEventType, string> = {
    activity_start: "Activity",
    activity_stop: "Activity",
    activity_update: "Activity",
    channel_create: "Channel",
    channel_delete: "Channel",
    channel_update: "Channel",
    guild_member_add: "Member",
    guild_member_remove: "Member",
    guild_member_update: "Member",
    guild_update: "Server",
    message: "Message",
    message_delete: "Deleted",
    message_edit: "Edited",
    reaction_add: "Reaction",
    reaction_remove: "Reaction",
    reaction_remove_all: "Reaction",
    role_create: "Role",
    role_delete: "Role",
    role_update: "Role",
    status: "Status",
    thread_create: "Thread",
    thread_delete: "Thread",
    thread_update: "Thread",
    typing: "Typing",
    voice_join: "Voice",
    voice_leave: "Voice",
    voice_move: "Voice",
    voice_update: "Voice",
};

const eventMatchesFilter = (event: SurveillanceEvent, filter: EventFilter) => {
    if (filter === "all") return true;
    if (filter === "presence") return event.type === "status";
    if (filter === "server") return event.scope === "server" || ["channel_", "thread_", "guild_", "role_"].some(prefix => event.type.startsWith(prefix));
    return event.type.startsWith(filter);
};

const eventMatchesQuery = (event: SurveillanceEvent, query: string) => {
    if (!query) return true;

    const value = query.toLowerCase();
    return [
        event.username,
        event.userId,
        event.details,
        event.channelName,
        event.guildName,
        event.content,
        event.before,
        event.after,
    ].some(part => part?.toLowerCase().includes(value));
};

const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleString();

const formatLabel = (label: string) =>
    label.replace(/[A-Z]/g, match => ` ${match}`).replace(/^./, match => match.toUpperCase());

const toast = (message: string, type: string = Toasts.Type.SUCCESS) =>
    Toasts.show({
        type,
        message,
        id: Toasts.genId(),
    });

function DetailField({ label, value, wide, preserve }: { label: string; value?: string | number | boolean | null; wide?: boolean; preserve?: boolean; }) {
    if (value == null || value === "") return null;

    const text = String(value);

    return (
        <div className={classes(cl("modal-field"), wide && cl("modal-wide"))}>
            <strong>{label}</strong>
            {preserve ? <pre>{text}</pre> : <span>{text}</span>}
        </div>
    );
}

const EventDetailsModal = ErrorBoundary.wrap(function EventDetailsModal({ event, modalProps }: { event: SurveillanceEvent; modalProps: ModalProps; }) {
    const channel = event.channelId ? ChannelStore.getChannel(event.channelId) : undefined;
    const guild = event.guildId ? GuildStore.getGuild(event.guildId) : undefined;
    const metadata = Object.entries(event.metadata ?? {}).filter(([, value]) => value != null);

    const copyEvent = () => {
        try {
            void Promise.resolve(copyToClipboard(JSON.stringify(event, null, 2))).then(
                () => toast("Event copied."),
                () => toast("Failed to copy event.", Toasts.Type.FAILURE)
            );
        } catch {
            toast("Failed to copy event.", Toasts.Type.FAILURE);
        }
    };

    return (
        <ModalRoot {...modalProps} title="" size={ModalSize.MEDIUM}>
            <ModalHeader>
                <HeadingPrimary className={cl("modal-title")}>Event Details</HeadingPrimary>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>
            <ModalContent className={cl("modal-content")}>
                <div className={cl("modal-grid")}>
                    <DetailField label="Type" value={typeLabels[event.type]} />
                    <DetailField label="Time" value={formatTime(event.timestamp)} />
                    <DetailField label="User" value={event.username} />
                    <DetailField label="User ID" value={event.userId} />
                    <DetailField label="Scope" value={event.scope} />
                    <DetailField label="Server" value={event.guildName ?? guild?.name} />
                    <DetailField label="Server ID" value={event.guildId} />
                    <DetailField label="Channel" value={event.channelName ?? channel?.name} />
                    <DetailField label="Channel ID" value={event.channelId} />
                    <DetailField label="Details" value={event.details} wide={true} preserve={true} />
                    <DetailField label="Message Content" value={event.content} wide={true} preserve={true} />
                    <DetailField label="Before" value={event.before} wide={true} preserve={true} />
                    <DetailField label="After" value={event.after} wide={true} preserve={true} />
                </div>

                {metadata.length ? (
                    <div className={cl("modal-grid")}>
                        {metadata.map(([key, value]) => (
                            <DetailField key={key} label={formatLabel(key)} value={value} />
                        ))}
                    </div>
                ) : null}

                <div className={cl("actions")}>
                    <button className={cl("action")} onClick={copyEvent}>Copy Event JSON</button>
                </div>
                <div className={cl("modal-meta")}>Event ID: {event.id}</div>
            </ModalContent>
        </ModalRoot>
    );
}, { noop: true });

const openEventModal = (event: SurveillanceEvent) => {
    openModal((modalProps: any) => <EventDetailsModal event={event} modalProps={modalProps} />);
};

function TargetPill({ userId }: { userId: string; }) {
    const user = UserStore.getUser(userId);

    return (
        <button className={cl("target-pill")} onClick={() => removeTarget(userId)}>
            <span>{user?.username ?? userId}</span>
            <span className={cl("target-id")}>{userId}</span>
        </button>
    );
}

function ServerPill({ guildId }: { guildId: string; }) {
    const guild = GuildStore.getGuild(guildId);

    return (
        <button className={cl("target-pill")} onClick={() => removeServerTarget(guildId)}>
            <span>{guild?.name ?? guildId}</span>
            <span className={cl("target-id")}>{guildId}</span>
        </button>
    );
}

function Stat({ label, value }: { label: string; value: number; }) {
    return (
        <div className={cl("stat")}>
            <span>{value}</span>
            <small>{label}</small>
        </div>
    );
}

function EventRow({ event }: { event: SurveillanceEvent; }) {
    const channel = event.channelId ? ChannelStore.getChannel(event.channelId) : undefined;
    const guild = event.guildId ? GuildStore.getGuild(event.guildId) : undefined;
    const location = [
        event.guildName ?? guild?.name,
        event.channelName ?? channel?.name,
    ].filter(Boolean).join(" / ");

    return (
        <button className={cl("event-row")} onClick={() => openEventModal(event)} type="button">
            <div className={classes(cl("event-badge"), cl(`event-${event.type}`))}>
                {typeLabels[event.type]}
            </div>
            <div className={cl("event-main")}>
                <div className={cl("event-head")}>
                    <strong>{event.username}</strong>
                    <span>{formatTime(event.timestamp)}</span>
                </div>
                <div className={cl("event-details")}>{event.details}</div>
                {location ? <div className={cl("event-location")}>{location}</div> : null}
                {event.before || event.after ? (
                    <div className={cl("event-diff")}>
                        {event.before ? <span>Before: {event.before}</span> : null}
                        {event.after ? <span>After: {event.after}</span> : null}
                    </div>
                ) : null}
            </div>
        </button>
    );
}

function SurveillanceTab() {
    const [events, setEvents] = useState<SurveillanceEvent[]>(getEvents());
    const [targets, setLocalTargets] = useState(getTargets());
    const [serverTargets, setLocalServerTargets] = useState(getServerTargets());
    const [targetInput, setTargetInput] = useState("");
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<EventFilter>("all");
    const [visibleEventCount, setVisibleEventCount] = useState(EVENT_PAGE_SIZE);
    const guilds = useStateFromStores([GuildStore], () => GuildStore.getGuildsArray());

    useEffect(() => {
        void loadEvents(settings.store.maxEvents).then(() => setEvents([...getEvents()]));

        const unsubscribeEvents = subscribe(() => setEvents([...getEvents()]));
        const unsubscribeTargets = subscribeTargets(() => setLocalTargets([...getTargets()]));
        const unsubscribeServerTargets = subscribeServerTargets(() => setLocalServerTargets([...getServerTargets()]));

        return () => {
            unsubscribeEvents();
            unsubscribeTargets();
            unsubscribeServerTargets();
        };
    }, []);

    useEffect(() => {
        setVisibleEventCount(EVENT_PAGE_SIZE);
        return () => undefined;
    }, [filter, query]);

    const filteredEvents = useMemo(() =>
        events.filter(event => eventMatchesFilter(event, filter) && eventMatchesQuery(event, query)),
        [events, filter, query]
    );

    const visibleEvents = useMemo(() =>
        filteredEvents.slice(0, visibleEventCount),
        [filteredEvents, visibleEventCount]
    );

    const stats = useMemo(() => ({
        events: events.length,
        users: new Set(events.map(event => event.userId)).size,
        guilds: new Set(events.map(event => event.guildId).filter(Boolean)).size,
        channels: new Set(events.map(event => event.channelId).filter(Boolean)).size,
    }), [events]);

    const guildOptions = useMemo<GuildOption[]>(() =>
        guilds
            .filter(guild => !serverTargets.includes(guild.id))
            .map(guild => ({ label: guild.name, value: guild.id }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        [guilds, serverTargets]
    );

    const addInputTargets = () => {
        const ids = targetInput.match(/\d+/g) ?? [];
        if (!ids.length) {
            toast("Enter a valid Discord user ID.", Toasts.Type.FAILURE);
            return;
        }

        setTargets([...targets, ...ids]);
        setTargetInput("");
        toast("Target list updated.");
    };

    const copyEvents = () => {
        try {
            void Promise.resolve(copyToClipboard(JSON.stringify(filteredEvents, null, 2))).then(
                () => toast("Surveillance events copied."),
                () => toast("Failed to copy surveillance events.", Toasts.Type.FAILURE)
            );
        } catch {
            toast("Failed to copy surveillance events.", Toasts.Type.FAILURE);
        }
    };

    const resetEvents = () => {
        void clearEvents().then(() => toast("Surveillance events cleared."));
    };

    return (
        <SettingsTab>
            <div className={cl("root")}>
                <div className={cl("header")}>
                    <HeadingPrimary>Surveillance</HeadingPrimary>
                    <div className={cl("actions")}>
                        <button className={cl("action")} onClick={copyEvents}>Export JSON</button>
                        <button className={classes(cl("action"), cl("danger"))} onClick={resetEvents}>Clear</button>
                    </div>
                </div>

                <div className={cl("stats")}>
                    <Stat label="Events" value={stats.events} />
                    <Stat label="Users" value={stats.users} />
                    <Stat label="Servers" value={stats.guilds} />
                    <Stat label="Channels" value={stats.channels} />
                </div>

                <div className={cl("target-grid")}>
                    <section className={cl("panel")}>
                        <HeadingTertiary>Person Surveillance</HeadingTertiary>
                        <div className={cl("target-input")}>
                            <TextInput value={targetInput} placeholder="Discord user IDs..." onChange={setTargetInput} />
                            <button className={cl("action")} onClick={addInputTargets}>Add</button>
                        </div>
                        <div className={cl("target-list")}>
                            {targets.length ? targets.map(userId => (
                                <TargetPill key={userId} userId={userId} />
                            )) : <span className={cl("empty")}>No person targets.</span>}
                        </div>
                    </section>

                    <section className={cl("panel")}>
                        <HeadingTertiary>Server Surveillance</HeadingTertiary>
                        <div className={cl("server-select")}>
                            <Select
                                placeholder="Select a server..."
                                options={guildOptions}
                                maxVisibleItems={8}
                                closeOnSelect={true}
                                select={addServerTarget}
                                isSelected={value => serverTargets.includes(value)}
                                serialize={value => value}
                            />
                        </div>
                        <div className={cl("target-list")}>
                            {serverTargets.length ? serverTargets.map(guildId => (
                                <ServerPill key={guildId} guildId={guildId} />
                            )) : <span className={cl("empty")}>No server targets.</span>}
                        </div>
                    </section>
                </div>

                <section className={cl("panel")}>
                    <div className={cl("timeline-head")}>
                        <HeadingTertiary>Timeline</HeadingTertiary>
                        <TextInput value={query} placeholder="Search events..." onChange={setQuery} />
                    </div>
                    <div className={cl("filters")}>
                        {filterOptions.map(option => (
                            <button
                                key={option.value}
                                className={classes(cl("filter"), filter === option.value && cl("filter-active"))}
                                onClick={() => setFilter(option.value)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <div className={cl("timeline")}>
                        {visibleEvents.length ? visibleEvents.map(event => (
                            <EventRow key={event.id} event={event} />
                        )) : <div className={cl("empty")}>No events.</div>}
                    </div>
                    {filteredEvents.length > visibleEvents.length ? (
                        <div className={cl("timeline-footer")}>
                            <span>Showing {visibleEvents.length} of {filteredEvents.length}</span>
                            <button
                                className={cl("action")}
                                onClick={() => setVisibleEventCount(count => count + EVENT_PAGE_SIZE)}
                            >
                                Show more
                            </button>
                        </div>
                    ) : null}
                </section>
            </div>
        </SettingsTab>
    );
}

export default wrapTab(SurveillanceTab, "Surveillance");
