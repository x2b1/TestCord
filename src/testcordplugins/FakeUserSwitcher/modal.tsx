/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { FormSwitch } from "@components/FormSwitch";
import { fetchUserProfile } from "@utils/discord";
import { ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, ModalSize } from "@utils/modal";
import { Button, React, showToast, Toasts, UserUtils } from "@webpack/common";

import { clearTarget, getCachedTarget, getSavedUsers, isActive, loadTarget, setEnabled, setSavedUsers, settings, subscribe } from "./data";

export function FakeUserSwitcherModal({ modalProps }: { modalProps: ModalProps; }) {
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);

    React.useEffect(() => subscribe(() => forceUpdate()), []);

    const [inputId, setInputId] = React.useState("");
    const [loading, setLoading] = React.useState(false);
    const [previewUser, setPreviewUser] = React.useState<any>(getCachedTarget()?.user ?? null);
    const [saved, setSaved] = React.useState(getSavedUsers());

    const active = isActive();
    const currentTargetId = settings.store.targetId;

    const Col = { primary: "#e0e1e5", muted: "#a0a4ae", section: "#72757e" };

    const Label = ({ children }: { children: React.ReactNode; }) => (
        <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: Col.section, marginBottom: "8px", marginTop: "4px" }}>{children}</div>
    );

    const Pfp = ({ user, size }: { user: any; size: number; }) => {
        const isManual = user?.id && String(user.id).startsWith("manual_");
        let di = 0;
        if (!isManual && user?.id) {
            try { di = Number(BigInt(user.id) >> 22n) % 6; } catch { }
        }
        const src = user?.avatar ? (isManual ? user.avatar : `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=${size <= 32 ? 64 : 128}`) : `https://cdn.discordapp.com/embed/avatars/${di}.png`;
        return <img src={src} onError={e => { (e.target as HTMLImageElement).src = "https://cdn.discordapp.com/embed/avatars/0.png"; }} style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, objectFit: "cover" }} />;
    };

    async function doPreview() {
        if (!inputId.trim()) return;
        setLoading(true);
        try {
            const u = await UserUtils.getUser(inputId.trim());
            if (u) {
                setPreviewUser(u);
                try { await fetchUserProfile(inputId.trim(), {}, false); } catch { }
            } else {
                showToast("User not found.", Toasts.Type.FAILURE);
            }
        } catch { showToast("Failed to fetch.", Toasts.Type.FAILURE); }
        setLoading(false);
    }

    async function doActivate(userId?: string) {
        const id = userId || inputId.trim();
        if (!id) return;
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
        showToast("Fake identity disabled.", Toasts.Type.SUCCESS);
    }

    function doRemoveSaved(id: string) {
        const list = getSavedUsers().filter(s => s.id !== id);
        setSavedUsers(list); setSaved(list);
    }

    const cardStyle: React.CSSProperties = {
        display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px",
        backgroundColor: "var(--background-secondary)", borderRadius: "8px",
        border: "1px solid var(--background-modifier-accent)"
    };

    return (
        <ModalRoot {...modalProps} size={ModalSize.MEDIUM}>
            {/* @ts-ignore */}
            <ModalHeader separator={false} style={{ padding: "20px 20px 0 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24"><path fill="#e0e1e5" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2a7.2 7.2 0 0 1-6-3.22c.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08a7.2 7.2 0 0 1-6 3.22z" /></svg>
                    <span style={{ fontSize: "20px", fontWeight: 700, color: "#e0e1e5" }}>Fake User Switcher</span>
                    {active && <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", color: "var(--status-danger)", backgroundColor: "rgba(237,66,69,0.15)", padding: "2px 8px", borderRadius: "4px" }}>Active</span>}
                </div>
            </ModalHeader>

            <ModalContent style={{ padding: "16px 20px 8px 20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "8px" }}>

                    {/* Input */}
                    <div>
                        <Label>Target User ID</Label>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <input type="text" value={inputId} onChange={e => setInputId(e.target.value)} onKeyDown={e => { if (e.key === "Enter") doPreview(); }} placeholder="Enter a Discord User ID" style={{ flex: 1, padding: "10px 14px", backgroundColor: "var(--background-secondary)", border: "1px solid var(--background-modifier-accent)", borderRadius: "8px", color: "#e0e1e5", fontSize: "14px", outline: "none", fontFamily: "var(--font-code, monospace)" }} />
                            <Button size={Button.Sizes.MEDIUM} color={Button.Colors.BRAND} disabled={loading || !inputId.trim()} onClick={doPreview}>{loading ? "..." : "Preview"}</Button>
                        </div>
                    </div>

                    {/* Preview */}
                    {previewUser && (
                        <div>
                            <Label>{active && currentTargetId === previewUser.id ? "Currently Impersonating" : "Preview"}</Label>
                            <div style={{ ...cardStyle, border: `2px solid ${active && currentTargetId === previewUser.id ? "var(--status-danger)" : "var(--background-modifier-accent)"}`, padding: "16px", position: "relative", overflow: "hidden" }}>
                                {active && currentTargetId === previewUser.id && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "4px", backgroundColor: "var(--status-danger)" }} />}
                                <Pfp user={previewUser} size={48} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: "16px", fontWeight: 700, color: "#e0e1e5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{previewUser.globalName || previewUser.username}</div>
                                    <div style={{ fontSize: "13px", color: "#a0a4ae" }}>@{previewUser.username}{previewUser.discriminator && previewUser.discriminator !== "0" && `#${previewUser.discriminator}`}</div>
                                    <div style={{ fontSize: "11px", color: "#72757e", fontFamily: "var(--font-code, monospace)" }}>ID: {previewUser.id}</div>
                                </div>
                                <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                                    {!(active && currentTargetId === previewUser.id)
                                        ? <Button size={Button.Sizes.MEDIUM} color={Button.Colors.GREEN} disabled={loading} onClick={() => doActivate(previewUser.id)}>{loading ? "..." : "Activate"}</Button>
                                        : <Button size={Button.Sizes.MEDIUM} color={Button.Colors.RED} onClick={doDeactivate}>Deactivate</Button>}
                                    {previewUser && !saved.find(s => s.id === previewUser.id) && (
                                        <Button size={Button.Sizes.MEDIUM} color={Button.Colors.PRIMARY} onClick={() => {
                                            const list = getSavedUsers();
                                            list.push({ id: previewUser.id, name: previewUser.globalName || previewUser.username, avatar: previewUser.avatar || null });
                                            setSavedUsers(list); setSaved(list);
                                            showToast("Saved!", Toasts.Type.SUCCESS);
                                        }}>Save</Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Saved Users */}
                    <div>
                        <Label>Saved Identities ({saved.length})</Label>
                        {saved.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                {saved.map(s => {
                                    const isCurrent = active && currentTargetId === s.id;
                                    return (
                                        <div key={s.id} style={{ ...cardStyle, border: `1px solid ${isCurrent ? "var(--status-danger)" : "var(--background-modifier-accent)"}` }}>
                                            <Pfp user={{ id: s.id, avatar: s.avatar }} size={36} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#e0e1e5" }}>{s.name}</span>
                                                    {isCurrent && <span style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", color: "var(--status-danger)", backgroundColor: "rgba(237,66,69,0.15)", padding: "1px 6px", borderRadius: "4px" }}>Active</span>}
                                                </div>
                                                <div style={{ fontSize: "12px", color: "#72757e", fontFamily: "var(--font-code, monospace)" }}>{s.id}</div>
                                            </div>
                                            <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                                                {!isCurrent && <Button size={Button.Sizes.SMALL} color={Button.Colors.GREEN} disabled={loading} onClick={() => doActivate(s.id)}>Use</Button>}
                                                {isCurrent && <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} onClick={doDeactivate}>Stop</Button>}
                                                <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} onClick={() => doRemoveSaved(s.id)}>✕</Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ padding: "14px", backgroundColor: "var(--background-secondary)", borderRadius: "8px", border: "1px dashed var(--background-modifier-accent)", color: "#a0a4ae", fontSize: "13px", textAlign: "center" }}>
                                No saved identities yet. Activate a user to auto-save them here.
                            </div>
                        )}
                    </div>
                    {/* Manual Spoofing */}
                    <div style={{ marginTop: "8px" }}>
                        <Label>Manual Spoofing</Label>
                        <div style={{ backgroundColor: "var(--background-secondary)", padding: "12px 14px", borderRadius: "8px", border: "1px solid var(--background-modifier-accent)", display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div>
                                <Label>Custom Username</Label>
                                <input type="text" value={settings.store.manualUsername} onChange={e => { settings.store.manualUsername = e.target.value; forceUpdate(); }} placeholder="FakeUser" style={{ width: "100%", padding: "10px 14px", backgroundColor: "var(--background-primary)", border: "1px solid var(--background-modifier-accent)", borderRadius: "8px", color: "#e0e1e5", fontSize: "14px", outline: "none", fontFamily: "var(--font-code, monospace)", boxSizing: "border-box" }} />
                            </div>
                            <div>
                                <Label>Custom Avatar URL (Optional)</Label>
                                <input type="text" value={settings.store.manualAvatar} onChange={e => { settings.store.manualAvatar = e.target.value; forceUpdate(); }} placeholder="https://..." style={{ width: "100%", padding: "10px 14px", backgroundColor: "var(--background-primary)", border: "1px solid var(--background-modifier-accent)", borderRadius: "8px", color: "#e0e1e5", fontSize: "14px", outline: "none", fontFamily: "var(--font-code, monospace)", boxSizing: "border-box" }} />
                            </div>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
                                <Button size={Button.Sizes.MEDIUM} color={Button.Colors.PRIMARY} onClick={() => {
                                    const name = settings.store.manualUsername || "FakeUser";
                                    const list = getSavedUsers();
                                    list.push({ id: `manual_${Date.now()}`, name, avatar: settings.store.manualAvatar || null });
                                    setSavedUsers(list); setSaved(list);
                                    showToast("Saved!", Toasts.Type.SUCCESS);
                                }}>Save</Button>
                                {active && settings.store.manualMode ? (
                                    <Button size={Button.Sizes.MEDIUM} color={Button.Colors.RED} onClick={() => { settings.store.manualMode = false; setEnabled(false); showToast("Disabled.", Toasts.Type.SUCCESS); forceUpdate(); }}>Deactivate</Button>
                                ) : (
                                    <Button size={Button.Sizes.MEDIUM} color={Button.Colors.GREEN} onClick={() => { settings.store.manualMode = true; setEnabled(true); showToast("Activated manual mode.", Toasts.Type.SUCCESS); forceUpdate(); }}>Activate</Button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: "8px" }}>
                        <Label>Configuration</Label>
                        <div style={{ backgroundColor: "var(--background-secondary)", padding: "12px 14px", borderRadius: "8px", border: "1px solid var(--background-modifier-accent)", display: "flex", flexDirection: "column", gap: "16px" }}>
                            <FormSwitch
                                value={settings.store.fakeMessages}
                                onChange={v => { settings.store.fakeMessages = v; forceUpdate(); }}
                                description="When you send a message, post a local fake one as the target instead of really sending it."
                                title="Fake outgoing messages"
                            />
                            <FormSwitch
                                value={settings.store.sendRealToo}
                                onChange={v => { settings.store.sendRealToo = v; forceUpdate(); }}
                                description="Also send the real message in addition to the local fake. Off keeps it client-side only."
                                disabled={!settings.store.fakeMessages}
                                title="Send real message too"
                            />
                            <FormSwitch
                                value={settings.store.spoofBadges}
                                onChange={v => { settings.store.spoofBadges = v; forceUpdate(); }}
                                description="Mirror the target's badges onto your client-side profile."
                                title="Spoof badges"
                            />
                            <FormSwitch
                                value={settings.store.spoofActivities}
                                onChange={v => { settings.store.spoofActivities = v; forceUpdate(); }}
                                description="Mirror the target's connected accounts and game collection."
                                title="Spoof activities and connections"
                            />
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
