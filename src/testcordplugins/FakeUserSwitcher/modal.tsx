/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Flex } from "@components/Flex";
import { FormSwitch } from "@components/FormSwitch";
import { Span } from "@components/Span";
import { fetchUserProfile } from "@utils/discord";
import { ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, ModalSize } from "@utils/modal";
import { Button, React, Select, showToast, Toasts, UserProfileStore, UserStore, UserUtils } from "@webpack/common";

import { clearTarget, getCachedTarget, getSavedUsers, isActive, loadTarget, notify, setEnabled, setSavedUsers, settings, subscribe } from "./data";

const ID_RE = /^\d{17,20}$/;

export function FakeUserSwitcherModal({ modalProps }: { modalProps: ModalProps; }) {
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);

    React.useEffect(() => subscribe(() => forceUpdate()), []);

    const [inputId, setInputId] = React.useState("");
    const [loading, setLoading] = React.useState(false);
    const [previewUser, setPreviewUser] = React.useState<any>(getCachedTarget()?.user ?? null);
    const [previewProfile, setPreviewProfile] = React.useState<any>(getCachedTarget()?.profile ?? null);
    const [saved, setSaved] = React.useState(getSavedUsers());
    const [searchQuery, setSearchQuery] = React.useState("");
    const [compact, setCompact] = React.useState(false);
    const [compactHovered, setCompactHovered] = React.useState(false);
    const [manualExpanded, setManualExpanded] = React.useState(settings.store.manualExpanded);
    const [configExpanded, setConfigExpanded] = React.useState(settings.store.configExpanded);

    const active = isActive();
    const currentTargetId = settings.store.targetId;

    const Col = {
        primary: "#e0e1e5",
        muted: "#a0a4ae",
        section: "#72757e",
        online: "#23a55a",
        idle: "#f0b232",
        dnd: "#f23f43",
        offline: "#80848e"
    };

    const Label = ({ children }: { children: React.ReactNode; }) => (
        <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: Col.section, marginBottom: "8px", marginTop: "4px" }}>{children}</div>
    );

    const Pfp = ({ user, size, status }: { user: any; size: number; status?: string; }) => {
        const isManual = user?.id && String(user.id).startsWith("manual_");
        let di = 0;
        if (!isManual && user?.id && user.id !== "0") {
            try { di = Number(BigInt(user.id) >> 22n) % 6; } catch { }
        }
        let src = `https://cdn.discordapp.com/embed/avatars/${di}.png`;
        if (user?.avatar) {
            if (isManual || user.avatar.startsWith("http")) {
                src = user.avatar;
            } else if (user.id && user.id !== "0") {
                src = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=${size <= 32 ? 64 : 128}`;
            }
        }

        const statusColor = status === "idle" ? Col.idle : status === "dnd" ? Col.dnd : status === "offline" ? Col.offline : Col.online;

        return (
            <div style={{ position: "relative", width: size, height: size, flexShrink: 0, transition: settings.store.disableAnimations ? "none" : "width 0.25s cubic-bezier(0.4, 0, 0.2, 1), height 0.25s cubic-bezier(0.4, 0, 0.2, 1)" }}>
                <img
                    src={src}
                    onError={e => { (e.target as HTMLImageElement).src = "https://cdn.discordapp.com/embed/avatars/0.png"; }}
                    style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                />
                {status && (
                    <div style={{
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        width: Math.max(8, Math.floor(size * 0.3)),
                        height: Math.max(8, Math.floor(size * 0.3)),
                        borderRadius: "50%",
                        backgroundColor: statusColor,
                        border: "2px solid var(--background-secondary)",
                        transition: settings.store.disableAnimations ? "none" : "width 0.25s cubic-bezier(0.4, 0, 0.2, 1), height 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
                    }} />
                )}
            </div>
        );
    };

    async function doPreview() {
        const id = inputId.trim();
        if (!id) return;
        if (!ID_RE.test(id)) {
            showToast("Invalid User ID format. Must be 17-20 digits.", Toasts.Type.FAILURE);
            return;
        }
        const me = UserStore.getCurrentUser();
        if (me && me.id === id) {
            showToast("You cannot spoof as yourself!", Toasts.Type.FAILURE);
            return;
        }
        setLoading(true);
        try {
            const u = await UserUtils.getUser(id);
            if (u) {
                setPreviewUser(u);
                try {
                    const prof = await fetchUserProfile(id, {}, false);
                    setPreviewProfile(prof);
                } catch {
                    const prof = UserProfileStore.getUserProfile(id);
                    setPreviewProfile(prof);
                }
            } else {
                showToast("User not found.", Toasts.Type.FAILURE);
            }
        } catch {
            showToast("Failed to fetch user.", Toasts.Type.FAILURE);
        }
        setLoading(false);
    }

    async function doActivate(userId?: string) {
        const id = userId || inputId.trim();
        if (!id) return;
        const me = UserStore.getCurrentUser();
        if (me && me.id === id) {
            showToast("You cannot spoof as yourself!", Toasts.Type.FAILURE);
            return;
        }
        if (id.startsWith("manual_")) {
            const savedItem = saved.find(s => s.id === id);
            if (savedItem) {
                settings.store.manualMode = true;
                settings.store.manualUsername = savedItem.name;
                settings.store.manualAvatar = savedItem.avatar || "";
                setEnabled(true);
                showToast(`Activated manual mode as ${savedItem.name}`, Toasts.Type.SUCCESS);
                forceUpdate();
            }
            return;
        }

        if (!ID_RE.test(id)) {
            showToast("Invalid User ID format. Must be 17-20 digits.", Toasts.Type.FAILURE);
            return;
        }

        setLoading(true);
        try {
            const next = await loadTarget(id);
            setEnabled(true);
            settings.store.manualMode = false;
            setPreviewUser(next.user);
            showToast(`Spoofing as ${next.user.globalName || next.user.username}`, Toasts.Type.SUCCESS);
        } catch (e: any) {
            showToast(e?.message || "Failed to load that user.", Toasts.Type.FAILURE);
        }
        setLoading(false);
    }

    function doDeactivate() {
        clearTarget();
        setPreviewUser(null);
        setPreviewProfile(null);
        showToast("Fake identity disabled.", Toasts.Type.SUCCESS);
    }

    function doRemoveSaved(id: string) {
        const list = getSavedUsers().filter(s => s.id !== id);
        setSavedUsers(list); setSaved(list);
    }

    const renderCompactButton = (
        onClick: () => void,
        title: string,
        defaultBg: string,
        hoverBg: string,
        defaultColor: string,
        hoverColor: string,
        defaultBorder: string,
        hoverBorder: string,
        children: React.ReactNode
    ) => (
        <div
            onClick={onClick}
            title={title}
            style={{
                width: "22px",
                height: "22px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                backgroundColor: defaultBg,
                color: defaultColor,
                border: `1px solid ${defaultBorder}`,
                boxSizing: "border-box",
                transition: settings.store.disableAnimations ? "none" : "background-color 0.12s ease, color 0.12s ease, border-color 0.12s ease, transform 0.1s ease",
            }}
            onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = hoverBg;
                e.currentTarget.style.color = hoverColor;
                e.currentTarget.style.borderColor = hoverBorder;
            }}
            onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = defaultBg;
                e.currentTarget.style.color = defaultColor;
                e.currentTarget.style.borderColor = defaultBorder;
            }}
            onMouseDown={e => { if (!settings.store.disableAnimations) e.currentTarget.style.transform = "scale(0.95)"; }}
            onMouseUp={e => { if (!settings.store.disableAnimations) e.currentTarget.style.transform = "scale(1)"; }}
        >
            {children}
        </div>
    );

    // Get the profile from Discord's UserProfileStore if we have a real user preview
    const getBannerUrl = (user: any, profile: any) => {
        if (!user) return null;
        if (settings.store.manualMode && user.id === "0") {
            return settings.store.manualBanner || null;
        }
        const banner = user.banner ?? profile?.banner;
        if (banner) {
            const animated = banner.startsWith("a_");
            const ext = animated ? "gif" : "png";
            return `https://cdn.discordapp.com/banners/${user.id}/${banner}.${ext}?size=600`;
        }
        return null;
    };

    // Determine currently displayable active user preview
    const activeManualUser = settings.store.manualMode && settings.store.spoofActive ? {
        id: "0",
        username: settings.store.manualUsername || "FakeUser",
        globalName: settings.store.manualUsername || "FakeUser",
        avatar: settings.store.manualAvatar || "",
        bio: settings.store.manualBio,
        pronouns: settings.store.manualPronouns,
        banner: settings.store.manualBanner,
        status: settings.store.manualStatus,
        activity: settings.store.manualActivityName,
        accentColor: undefined
    } : null;

    const displayUser = previewUser ? {
        id: previewUser.id,
        username: previewUser.username,
        globalName: previewUser.globalName || previewUser.username,
        avatar: previewUser.avatar,
        bio: previewProfile?.bio ?? "",
        pronouns: previewProfile?.pronouns ?? "",
        banner: getBannerUrl(previewUser, previewProfile),
        accentColor: previewProfile?.accentColor,
    } : activeManualUser;

    const isCurrentlyActive = (id: string, name?: string, avatar?: string | null) => {
        if (!active) return false;
        if (id.startsWith("manual_")) {
            return settings.store.manualMode && settings.store.manualUsername === name && settings.store.manualAvatar === avatar;
        }
        return !settings.store.manualMode && currentTargetId === id;
    };

    const filteredSaved = saved.filter(s => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        const displayUsername = s.username || UserStore.getUser(s.id)?.username;
        return s.name.toLowerCase().includes(query) ||
            s.id.toLowerCase().includes(query) ||
            (displayUsername && displayUsername.toLowerCase().includes(query));
    });

    return (
        <ModalRoot {...modalProps} size={ModalSize.MEDIUM}>
            {/* @ts-ignore */}
            <ModalHeader separator={false} style={{ padding: "20px 20px 0 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <svg width="22" height="22" viewBox="0 0 24 24"><path fill="#e0e1e5" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2a7.2 7.2 0 0 1-6-3.22c.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08a7.2 7.2 0 0 1-6 3.22z" /></svg>
                        <span style={{ fontSize: "20px", fontWeight: 700, color: "#e0e1e5" }}>Fake User Switcher V3</span>
                        {active && <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", color: "var(--status-danger)", backgroundColor: "rgba(237,66,69,0.15)", padding: "2px 8px", borderRadius: "4px" }}>Active</span>}
                    </div>
                    <Button color={Button.Colors.PRIMARY} size={Button.Sizes.NONE} style={{ padding: "4px 8px" }} onClick={() => modalProps.onClose()}>✕</Button>
                </div>
            </ModalHeader>

            <ModalContent style={{ padding: "16px 20px 8px 20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "8px" }}>

                    {/* Input Cloner */}
                    <div>
                        <Label>Target User ID Cloner</Label>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <input
                                type="text"
                                value={inputId}
                                onChange={e => setInputId(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") doPreview(); }}
                                placeholder="Enter a Discord User ID"
                                style={{ flex: 1, padding: "10px 14px", backgroundColor: "var(--background-tertiary)", border: "1px solid var(--border-neutral-semi-weak, rgba(255, 255, 255, 0.15))", borderRadius: "8px", color: "#dbdee1", fontSize: "14px", outline: "none", fontFamily: "var(--font-code, monospace)" }}
                            />
                            <Button size={Button.Sizes.MEDIUM} color={Button.Colors.BRAND} disabled={loading || !inputId.trim()} onClick={doPreview}>{loading ? "..." : "Preview"}</Button>
                        </div>
                    </div>

                    {/* Live Preview Card */}
                    {displayUser && (
                        <div>
                            <Label>{active && (activeManualUser || currentTargetId === displayUser.id) ? "Currently Spoofing As" : "Spoof Preview"}</Label>
                            <div style={{
                                display: "block",
                                backgroundColor: "var(--background-secondary)",
                                borderRadius: "8px",
                                border: `2px solid ${active && (activeManualUser || currentTargetId === displayUser.id) ? "var(--status-danger)" : "var(--background-modifier-accent)"}`,
                                position: "relative",
                                overflow: "hidden"
                            }}>
                                {/* Banner section */}
                                <div style={{
                                    height: "60px",
                                    backgroundColor: displayUser.banner?.startsWith("#")
                                        ? displayUser.banner
                                        : displayUser.accentColor != null
                                            ? `#${displayUser.accentColor.toString(16).padStart(6, "0")}`
                                            : "rgba(255,255,255,0.05)",
                                    backgroundImage: displayUser.banner && !displayUser.banner.startsWith("#") ? `url(${displayUser.banner})` : undefined,
                                    backgroundSize: "cover",
                                    backgroundPosition: "center",
                                    position: "relative"
                                }}>
                                    {active && (activeManualUser || currentTargetId === displayUser.id) && (
                                        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "4px", backgroundColor: "var(--status-danger)" }} />
                                    )}
                                </div>

                                <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", padding: "16px" }}>
                                    <Pfp user={displayUser} size={64} status={settings.store.manualMode ? settings.store.manualStatus : "online"} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: "18px", fontWeight: 700, color: "#e0e1e5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {displayUser.globalName || displayUser.username}
                                        </div>
                                        <div style={{ fontSize: "13px", color: Col.muted }}>
                                            @{displayUser.username}
                                        </div>
                                        {displayUser.id && displayUser.id !== "0" && (
                                            <div
                                                onClick={() => {
                                                    navigator.clipboard.writeText(displayUser.id);
                                                    showToast("Copied ID to clipboard", Toasts.Type.SUCCESS);
                                                }}
                                                style={{
                                                    display: "block",
                                                    width: "fit-content",
                                                    fontSize: "11px",
                                                    color: Col.section,
                                                    fontFamily: "var(--font-code, monospace)",
                                                    marginTop: "2px",
                                                    cursor: "pointer",
                                                    lineHeight: 1
                                                }}
                                                title="Click to copy ID"
                                            >
                                                ID: {displayUser.id}
                                            </div>
                                        )}
                                        {displayUser.pronouns && (
                                            <div style={{ fontSize: "12px", color: Col.muted, marginTop: "2px", fontStyle: "italic" }}>
                                                {displayUser.pronouns}
                                            </div>
                                        )}
                                        {displayUser.bio && (
                                            <div style={{ fontSize: "12px", color: Col.muted, marginTop: "4px", whiteSpace: "pre-wrap", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "4px" }}>
                                                {displayUser.bio}
                                            </div>
                                        )}
                                        {settings.store.manualMode && settings.store.manualActivityName && (
                                            <div style={{ fontSize: "12px", color: Col.primary, marginTop: "6px", display: "flex", gap: "4px", alignItems: "center", backgroundColor: "rgba(255,255,255,0.03)", padding: "4px 8px", borderRadius: "4px" }}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 12h12M12 6v12" /></svg>
                                                <span>
                                                    <strong>Activity:</strong> {settings.store.manualActivityName} {settings.store.manualActivityState ? `(${settings.store.manualActivityState})` : ""}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", flexShrink: 0 }}>
                                        {!(active && (activeManualUser || currentTargetId === displayUser.id)) ? (
                                            <Button size={Button.Sizes.MEDIUM} color={Button.Colors.GREEN} disabled={loading} onClick={() => doActivate(displayUser.id)}>
                                                {loading ? "..." : "Activate"}
                                            </Button>
                                        ) : (
                                            <Button size={Button.Sizes.MEDIUM} color={Button.Colors.RED} onClick={doDeactivate}>
                                                Deactivate
                                            </Button>
                                        )}
                                        {displayUser && displayUser.id !== "0" && !saved.find(s => s.id === displayUser.id) && (
                                            <Button size={Button.Sizes.MEDIUM} color={Button.Colors.PRIMARY} onClick={() => {
                                                const list = getSavedUsers();
                                                list.push({
                                                    id: displayUser.id,
                                                    name: displayUser.globalName || displayUser.username,
                                                    username: displayUser.username,
                                                    avatar: displayUser.avatar || null
                                                });
                                                setSavedUsers(list); setSaved(list);
                                                showToast("Saved profile!", Toasts.Type.SUCCESS);
                                            }}>Save</Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Saved Identities */}
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <Label>
                                {searchQuery.trim()
                                    ? `Saved Identities (${filteredSaved.length} of ${saved.length} found)`
                                    : `Saved Identities (${saved.length})`}
                            </Label>
                            {saved.length > 0 && (
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "var(--background-tertiary)", border: "1px solid var(--border-neutral-semi-weak, rgba(255, 255, 255, 0.15))", borderRadius: "4px", padding: "4px 8px" }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: Col.muted, marginLeft: "2px" }}>
                                            <circle cx="11" cy="11" r="8" />
                                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                        </svg>
                                        <input
                                            type="text"
                                            placeholder="Search..."
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            style={{
                                                backgroundColor: "transparent",
                                                border: "none",
                                                color: "#dbdee1",
                                                fontSize: "12px",
                                                outline: "none",
                                                width: "120px",
                                                padding: "2px 0"
                                            }}
                                        />
                                    </div>
                                    <div
                                        onClick={() => setCompact(!compact)}
                                        title={compact ? "Show detailed list" : "Show compact list"}
                                        style={{
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            width: "32px",
                                            height: "32px",
                                            borderRadius: "4px",
                                            color: compact ? "#ffffff" : (compactHovered ? "#ffffff" : Col.muted),
                                            backgroundColor: compact
                                                ? (compactHovered ? "var(--brand-experiment-560, #4752c4)" : "var(--brand-experiment, #5865f2)")
                                                : (compactHovered ? "rgba(255, 255, 255, 0.08)" : "transparent"),
                                            transition: settings.store.disableAnimations ? "none" : "color 0.15s ease, background-color 0.15s ease",
                                        }}
                                        onMouseEnter={() => setCompactHovered(true)}
                                        onMouseLeave={() => setCompactHovered(false)}
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            {compact ? (
                                                <path d="M3 6h18M3 12h18M3 18h18" />
                                            ) : (
                                                <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                            )}
                                        </svg>
                                    </div>
                                </div>
                            )}
                        </div>
                        {saved.length > 0 ? (
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: compact ? "repeat(3, 1fr)" : "repeat(1, 1fr)",
                                gap: compact ? "8px" : "6px",
                                transition: "grid-template-columns 0.25s cubic-bezier(0.4, 0, 0.2, 1), gap 0.25s ease"
                            }}>
                                {filteredSaved.length > 0 ? (
                                    filteredSaved.map(s => {
                                        const isCurrent = isCurrentlyActive(s.id, s.name, s.avatar);
                                        const displayUsername = s.username || UserStore.getUser(s.id)?.username;
                                        return (
                                            <div
                                                key={s.id}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: compact ? "6px" : "12px",
                                                    padding: compact ? "6px 8px" : "10px 14px",
                                                    backgroundColor: "var(--background-secondary)",
                                                    borderRadius: "8px",
                                                    border: `1px solid ${isCurrent ? "var(--status-danger)" : "var(--background-modifier-accent)"}`,
                                                    minWidth: 0,
                                                    boxSizing: "border-box",
                                                    transition: "padding 0.25s cubic-bezier(0.4, 0, 0.2, 1), gap 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s ease, background-color 0.15s ease"
                                                }}
                                            >
                                                <Pfp user={{ id: s.id, avatar: s.avatar }} size={compact ? 24 : 36} />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div
                                                        onClick={compact ? () => {
                                                            navigator.clipboard.writeText(s.id);
                                                            showToast("Copied ID to clipboard", Toasts.Type.SUCCESS);
                                                        } : undefined}
                                                        title={compact ? `ID: ${s.id}\n(Click to copy)` : undefined}
                                                        style={{
                                                            width: "fit-content",
                                                            maxWidth: "100%",
                                                            cursor: compact ? "pointer" : "default",
                                                            display: "flex",
                                                            flexDirection: "column",
                                                            minWidth: 0
                                                        }}
                                                    >
                                                        <div style={{
                                                            display: "flex",
                                                            flexDirection: compact ? "column" : "row",
                                                            alignItems: compact ? "flex-start" : "center",
                                                            gap: compact ? "0px" : "6px",
                                                            minWidth: 0,
                                                            transition: "gap 0.25s ease"
                                                        }}>
                                                            <span style={{ fontSize: compact ? "13px" : "14px", fontWeight: 600, color: "#e0e1e5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%", transition: "font-size 0.25s ease" }}>{s.name}</span>
                                                            {displayUsername && (
                                                                <span style={{ fontSize: "11px", color: Col.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                                                                    @{displayUsername}
                                                                </span>
                                                            )}
                                                            {isCurrent && (
                                                                <span style={{
                                                                    fontSize: "9px",
                                                                    fontWeight: 700,
                                                                    textTransform: "uppercase",
                                                                    color: "var(--status-danger)",
                                                                    backgroundColor: "rgba(237,66,69,0.15)",
                                                                    padding: compact ? "0px" : "1px 6px",
                                                                    borderRadius: "4px",
                                                                    maxHeight: compact ? "0px" : "16px",
                                                                    opacity: compact ? 0 : 1,
                                                                    overflow: "hidden",
                                                                    whiteSpace: "nowrap",
                                                                    transition: "max-height 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease, padding 0.25s ease"
                                                                }}>
                                                                    Active
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div
                                                        onClick={!compact ? () => {
                                                            navigator.clipboard.writeText(s.id);
                                                            showToast("Copied ID to clipboard", Toasts.Type.SUCCESS);
                                                        } : undefined}
                                                        style={{
                                                            display: "block",
                                                            width: "fit-content",
                                                            fontSize: "11px",
                                                            color: Col.section,
                                                            fontFamily: "var(--font-code, monospace)",
                                                            cursor: compact ? "default" : "pointer",
                                                            maxHeight: compact ? "0px" : "16px",
                                                            opacity: compact ? 0 : 1,
                                                            marginTop: compact ? "0px" : "2px",
                                                            overflow: "hidden",
                                                            lineHeight: 1,
                                                            pointerEvents: compact ? "none" : "auto",
                                                            transition: "max-height 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease, margin-top 0.25s ease"
                                                        }}
                                                        title={!compact ? "Click to copy ID" : undefined}
                                                    >
                                                        {s.id}
                                                    </div>
                                                </div>
                                                <div style={{ display: "flex", gap: compact ? "4px" : "6px", flexShrink: 0 }}>
                                                    {compact ? (
                                                        <>
                                                            {!isCurrent ? (
                                                                renderCompactButton(
                                                                    () => doActivate(s.id),
                                                                    "Use identity",
                                                                    "var(--background-tertiary)",
                                                                    "var(--status-positive)",
                                                                    "var(--text-muted)",
                                                                    "#ffffff",
                                                                    "var(--border-neutral-semi-weak, rgba(255, 255, 255, 0.15))",
                                                                    "var(--status-positive)",
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                                                )
                                                            ) : (
                                                                renderCompactButton(
                                                                    doDeactivate,
                                                                    "Stop spoofing",
                                                                    "var(--background-tertiary)",
                                                                    "var(--status-danger)",
                                                                    "var(--text-muted)",
                                                                    "#ffffff",
                                                                    "var(--border-neutral-semi-weak, rgba(255, 255, 255, 0.15))",
                                                                    "var(--status-danger)",
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="5" y="5" width="14" height="14" rx="2" ry="2"/></svg>
                                                                )
                                                            )}
                                                            {renderCompactButton(
                                                                () => doRemoveSaved(s.id),
                                                                "Remove",
                                                                "var(--background-tertiary)",
                                                                "var(--status-danger)",
                                                                "var(--text-muted)",
                                                                "#ffffff",
                                                                "var(--border-neutral-semi-weak, rgba(255, 255, 255, 0.15))",
                                                                "var(--status-danger)",
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>
                                                            {!isCurrent && (
                                                                <Button
                                                                    size={Button.Sizes.SMALL}
                                                                    color={Button.Colors.GREEN}
                                                                    disabled={loading}
                                                                    onClick={() => doActivate(s.id)}
                                                                >
                                                                    Use
                                                                </Button>
                                                            )}
                                                            {isCurrent && (
                                                                <Button
                                                                    size={Button.Sizes.SMALL}
                                                                    color={Button.Colors.RED}
                                                                    onClick={doDeactivate}
                                                                >
                                                                    Stop
                                                                </Button>
                                                            )}
                                                            <Button
                                                                size={Button.Sizes.SMALL}
                                                                color={Button.Colors.PRIMARY}
                                                                onClick={() => doRemoveSaved(s.id)}
                                                            >
                                                                ✕
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div style={{ padding: "10px", color: Col.muted, fontSize: "13px", textAlign: "center" }}>
                                        No matching profiles found.
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ padding: "14px", backgroundColor: "var(--background-secondary)", borderRadius: "8px", border: "1px dashed var(--background-modifier-accent)", color: Col.muted, fontSize: "13px", textAlign: "center" }}>
                                No saved identities yet. Cloned user profiles will show up here.
                            </div>
                        )}
                    </div>

                    {/* Advanced Manual Spoofing */}
                    <div>
                        <div
                            onClick={() => {
                                const next = !manualExpanded;
                                setManualExpanded(next);
                                settings.store.manualExpanded = next;
                            }}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                cursor: "pointer",
                                userSelect: "none",
                                marginTop: "4px",
                                marginBottom: "8px"
                            }}
                        >
                            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: Col.section }}>
                                Manual Spoofing
                            </div>
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke={Col.section}
                                strokeWidth="3"
                                style={{
                                    transform: manualExpanded ? "rotate(180deg)" : "rotate(0deg)",
                                    transition: settings.store.disableAnimations ? "none" : "transform 0.2s ease",
                                }}
                            >
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                        </div>
                        <div style={{
                            display: "grid",
                            gridTemplateRows: manualExpanded ? "1fr" : "0fr",
                            opacity: manualExpanded ? 1 : 0,
                            transition: settings.store.disableAnimations ? "none" : "grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease",
                        }}>
                            <div style={{ overflow: "hidden", minHeight: 0 }}>
                                <div style={{ backgroundColor: "var(--background-secondary)", padding: "14px", borderRadius: "8px", border: "1px solid var(--background-modifier-accent)", display: "flex", flexDirection: "column", gap: "12px", marginBottom: "8px", marginTop: "4px" }}>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                        <div>
                                            <Label>Custom Username</Label>
                                            <input type="text" value={settings.store.manualUsername} onChange={e => { settings.store.manualUsername = e.target.value; notify(); }} placeholder="FakeUser" style={{ width: "100%", padding: "10px", backgroundColor: "var(--background-tertiary)", border: "1px solid var(--border-neutral-semi-weak, rgba(255, 255, 255, 0.15))", borderRadius: "8px", color: "#dbdee1", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
                                        </div>
                                        <div>
                                            <Label>Custom Avatar URL</Label>
                                            <input type="text" value={settings.store.manualAvatar} onChange={e => { settings.store.manualAvatar = e.target.value; notify(); }} placeholder="https://image.png" style={{ width: "100%", padding: "10px", backgroundColor: "var(--background-tertiary)", border: "1px solid var(--border-neutral-semi-weak, rgba(255, 255, 255, 0.15))", borderRadius: "8px", color: "#dbdee1", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
                                        </div>
                                    </div>

                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                        <div>
                                            <Label>Custom Banner URL or #Hex</Label>
                                            <input type="text" value={settings.store.manualBanner} onChange={e => { settings.store.manualBanner = e.target.value; notify(); }} placeholder="#ff0077 or https://banner.png" style={{ width: "100%", padding: "10px", backgroundColor: "var(--background-tertiary)", border: "1px solid var(--border-neutral-semi-weak, rgba(255, 255, 255, 0.15))", borderRadius: "8px", color: "#dbdee1", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
                                        </div>
                                        <div>
                                            <Label>Custom Pronouns</Label>
                                            <input type="text" value={settings.store.manualPronouns} onChange={e => { settings.store.manualPronouns = e.target.value; notify(); }} placeholder="they/them" style={{ width: "100%", padding: "10px", backgroundColor: "var(--background-tertiary)", border: "1px solid var(--border-neutral-semi-weak, rgba(255, 255, 255, 0.15))", borderRadius: "8px", color: "#dbdee1", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
                                        </div>
                                    </div>

                                    <div>
                                        <Label>Custom Bio / About Me</Label>
                                        <textarea rows={2} value={settings.store.manualBio} onChange={e => { settings.store.manualBio = e.target.value; notify(); }} placeholder="Write a custom bio..." style={{ width: "100%", padding: "10px", backgroundColor: "var(--background-tertiary)", border: "1px solid var(--border-neutral-semi-weak, rgba(255, 255, 255, 0.15))", borderRadius: "8px", color: "#dbdee1", fontSize: "14px", outline: "none", fontFamily: "inherit", resize: "none", boxSizing: "border-box" }} />
                                    </div>

                                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "8px" }}>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                            <div>
                                                <Label>Status</Label>
                                                <Select
                                                    options={[
                                                        { label: "Online", value: "online" },
                                                        { label: "Idle", value: "idle" },
                                                        { label: "Do Not Disturb", value: "dnd" },
                                                        { label: "Invisible", value: "offline" }
                                                    ]}
                                                    select={v => { settings.store.manualStatus = v; notify(); }}
                                                    isSelected={v => v === settings.store.manualStatus}
                                                    serialize={v => v}
                                                />
                                            </div>
                                            <div>
                                                <Label>Activity Type</Label>
                                                <Select
                                                    options={[
                                                        { label: "Playing", value: 0 },
                                                        { label: "Streaming", value: 1 },
                                                        { label: "Listening to", value: 2 },
                                                        { label: "Watching", value: 3 },
                                                        { label: "Custom Status", value: 4 },
                                                        { label: "Competing in", value: 5 }
                                                    ]}
                                                    select={v => { settings.store.manualActivityType = Number(v); notify(); }}
                                                    isSelected={v => v === settings.store.manualActivityType}
                                                    serialize={v => String(v)}
                                                />
                                            </div>
                                        </div>

                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginTop: "10px" }}>
                                            <div style={{ gridColumn: "span 1" }}>
                                                <Label>Activity Name</Label>
                                                <input type="text" value={settings.store.manualActivityName} onChange={e => { settings.store.manualActivityName = e.target.value; notify(); }} placeholder="Minecraft" style={{ width: "100%", padding: "10px", backgroundColor: "var(--background-tertiary)", border: "1px solid var(--border-neutral-semi-weak, rgba(255, 255, 255, 0.15))", borderRadius: "8px", color: "#dbdee1", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
                                            </div>
                                            <div style={{ gridColumn: "span 1" }}>
                                                <Label>State</Label>
                                                <input type="text" value={settings.store.manualActivityState} onChange={e => { settings.store.manualActivityState = e.target.value; notify(); }} placeholder="Survival Mode" style={{ width: "100%", padding: "10px", backgroundColor: "var(--background-tertiary)", border: "1px solid var(--border-neutral-semi-weak, rgba(255, 255, 255, 0.15))", borderRadius: "8px", color: "#dbdee1", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
                                            </div>
                                            <div style={{ gridColumn: "span 1" }}>
                                                <Label>Details</Label>
                                                <input type="text" value={settings.store.manualActivityDetails} onChange={e => { settings.store.manualActivityDetails = e.target.value; notify(); }} placeholder="Exploring Caves" style={{ width: "100%", padding: "10px", backgroundColor: "var(--background-tertiary)", border: "1px solid var(--border-neutral-semi-weak, rgba(255, 255, 255, 0.15))", borderRadius: "8px", color: "#dbdee1", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "12px" }}>
                                        <Button size={Button.Sizes.MEDIUM} color={Button.Colors.PRIMARY} onClick={() => {
                                            const name = settings.store.manualUsername || "FakeUser";
                                            const list = getSavedUsers();
                                            list.push({
                                                id: `manual_${Date.now()}`,
                                                name,
                                                username: name,
                                                avatar: settings.store.manualAvatar || null
                                            });
                                            setSavedUsers(list); setSaved(list);
                                            showToast("Saved custom profile!", Toasts.Type.SUCCESS);
                                        }}>Save Identity</Button>
                                        {active && settings.store.manualMode ? (
                                            <Button size={Button.Sizes.MEDIUM} color={Button.Colors.RED} onClick={() => { settings.store.manualMode = false; setEnabled(false); showToast("Manual spoof disabled.", Toasts.Type.SUCCESS); forceUpdate(); }}>Deactivate</Button>
                                        ) : (
                                            <Button size={Button.Sizes.MEDIUM} color={Button.Colors.GREEN} onClick={() => { settings.store.manualMode = true; setEnabled(true); showToast("Manual spoof activated.", Toasts.Type.SUCCESS); forceUpdate(); }}>Activate Spoof</Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Plugin Options */}
                    <div>
                        <div
                            onClick={() => {
                                const next = !configExpanded;
                                setConfigExpanded(next);
                                settings.store.configExpanded = next;
                            }}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                cursor: "pointer",
                                userSelect: "none",
                                marginTop: "4px",
                                marginBottom: "8px"
                            }}
                        >
                            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: Col.section }}>
                                Configuration
                            </div>
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke={Col.section}
                                strokeWidth="3"
                                style={{
                                    transform: configExpanded ? "rotate(180deg)" : "rotate(0deg)",
                                    transition: settings.store.disableAnimations ? "none" : "transform 0.2s ease",
                                }}
                            >
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                        </div>
                        <div style={{
                            display: "grid",
                            gridTemplateRows: configExpanded ? "1fr" : "0fr",
                            opacity: configExpanded ? 1 : 0,
                            transition: settings.store.disableAnimations ? "none" : "grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease",
                        }}>
                            <div style={{ overflow: "hidden", minHeight: 0 }}>
                                <div style={{ backgroundColor: "var(--background-secondary)", padding: "12px 14px", borderRadius: "8px", border: "1px solid var(--background-modifier-accent)", display: "flex", flexDirection: "column", gap: "16px", marginBottom: "8px", marginTop: "4px" }}>
                                    <FormSwitch
                                        value={settings.store.fakeMessages}
                                        onChange={v => { settings.store.fakeMessages = v; notify(); }}
                                        description="Post local fake messages as the spoofed target user instead of actually sending them."
                                        title="Fake outgoing messages"
                                    />
                                    <FormSwitch
                                        value={settings.store.sendRealToo}
                                        onChange={v => { settings.store.sendRealToo = v; notify(); }}
                                        description="Also transmit the real message to the server (visible to others) in addition to displaying the fake one."
                                        disabled={!settings.store.fakeMessages}
                                        title="Send real message too"
                                    />
                                    <FormSwitch
                                        value={settings.store.spoofBadges}
                                        onChange={v => { settings.store.spoofBadges = v; notify(); }}
                                        description="Replicate the target's badges onto your client-side profile."
                                        title="Spoof profile badges"
                                    />
                                    <FormSwitch
                                        value={settings.store.spoofActivities}
                                        onChange={v => { settings.store.spoofActivities = v; notify(); }}
                                        description="Replicate the target's connected accounts and game library (in cloned mode)."
                                        title="Spoof activities and connections"
                                    />
                                    <FormSwitch
                                        value={settings.store.disableAnimations}
                                        onChange={v => { settings.store.disableAnimations = v; notify(); }}
                                        description="Disable all layout transitions and sliding animations inside this settings panel."
                                        title="Disable animations"
                                    />
                                    <div className="vc-form-switch-container vc-form-switch-no-border" style={{ marginBottom: 0, paddingBottom: 0 }}>
                                        <div className="vc-form-switch">
                                            <div className="vc-form-switch-text">
                                                <Flex flexDirection="column" gap="4px">
                                                    <Span size="md" weight="medium" color="text-strong">UI Mode</Span>
                                                    <Span size="sm" color="text-subtle">Choose between the modern settings UI or the legacy visual spoofing modal.</Span>
                                                </Flex>
                                            </div>
                                            <div className="vc-form-switch-control" style={{ width: "140px", flexShrink: 0 }}>
                                                <Select
                                                    options={[
                                                        { label: "Legacy", value: "legacy" },
                                                        { label: "Modern", value: "modern" }
                                                    ]}
                                                    select={v => { settings.store.uiMode = v; notify(); }}
                                                    isSelected={v => v === settings.store.uiMode}
                                                    serialize={v => v}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </ModalContent>

            {/* @ts-ignore */}
            <ModalFooter style={{ padding: "16px 20px" }}>
                <Button color={Button.Colors.PRIMARY} onClick={() => modalProps.onClose()}>Close</Button>
            </ModalFooter>
        </ModalRoot>
    );
}
