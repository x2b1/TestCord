/*
 * Equicord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import managedStyle from "./styles.css?managed";

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import ErrorBoundary from "@components/ErrorBoundary";
import { Devs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { classes } from "@utils/misc";
import definePlugin from "@utils/types";
import { Channel, Guild, User } from "@vencord/discord-types";
import {
    findComponentByCodeLazy
} from "@webpack";
import {
    ChannelStore,
    DraftType,
    GuildStore,
    Menu,
    MessageActions,
    MessageStore,
    RelationshipStore,
    React,
    SelectedChannelStore,
    Toasts,
    UploadHandler,
    UserStore,
    showToast,
    useEffect,
    useRef,
    useState,
    useStateFromStores
} from "@webpack/common";
import { JSX } from "react";

import {
    dispatchClearPanes,
    dispatchClosePane,
    dispatchMovePane,
    dispatchOpenChannelPane,
    dispatchOpenUserPane,
    dispatchRetargetPane,
    dispatchSetFocusedPane,
    dispatchSetColumnSplit,
    dispatchSetLayout,
    dispatchSetRowSplit,
    MAIN_PANE_ID,
    MultiChatWindowsStore
} from "./store";

const cl = classNameFactory("vc-multi-chat-");

const FullChannelView = findComponentByCodeLazy(/showFollowButton:\i\?\.type===/);
const SWAP_THROTTLE_MS = 16;
const DRAG_START_DISTANCE = 3;
type ResizeCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
let WorkspaceBypassContext: ReturnType<typeof React.createContext<boolean>> | null = null;
let hoveredUploadChannelId: string | null = null;

function getWorkspaceBypassContext() {
    return WorkspaceBypassContext ??= React.createContext(false);
}

interface PaneMeta {
    id: string;
    channelId: string;
    guildId: string;
    isMain: boolean;
}

function getPaneMeta(channelId: string, guildId?: string | null, isMain = false): PaneMeta | null {
    const channel = ChannelStore.getChannel(channelId);
    if (!channel) return null;

    if (channel.isPrivate()) {
        const recipientId = channel.getRecipientId?.();
        const user = recipientId ? UserStore.getUser(recipientId) : null;
        const title = channel.name
            || (recipientId ? RelationshipStore.getNickname(recipientId) : null)
            || user?.globalName
            || user?.username
            || "Direct Message";

        return {
            id: isMain ? MAIN_PANE_ID : channel.id,
            channelId: channel.id,
            guildId: "@me",
            isMain
        };
    }

    const guild = GuildStore.getGuild(guildId || channel.guild_id);
    const parentChannel = channel.parent_id ? ChannelStore.getChannel(channel.parent_id) : null;

    return {
        id: isMain ? MAIN_PANE_ID : channel.id,
        channelId: channel.id,
        guildId: guild?.id ?? "@me",
        isMain
    };
}

function insertMenuItemBefore(children: Array<JSX.Element | null>, targetId: string, item: JSX.Element) {
    const container = findGroupChildrenByChildId(targetId, children);
    if (!container) return false;

    const index = container.findIndex(child => child?.props?.id === targetId);
    if (index === -1) return false;

    container.splice(index, 0, item);
    return true;
}

function insertMenuItemFallback(children: Array<JSX.Element | null>, item: JSX.Element) {
    children.splice(-1, 0, (
        <Menu.MenuGroup key={`vc-multi-chat-group-${item.props.id}`}>
            {item}
        </Menu.MenuGroup>
    ));
}

function openPaneForChannel(channel: Channel | null | undefined) {
    if (!channel?.id) return;

    if (channel.id === SelectedChannelStore.getChannelId()) {
        showToast("That chat is already your main pane.", Toasts.Type.MESSAGE);
        return;
    }

    dispatchOpenChannelPane(channel.id, channel.guild_id);
    showToast("Opened chat pane.", Toasts.Type.SUCCESS);
}

function clampSplit(value: number) {
    return Math.min(0.8, Math.max(0.2, value));
}

function hasDraggedFiles(dataTransfer: DataTransfer | null | undefined) {
    return !!dataTransfer?.files?.length;
}

function stopDragEvent(event: Pick<DragEvent, "preventDefault" | "stopPropagation" | "stopImmediatePropagation">) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
}

function uploadFilesToChannel(channelId: string, files: File[]) {
    const channel = ChannelStore.getChannel(channelId);
    if (!channel || !files.length) return;

    setTimeout(() => UploadHandler.promptToUpload(files, channel, DraftType.ChannelMessage), 0);
}

function getPaneChannelIdAtPoint(clientX: number, clientY: number) {
    const pane = getPaneElementAtPoint(clientX, clientY);
    return pane?.dataset.channelId ?? null;
}

function getPaneElementAtPoint(clientX: number, clientY: number) {
    const panes = document.querySelectorAll(`.${cl("pane")}`);

    for (const pane of panes) {
        const rect = (pane as HTMLElement).getBoundingClientRect();
        if (
            clientX >= rect.left
            && clientX <= rect.right
            && clientY >= rect.top
            && clientY <= rect.bottom
        ) {
            return pane as HTMLElement;
        }
    }

    const element = document.elementFromPoint(clientX, clientY);
    return element?.closest?.(`.${cl("pane")}`) as HTMLElement | null;
}

function getResponsiveGrid(layout: 2 | 4 | 8, count: number, width: number, height: number) {
    const maxColumns = layout === 8 ? 4 : 2;
    const safeCount = Math.max(count, 1);
    const aspectRatio = width > 0 && height > 0 ? width / height : 1;
    const idealColumns = Math.round(Math.sqrt(safeCount * aspectRatio));
    const columns = Math.max(1, Math.min(maxColumns, safeCount, idealColumns || 1));
    const rows = Math.ceil(safeCount / columns);

    return { columns, rows };
}

function getPaneResizeCorner(layout: 2 | 4 | 8, paneIndex: number, paneCount: number, isSpanningFullRow: boolean): ResizeCorner | null {
    if (layout === 8 || paneCount < 2) return null;

    if (layout === 2) {
        return paneIndex === 0 ? "bottom-right" : "bottom-left";
    }

    if (isSpanningFullRow) {
        return "top-left";
    }

    if (paneIndex === 0) return "bottom-right";
    if (paneIndex === 1) return "bottom-left";
    if (paneIndex === 2) return "top-right";
    if (paneIndex === 3) return "top-left";
    return null;
}

function shouldIgnorePaneDragStart(target: HTMLElement | null) {
    return !!target?.closest([
        `.${cl("resize-handle")}`,
        "input",
        "textarea",
        "select",
        "[contenteditable='true']"
    ].join(","));
}

function isPaneOpen(channelId: string) {
    return MultiChatWindowsStore.getState().panes.some(pane => pane.channelId === channelId);
}

function buildPaneMenuItem(channelId: string, openAction: () => void) {
    return (
        <Menu.MenuItem
            id={`vc-multi-chat-${channelId}`}
            label="Multi Chat"
        >
            {!isPaneOpen(channelId) && (
                <Menu.MenuItem
                    id={`vc-multi-chat-open-${channelId}`}
                    label="Open in Pane"
                    action={openAction}
                />
            )}
            {isPaneOpen(channelId) && (
                <Menu.MenuItem
                    id={`vc-multi-chat-close-${channelId}`}
                    label="Close This Pane"
                    color="danger"
                    action={() => dispatchClosePane(channelId)}
                />
            )}
            <Menu.MenuSeparator />
            <Menu.MenuItem
                id="vc-multi-chat-layout-two"
                label="Use 2 Pane Layout"
                action={() => dispatchSetLayout(2)}
            />
            <Menu.MenuItem
                id="vc-multi-chat-layout-four"
                label="Use 4 Pane Layout"
                action={() => dispatchSetLayout(4)}
            />
            <Menu.MenuItem
                id="vc-multi-chat-layout-eight"
                label="Use 8 Pane Layout"
                action={() => dispatchSetLayout(8)}
            />
            <Menu.MenuSeparator />
            <Menu.MenuItem
                id="vc-multi-chat-close-all"
                label="Close All Panes"
                color="danger"
                action={() => dispatchClearPanes()}
            />
        </Menu.MenuItem>
    );
}

const ChannelContextPatch: NavContextMenuPatchCallback = (children, { channel }: { channel?: Channel; }) => {
    if (!channel) return;

    const item = buildPaneMenuItem(channel.id, () => openPaneForChannel(channel));

    if (!insertMenuItemBefore(children, "channel-copy-link", item)) {
        insertMenuItemFallback(children, item);
    }
};

const UserContextPatch: NavContextMenuPatchCallback = (children, { user }: { user?: User; }) => {
    const currentUserId = UserStore.getCurrentUser()?.id;
    if (!user || user.id === currentUserId) return;

    const item = buildPaneMenuItem(user.id, () => {
        dispatchOpenUserPane(user.id);
        showToast("Opened DM pane.", Toasts.Type.SUCCESS);
    });

    if (!insertMenuItemBefore(children, "close-dm", item)) {
        insertMenuItemFallback(children, item);
    }
};

const GroupDmContextPatch: NavContextMenuPatchCallback = (children, { channel }: { channel?: Channel; }) => {
    if (!channel) return;

    const item = buildPaneMenuItem(channel.id, () => openPaneForChannel(channel));

    if (!insertMenuItemBefore(children, "leave-channel", item)) {
        insertMenuItemFallback(children, item);
    }
};

function PaneShell({
    pane,
    paneOrder,
    orderIndex,
    layout,
    isSpanningFullRow,
    isFocused,
    canResizeColumn,
    canResizeRow,
    resizeCorner,
    resolveSplitValue,
    onPreviewColumnSplit,
    onPreviewRowSplit,
    onCommitColumnSplit,
    onCommitRowSplit,
    children
}: {
    pane: PaneMeta;
    paneOrder: string[];
    orderIndex: number;
    layout: 2 | 4 | 8;
    isSpanningFullRow: boolean;
    isFocused: boolean;
    canResizeColumn: boolean;
    canResizeRow: boolean;
    resizeCorner: ResizeCorner | null;
    resolveSplitValue: (axis: "column" | "row", event: MouseEvent) => number | null;
    onPreviewColumnSplit: (value: number) => void;
    onPreviewRowSplit: (value: number) => void;
    onCommitColumnSplit: (value: number) => void;
    onCommitRowSplit: (value: number) => void;
    children: JSX.Element;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const paneOrderRef = useRef(paneOrder);
    const layoutRef = useRef(layout);
    const lastSwapTimeRef = useRef(0);
    const [isDraggingPane, setIsDraggingPane] = useState(false);

    useEffect(() => {
        paneOrderRef.current = paneOrder;
    }, [paneOrder]);

    useEffect(() => {
        layoutRef.current = layout;
    }, [layout]);

    return (
        <div
            ref={ref}
            className={cl("pane")}
            style={{ order: orderIndex }}
            data-main={pane.isMain}
            data-pane-id={pane.id}
            data-channel-id={pane.channelId}
            data-dragging={isDraggingPane}
            data-span-full={isSpanningFullRow}
            data-focused={isFocused}
            onMouseDown={() => dispatchSetFocusedPane(pane.id)}
            onFocusCapture={() => dispatchSetFocusedPane(pane.id)}
            onMouseDownCapture={event => {
                if (event.button !== 0) return;

                const target = event.target as HTMLElement | null;
                if (shouldIgnorePaneDragStart(target)) return;

                const startX = event.clientX;
                const startY = event.clientY;
                const draggedId = pane.id;
                let isDragging = false;

                const handleMouseMove = (moveEvent: MouseEvent) => {
                    const distance = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
                    if (!isDragging && distance < DRAG_START_DISTANCE) {
                        return;
                    }

                    if (!isDragging) {
                        isDragging = true;
                        setIsDraggingPane(true);
                        lastSwapTimeRef.current = Date.now() - SWAP_THROTTLE_MS;
                        ref.current?.style.setProperty("pointer-events", "none");
                        document.body.style.userSelect = "none";
                        document.body.style.cursor = "grabbing";
                    }

                    moveEvent.preventDefault();

                    const hoveredPane = getPaneElementAtPoint(moveEvent.clientX, moveEvent.clientY);
                    const hoveredId = hoveredPane?.dataset.paneId;
                    if (!hoveredId || hoveredId === draggedId) return;

                    const order = paneOrderRef.current;
                    const dragIndex = order.indexOf(draggedId);
                    const hoverIndex = order.indexOf(hoveredId);
                    if (dragIndex === -1 || hoverIndex === -1 || dragIndex === hoverIndex) return;

                    const now = Date.now();
                    if (now - lastSwapTimeRef.current < SWAP_THROTTLE_MS) return;

                    lastSwapTimeRef.current = now;
                    dispatchMovePane(draggedId, hoveredId, hoverIndex > dragIndex ? "after" : "before");
                };

                const handleMouseUp = () => {
                    document.removeEventListener("mousemove", handleMouseMove);
                    document.removeEventListener("mouseup", handleMouseUp);
                    ref.current?.style.removeProperty("pointer-events");
                    document.body.style.userSelect = "";
                    document.body.style.cursor = "";
                    setIsDraggingPane(false);
                    lastSwapTimeRef.current = 0;
                };

                document.addEventListener("mousemove", handleMouseMove);
                document.addEventListener("mouseup", handleMouseUp);
            }}
            onDragEnterCapture={event => {
                if (!hasDraggedFiles(event.dataTransfer)) return;

                dispatchSetFocusedPane(pane.id);
                hoveredUploadChannelId = pane.channelId;
                stopDragEvent(event.nativeEvent);
            }}
            onDragOverCapture={event => {
                if (!hasDraggedFiles(event.dataTransfer)) return;

                dispatchSetFocusedPane(pane.id);
                hoveredUploadChannelId = pane.channelId;
                stopDragEvent(event.nativeEvent);
            }}
            onDropCapture={event => {
                if (!hasDraggedFiles(event.dataTransfer)) return;

                dispatchSetFocusedPane(pane.id);
                hoveredUploadChannelId = pane.channelId;
                uploadFilesToChannel(pane.channelId, Array.from(event.dataTransfer?.files ?? []));
                stopDragEvent(event.nativeEvent);
            }}
        >
            {resizeCorner && (
                <button
                    type="button"
                    className={classes(cl("resize-handle"), cl(`resize-${resizeCorner}`))}
                    aria-label="Resize pane"
                    onMouseDown={event => {
                        event.preventDefault();
                        event.stopPropagation();
                        dispatchSetFocusedPane(pane.id);

                        const move = (moveEvent: MouseEvent) => {
                            if (canResizeColumn) {
                                const value = resolveSplitValue("column", moveEvent);
                                if (value != null) {
                                    onPreviewColumnSplit(value);
                                }
                            }

                            if (canResizeRow) {
                                const value = resolveSplitValue("row", moveEvent);
                                if (value != null) {
                                    onPreviewRowSplit(value);
                                }
                            }
                        };

                        const up = (upEvent: MouseEvent) => {
                            window.removeEventListener("mousemove", move);
                            window.removeEventListener("mouseup", up);

                            if (canResizeColumn) {
                                const value = resolveSplitValue("column", upEvent);
                                if (value != null) {
                                    onPreviewColumnSplit(value);
                                    onCommitColumnSplit(value);
                                }
                            }

                            if (canResizeRow) {
                                const value = resolveSplitValue("row", upEvent);
                                if (value != null) {
                                    onPreviewRowSplit(value);
                                    onCommitRowSplit(value);
                                }
                            }
                        };

                        window.addEventListener("mousemove", move);
                        window.addEventListener("mouseup", up);
                    }}
                />
            )}
            <div className={cl("pane-body")}>
                {children}
            </div>
        </div>
    );
}

const PaneChannelView = ErrorBoundary.wrap(({ paneId, channelId, guildId }: { paneId: string; channelId: string; guildId: string; }) => {
    const { channel } = useStateFromStores([ChannelStore, GuildStore], () => ({
        channel: ChannelStore.getChannel(channelId),
        guild: GuildStore.getGuild(guildId)
    }), [channelId, guildId]);

    useEffect(() => {
        if (!channel?.id || MessageStore.getLastMessage(channel.id)) return;

        MessageActions.fetchMessages({
            channelId: channel.id,
            limit: 50
        });
    }, [channel?.id]);

    if (!channel) {
        return <div className={cl("empty-slot")}>This pane is no longer available.</div>;
    }

    const Context = getWorkspaceBypassContext();
    return (
        <div
            onClickCapture={event => {
                if (paneId === MAIN_PANE_ID || !channel?.isForumLikeChannel?.()) return;

                const target = event.target as HTMLElement | null;
                const forumCard = target?.closest?.("[data-item-id]") as HTMLElement | null;
                const nextChannelId = forumCard?.dataset.itemId;
                if (!nextChannelId) return;

                const nextChannel = ChannelStore.getChannel(nextChannelId);
                event.preventDefault();
                event.stopPropagation();
                dispatchRetargetPane(channel.id, nextChannelId, nextChannel?.guild_id ?? channel.guild_id);
            }}
        >
            <Context.Provider value={true}>
                <FullChannelView providedChannel={channel} />
            </Context.Provider>
        </div>
    );
}, { noop: true });

const WorkspaceRoot = ErrorBoundary.wrap(({ channel, guild, chat }: { channel?: Channel | null; guild?: Guild | null; chat: JSX.Element; }) => {
    const bypassWorkspace = React.useContext(getWorkspaceBypassContext());

    if (!channel?.id) {
        return chat;
    }

    if (bypassWorkspace) {
        return chat;
    }

    const workspaceState = useStateFromStores([MultiChatWindowsStore], () => MultiChatWindowsStore.getState(), []);
    const workspaceRef = useRef<HTMLDivElement>(null);
    const [columnSplit, setColumnSplit] = useState(workspaceState.columnSplit);
    const [rowSplit, setRowSplit] = useState(workspaceState.rowSplit);
    const [isWindowFocused, setIsWindowFocused] = useState(document.hasFocus());
    const [workspaceSize, setWorkspaceSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        setColumnSplit(workspaceState.columnSplit);
    }, [workspaceState.columnSplit]);

    useEffect(() => {
        setRowSplit(workspaceState.rowSplit);
    }, [workspaceState.rowSplit]);

    useEffect(() => {
        const chatRoot = workspaceRef.current?.closest("div[class*='chat_']");
        chatRoot?.classList.add(cl("chat-root"));

        const handleWindowFocus = () => setIsWindowFocused(true);
        const handleWindowBlur = () => setIsWindowFocused(false);

        const handleDragOver = (event: DragEvent) => {
            if (!hasDraggedFiles(event.dataTransfer)) return;

            const channelId = getPaneChannelIdAtPoint(event.clientX, event.clientY);
            hoveredUploadChannelId = channelId;
            if (channelId) {
                const paneId = channelId === channel.id ? MAIN_PANE_ID : channelId;
                dispatchSetFocusedPane(paneId);
            }
            if (!channelId) return;

            stopDragEvent(event);
        };

        const handleDrop = (event: DragEvent) => {
            if (!hasDraggedFiles(event.dataTransfer)) return;

            const channelId = hoveredUploadChannelId ?? getPaneChannelIdAtPoint(event.clientX, event.clientY);
            if (!channelId) return;

            const files = Array.from(event.dataTransfer?.files ?? []);
            const paneId = channelId === channel.id ? MAIN_PANE_ID : channelId;
            dispatchSetFocusedPane(paneId);
            stopDragEvent(event);
            uploadFilesToChannel(channelId, files);
        };

        window.addEventListener("focus", handleWindowFocus);
        window.addEventListener("blur", handleWindowBlur);
        window.addEventListener("dragover", handleDragOver, true);
        window.addEventListener("drop", handleDrop, true);

        return () => {
            window.removeEventListener("focus", handleWindowFocus);
            window.removeEventListener("blur", handleWindowBlur);
            window.removeEventListener("dragover", handleDragOver, true);
            window.removeEventListener("drop", handleDrop, true);
            chatRoot?.classList.remove(cl("chat-root"));
            hoveredUploadChannelId = null;
        };
    }, []);

    useEffect(() => {
        const element = workspaceRef.current;
        if (!element) return;

        const updateSize = () => {
            const rect = element.getBoundingClientRect();
            setWorkspaceSize({
                width: rect.width,
                height: rect.height
            });
        };

        updateSize();

        const observer = new ResizeObserver(() => updateSize());
        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    const mainPane = getPaneMeta(channel.id, guild?.id ?? channel.guild_id, true);
    if (!mainPane || workspaceState.panes.length === 0) {
        return chat;
    }

    const extraPanes = workspaceState.panes
        .filter(pane => pane.channelId !== channel.id)
        .map(pane => getPaneMeta(pane.channelId, pane.guildId))
        .filter((pane): pane is PaneMeta => pane != null);

    if (extraPanes.length === 0) {
        return chat;
    }

    const paneMap = new Map<string, PaneMeta>([
        [mainPane.id, mainPane],
        ...extraPanes.map(pane => [pane.id, pane] as const)
    ]);

    const orderedPanes = workspaceState.order
        .map(paneId => paneMap.get(paneId))
        .filter((pane): pane is PaneMeta => pane != null);
    const orderedPaneIds = orderedPanes.map(({ id }) => id);
    const stablePanes = [mainPane, ...extraPanes].sort((a, b) => a.id.localeCompare(b.id));

    const responsiveGrid = workspaceState.layout === 8
        ? getResponsiveGrid(8, orderedPanes.length, workspaceSize.width, workspaceSize.height)
        : getResponsiveGrid(workspaceState.layout, orderedPanes.length, workspaceSize.width, workspaceSize.height);
    const showColumnResize = workspaceState.layout !== 8 && responsiveGrid.columns === 2 && orderedPanes.length >= 2;
    const showRowResize = workspaceState.layout !== 8 && responsiveGrid.rows === 2 && orderedPanes.length >= 3;

    const resolveSplitValue = (axis: "column" | "row", event: MouseEvent) => {
        const rect = workspaceRef.current?.getBoundingClientRect();
        if (!rect) return null;

        if (axis === "column") {
            return clampSplit((event.clientX - rect.left) / rect.width);
        }

        return clampSplit((event.clientY - rect.top) / rect.height);
    };

    const style = {
        "--vc-multi-chat-column-split": `${columnSplit * 100}%`,
        "--vc-multi-chat-row-split": `${rowSplit * 100}%`,
        gridTemplateColumns: showColumnResize
            ? `${columnSplit * 100}% ${(1 - columnSplit) * 100}%`
            : `repeat(${responsiveGrid.columns}, minmax(0, 1fr))`,
        gridTemplateRows: showRowResize
            ? `${rowSplit * 100}% ${(1 - rowSplit) * 100}%`
            : `repeat(${responsiveGrid.rows}, minmax(0, 1fr))`
    } as JSX.IntrinsicElements["div"]["style"];

    return (
        <div
            ref={workspaceRef}
            className={cl("workspace")}
            data-layout={workspaceState.layout}
            data-count={orderedPanes.length}
            data-window-focused={isWindowFocused}
            style={style}
        >
            {stablePanes.map(pane => (
                (() => {
                    const orderIndex = orderedPaneIds.indexOf(pane.id);
                    const isSpanningFullRow = responsiveGrid.columns === 2 && responsiveGrid.rows === 2 && orderedPanes.length === 3 && orderedPaneIds[2] === pane.id;
                    const resizeCorner = getPaneResizeCorner(workspaceState.layout, orderIndex, orderedPanes.length, isSpanningFullRow);
                    const canResizeColumn = showColumnResize && !isSpanningFullRow;
                    const canResizeRow = showRowResize && (workspaceState.layout !== 4 || orderIndex <= 1 || isSpanningFullRow);

                    return (
                        <PaneShell
                            key={pane.id}
                            pane={pane}
                            paneOrder={orderedPaneIds}
                            orderIndex={orderIndex}
                            layout={workspaceState.layout}
                            isSpanningFullRow={isSpanningFullRow}
                            isFocused={workspaceState.focusedPaneId === pane.id}
                            canResizeColumn={canResizeColumn}
                            canResizeRow={canResizeRow}
                            resizeCorner={resizeCorner}
                            resolveSplitValue={resolveSplitValue}
                            onPreviewColumnSplit={setColumnSplit}
                            onPreviewRowSplit={setRowSplit}
                            onCommitColumnSplit={dispatchSetColumnSplit}
                            onCommitRowSplit={dispatchSetRowSplit}
                        >
                            <PaneChannelView
                                paneId={pane.id}
                                channelId={pane.channelId}
                                guildId={pane.guildId}
                            />
                        </PaneShell>
                    );
                })()
            ))}
        </div>
    );
}, { noop: true });

export default definePlugin({
    name: "MultiChatWindows",
    description: "Tile your current chat with extra live chat panes and drag them into place.",
    authors: [Devs.Ven],
    dependencies: ["ContextMenuAPI"],
    managedStyle,
    contextMenus: {
        "channel-context": ChannelContextPatch,
        "thread-context": ChannelContextPatch,
        "gdm-context": GroupDmContextPatch,
        "user-context": UserContextPatch
    },
    patches: [
        {
            find: "Missing channel in Channel.renderChat",
            replacement: {
                match: /(?<=return)(\(0,\i\.jsx\)\((\i)\.A,{channel:e,guild:t,chatInputType:(\i)\.\i\.NORMAL},null!=t\?t\.id:"home"\))/,
                replace: " $self.renderWorkspace({channel:e,guild:t,chat:$1})"
            }
        }
    ],

    renderWorkspace({ channel, guild, chat }: { channel?: Channel | null; guild?: Guild | null; chat: JSX.Element; }) {
        return <WorkspaceRoot channel={channel} guild={guild} chat={chat} />;
    }
});
