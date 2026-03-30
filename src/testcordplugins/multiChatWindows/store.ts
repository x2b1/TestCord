/*
 * Equicord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { proxyLazy } from "@utils/lazy";
import { Flux as TFlux } from "@vencord/discord-types";
import { ChannelActionCreators, Flux as FluxWP, FluxDispatcher } from "@webpack/common";

export const MAIN_PANE_ID = "__vc_multi_chat_main__";

export type WorkspaceLayout = 2 | 4 | 8;

export interface WorkspacePane {
    channelId: string;
    guildId: string;
}

interface PersistedState {
    panes?: WorkspacePane[];
    order?: string[];
    layout?: WorkspaceLayout;
    columnSplit?: number;
    rowSplit?: number;
    focusedPaneId?: string;
}

interface WorkspaceState {
    panes: WorkspacePane[];
    order: string[];
    layout: WorkspaceLayout;
    columnSplit: number;
    rowSplit: number;
    focusedPaneId: string;
}

interface IFlux extends TFlux {
    PersistedStore: TFlux["Store"];
}

const current: WorkspaceState = {
    panes: [],
    order: [MAIN_PANE_ID],
    layout: 2,
    columnSplit: 0.5,
    rowSplit: 0.5,
    focusedPaneId: MAIN_PANE_ID
};

function getPaneLimit(layout: WorkspaceLayout) {
    return layout - 1;
}

function normalizeState() {
    const paneMap = new Map<string, WorkspacePane>();

    for (const pane of current.panes) {
        if (!pane.channelId) continue;
        paneMap.set(pane.channelId, {
            channelId: pane.channelId,
            guildId: pane.guildId || "@me"
        });
    }

    const normalizedOrder: string[] = [];

    for (const paneId of current.order) {
        if (normalizedOrder.includes(paneId)) continue;

        if (paneId === MAIN_PANE_ID) {
            normalizedOrder.push(MAIN_PANE_ID);
            continue;
        }

        if (!paneMap.has(paneId)) continue;
        normalizedOrder.push(paneId);
    }

    if (!normalizedOrder.includes(MAIN_PANE_ID)) {
        normalizedOrder.push(MAIN_PANE_ID);
    }

    for (const paneId of paneMap.keys()) {
        if (!normalizedOrder.includes(paneId)) {
            normalizedOrder.push(paneId);
        }
    }

    current.panes = normalizedOrder
        .filter(paneId => paneId !== MAIN_PANE_ID)
        .map(paneId => paneMap.get(paneId))
        .filter((pane): pane is WorkspacePane => pane != null);
    current.order = normalizedOrder;

    if (!current.order.includes(current.focusedPaneId)) {
        current.focusedPaneId = current.order[0] ?? MAIN_PANE_ID;
    }
}

function getVisiblePaneIds() {
    return current.order
        .filter(paneId => paneId !== MAIN_PANE_ID)
        .slice(0, getPaneLimit(current.layout));
}

function getVisibleState() {
    const visiblePaneIds = getVisiblePaneIds();

    return {
        panes: visiblePaneIds
            .map(paneId => current.panes.find(pane => pane.channelId === paneId))
            .filter((pane): pane is WorkspacePane => pane != null),
        order: current.order.filter(paneId => paneId === MAIN_PANE_ID || visiblePaneIds.includes(paneId)),
        layout: current.layout,
        columnSplit: current.columnSplit,
        rowSplit: current.rowSplit,
        focusedPaneId: current.focusedPaneId
    };
}

function openPane(channelId: string, guildId?: string | null) {
    const normalizedGuildId = guildId || "@me";
    const existingPane = current.panes.find(pane => pane.channelId === channelId);

    if (existingPane) {
        existingPane.guildId = normalizedGuildId;
        current.order = [
            ...current.order.filter(paneId => paneId !== channelId),
            channelId
        ];
    } else {
        current.panes.push({
            channelId,
            guildId: normalizedGuildId
        });

        const mainIndex = current.order.indexOf(MAIN_PANE_ID);
        current.order.splice(mainIndex + 1, 0, channelId);
    }

    if (current.layout === 2 && current.panes.length > 1) {
        current.layout = 4;
    }

    if (current.layout === 4 && current.panes.length > 3) {
        current.layout = 8;
    }

    normalizeState();
}

function closePane(channelId: string) {
    current.panes = current.panes.filter(pane => pane.channelId !== channelId);
    current.order = current.order.filter(paneId => paneId !== channelId);
    normalizeState();
}

function movePane(sourceId: string, targetId: string, position: "before" | "after" = "before") {
    if (sourceId === targetId) return;

    const nextOrder = current.order.filter(paneId => paneId !== sourceId);
    const targetIndex = nextOrder.indexOf(targetId);

    if (targetIndex === -1) return;

    nextOrder.splice(targetIndex + (position === "after" ? 1 : 0), 0, sourceId);
    current.order = nextOrder;
    normalizeState();
}

function retargetPane(sourceId: string, targetId: string, guildId?: string | null) {
    if (sourceId === MAIN_PANE_ID || sourceId === targetId) return;

    const pane = current.panes.find(pane => pane.channelId === sourceId);
    if (!pane) return;

    pane.channelId = targetId;
    pane.guildId = guildId || "@me";
    current.order = current.order.map(paneId => paneId === sourceId ? targetId : paneId);
    normalizeState();
}

function clearPanes() {
    current.panes = [];
    current.order = [MAIN_PANE_ID];
}

function setLayout(layout: WorkspaceLayout) {
    current.layout = layout;
    normalizeState();
}

function setColumnSplit(value: number) {
    current.columnSplit = Math.min(0.8, Math.max(0.2, value));
}

function setRowSplit(value: number) {
    current.rowSplit = Math.min(0.8, Math.max(0.2, value));
}

function setFocusedPane(paneId: string) {
    if (!current.order.includes(paneId)) return;
    current.focusedPaneId = paneId;
}

export const MultiChatWindowsStore = proxyLazy(() => {
    class MultiChatWindowsStore extends (FluxWP as IFlux).PersistedStore {
        static persistKey = "MultiChatWindowsStore";

        initialize(previousState: PersistedState | undefined) {
            if (!previousState) return;

            current.panes = previousState.panes ?? [];
            current.order = previousState.order ?? [MAIN_PANE_ID];
            current.layout = previousState.layout === 8
                ? 8
                : previousState.layout === 4
                    ? 4
                    : 2;
            current.columnSplit = previousState.columnSplit ?? 0.5;
            current.rowSplit = previousState.rowSplit ?? 0.5;
            current.focusedPaneId = previousState.focusedPaneId ?? MAIN_PANE_ID;
            normalizeState();
        }

        getState() {
            const state = getVisibleState();

            return {
                panes: [...state.panes],
                order: [...state.order],
                layout: state.layout,
                columnSplit: state.columnSplit,
                rowSplit: state.rowSplit,
                focusedPaneId: state.focusedPaneId
            };
        }
    }

    const store = new MultiChatWindowsStore(FluxDispatcher, {
        VC_MULTI_CHAT_OPEN_CHANNEL({ channelId, guildId }: { channelId: string; guildId?: string | null; }) {
            openPane(channelId, guildId);
            store.emitChange();
        },
        async VC_MULTI_CHAT_OPEN_USER({ userId }: { userId: string; }) {
            const channelId = await ChannelActionCreators.getOrEnsurePrivateChannel(userId);
            openPane(channelId, "@me");
            store.emitChange();
        },
        VC_MULTI_CHAT_CLOSE_PANE({ channelId }: { channelId: string; }) {
            closePane(channelId);
            store.emitChange();
        },
        VC_MULTI_CHAT_MOVE_PANE({ sourceId, targetId, position }: { sourceId: string; targetId: string; position?: "before" | "after"; }) {
            movePane(sourceId, targetId, position);
            store.emitChange();
        },
        VC_MULTI_CHAT_RETARGET_PANE({ sourceId, targetId, guildId }: { sourceId: string; targetId: string; guildId?: string | null; }) {
            retargetPane(sourceId, targetId, guildId);
            store.emitChange();
        },
        VC_MULTI_CHAT_CLEAR() {
            clearPanes();
            store.emitChange();
        },
        VC_MULTI_CHAT_SET_LAYOUT({ layout }: { layout: WorkspaceLayout; }) {
            setLayout(layout);
            store.emitChange();
        },
        VC_MULTI_CHAT_SET_COLUMN_SPLIT({ value }: { value: number; }) {
            setColumnSplit(value);
            store.emitChange();
        },
        VC_MULTI_CHAT_SET_ROW_SPLIT({ value }: { value: number; }) {
            setRowSplit(value);
            store.emitChange();
        },
        VC_MULTI_CHAT_SET_FOCUSED_PANE({ paneId }: { paneId: string; }) {
            setFocusedPane(paneId);
            store.emitChange();
        },
    });

    return store;
});

export function dispatchOpenChannelPane(channelId: string, guildId?: string | null) {
    FluxDispatcher.dispatch({
        type: "VC_MULTI_CHAT_OPEN_CHANNEL",
        channelId,
        guildId
    });
}

export function dispatchOpenUserPane(userId: string) {
    FluxDispatcher.dispatch({
        type: "VC_MULTI_CHAT_OPEN_USER",
        userId
    });
}

export function dispatchClosePane(channelId: string) {
    FluxDispatcher.dispatch({
        type: "VC_MULTI_CHAT_CLOSE_PANE",
        channelId
    });
}

export function dispatchMovePane(sourceId: string, targetId: string, position: "before" | "after" = "before") {
    FluxDispatcher.dispatch({
        type: "VC_MULTI_CHAT_MOVE_PANE",
        sourceId,
        targetId,
        position
    });
}

export function dispatchRetargetPane(sourceId: string, targetId: string, guildId?: string | null) {
    FluxDispatcher.dispatch({
        type: "VC_MULTI_CHAT_RETARGET_PANE",
        sourceId,
        targetId,
        guildId
    });
}

export function dispatchClearPanes() {
    FluxDispatcher.dispatch({
        type: "VC_MULTI_CHAT_CLEAR"
    });
}

export function dispatchSetLayout(layout: WorkspaceLayout) {
    FluxDispatcher.dispatch({
        type: "VC_MULTI_CHAT_SET_LAYOUT",
        layout
    });
}

export function dispatchSetColumnSplit(value: number) {
    FluxDispatcher.dispatch({
        type: "VC_MULTI_CHAT_SET_COLUMN_SPLIT",
        value
    });
}

export function dispatchSetRowSplit(value: number) {
    FluxDispatcher.dispatch({
        type: "VC_MULTI_CHAT_SET_ROW_SPLIT",
        value
    });
}

export function dispatchSetFocusedPane(paneId: string) {
    FluxDispatcher.dispatch({
        type: "VC_MULTI_CHAT_SET_FOCUSED_PANE",
        paneId
    });
}
