/*
 * Equicord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addHeaderBarButton, HeaderBarButton, removeHeaderBarButton } from "@api/HeaderBar";
import { PluginNative } from "@utils/types";
import definePlugin from "@utils/types";
import { t } from "../autoTranslateNightcord";
import { openModal, ModalRoot, ModalHeader, ModalContent, ModalCloseButton } from "@utils/modal";
import { React, useState, useRef, useEffect, useCallback, useMemo } from "@webpack/common";
import { Forms } from "@webpack/common";
import { DataStore } from "@api/index";
import { findByProps } from "@webpack";
import "./styles.css";

const Native = VencordNative.pluginHelpers.TokenImporter as PluginNative<typeof import("./native")>;
const STORE_KEY = "TokenImporter_accounts";

interface SavedAccount { id: string; token: string; username: string; discriminator: string; avatar: string; }

let accountsCache: SavedAccount[] | null = null;
let loadPromise: Promise<SavedAccount[]> | null = null;

function getAccounts(): Promise<SavedAccount[]> {
    if (accountsCache !== null) return Promise.resolve(accountsCache);
    if (!loadPromise) {
        loadPromise = DataStore.get<SavedAccount[]>(STORE_KEY).then(v => {
            accountsCache = v ?? [];
            loadPromise = null;
            return accountsCache;
        });
    }
    return loadPromise;
}

async function saveAccounts(accounts: SavedAccount[]): Promise<void> {
    const unique = new Map<string, SavedAccount>();
    for (const a of accounts) {
        if (!unique.has(a.id)) unique.set(a.id, a);
    }
    const deduplicated = Array.from(unique.values());
    accountsCache = deduplicated;
    await DataStore.set(STORE_KEY, deduplicated);
}

let tokenModulePatched = false;
let originalEncryptAndStoreTokens: any = null;

async function patchTokenStore() {
    if (tokenModulePatched) return;
    try {
        const tokenMod = findByProps("getToken", "encryptAndStoreTokens");
        if (!tokenMod?.encryptAndStoreTokens) return;
        originalEncryptAndStoreTokens = tokenMod.encryptAndStoreTokens;
        const orig = tokenMod.encryptAndStoreTokens.bind(tokenMod);
        tokenMod.encryptAndStoreTokens = async function (tokens: Record<string, string>) {
            try { const saved = await getAccounts(); for (const acc of saved) { if (!tokens[acc.id]) tokens[acc.id] = acc.token; } } catch { }
            return orig(tokens);
        };
        tokenModulePatched = true;
    } catch (e) {
        console.warn("[TokenImporter] patchTokenStore failed", e);
    }
}

function switchToAccount(token: string, userId?: string) {
    try {
        const isMultiInstance = window.location.href.includes("multi-instance=true") || (window as any).IS_MULTI_INSTANCE;
        if (isMultiInstance && userId) {
            if (typeof VencordNative?.pluginHelpers?.MultiInstance?.openInstanceWindow === "function") {
                VencordNative.pluginHelpers.MultiInstance.openInstanceWindow(token, userId, true);
                window.close();
                return;
            }
        }

        const TokenStore = findByProps("getToken", "setToken");
        const FluxDispatcher = findByProps("dispatch", "subscribe", "register");

        if (TokenStore && typeof (TokenStore as any).setToken === "function") {
            (TokenStore as any).setToken(token);
        }

        if (FluxDispatcher) {
            FluxDispatcher.dispatch({
                type: "CONNECTION_OPEN",
                user: {},
                experiments: [],
                guilds: [],
                relationships: [],
                private_channels: [],
                users: [],
                analytics_token: "",
                session_id: ""
            });

            FluxDispatcher.dispatch({
                type: "LOGIN_SUCCESS",
                token: token
            });
        }

        window.localStorage.setItem("token", `"${token}"`);
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        document.body.appendChild(iframe);
        try {
            (iframe as any).contentWindow.localStorage.token = `"${token}"`;
        } catch { }
        document.body.removeChild(iframe);

        setTimeout(() => {
            location.reload();
        }, 350);
    } catch (err) {
        console.error("[TokenImporter] Switch failed:", err);
        location.reload();
    }
}

function copyMyToken() {
    try {
        const token = findByProps("getToken")?.getToken?.();
        if (token) {
            if (typeof window.DiscordNative?.clipboard?.copy === "function") {
                window.DiscordNative.clipboard.copy(token);
            } else {
                navigator.clipboard.writeText(token);
            }
        }
    } catch { }
}

function FolderIcon({ width = 20, height = 20, style }: { width?: number; height?: number; style?: React.CSSProperties; }) {
    return <svg width={width} height={height} viewBox="0 0 24 24" fill="currentColor" style={style}><path d="M2 5a3 3 0 0 1 3-3h3.93a2 2 0 0 1 1.66.9L12 5h7a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V5Z" /></svg>;
}

function TrashIcon() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2h4a1 1 0 1 1 0 2h-1.1l-.9 12.1A3 3 0 0 1 17 23H7a3 3 0 0 1-3-2.9L3.1 8H2a1 1 0 0 1 0-2h4V4Zm2 0v2h6V4H9ZM5.1 8l.9 11.9a1 1 0 0 0 1 .1h6a1 1 0 0 0 1-.1L14.9 8H5.1Z" /></svg>;
}

function CopyIcon() {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1Zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2Zm0 16H8V7h11v14Z" /></svg>;
}

function CheckIcon() {
    return <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg>;
}

function CrossIcon() {
    return <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 17.59 13.41 12 19 6.41z" /></svg>;
}

const TOKEN_REGEX = /(?:mfa\.[\w-]{84}|[\w-]{24,26}\.[\w-]{4,7}\.[\w-]{27,40})/g;

function extractTokens(raw: string): string[] {
    const found = new Set<string>();
    TOKEN_REGEX.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TOKEN_REGEX.exec(raw)) !== null) found.add(m[0]);
    return Array.from(found);
}

interface TokenResult { token: string; status: "pending" | "checking" | "valid" | "invalid" | "error" | "rate_limited"; username?: string; avatar?: string; id?: string; }

function TokenModal({ rootProps }: { rootProps: any; }) {
    const [accounts, setAccounts] = useState<SavedAccount[]>(() => accountsCache ?? []);
    const [loaded, setLoaded] = useState(() => accountsCache !== null);
    const [verifying, setVerifying] = useState(false);
    const [statuses, setStatuses] = useState<Record<string, string>>({});
    const [tab, setTab] = useState<"saved" | "add">("saved");
    const [pasteValue, setPaste] = useState("");
    const [detectedCount, setDetectedCount] = useState(0);
    const [results, setResults] = useState<TokenResult[]>([]);
    const [checking, setChecking] = useState(false);
    const [done, setDone] = useState(false);
    const [copied, setCopied] = useState(false);
    const [accountSearch, setAccountSearch] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);

    const filteredAccounts = useMemo(() => {
        if (!accountSearch.trim()) return accounts;
        const lowSearch = accountSearch.toLowerCase();
        return accounts.filter(a => a.username.toLowerCase().includes(lowSearch) || a.id.includes(lowSearch));
    }, [accounts, accountSearch]);

    const detectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (accountsCache !== null) {
            setAccounts(accountsCache);
            setLoaded(true);
            return;
        }
        let cancelled = false;
        getAccounts().then(v => {
            if (!cancelled) { setAccounts(v); setLoaded(true); }
        });
        return () => { cancelled = true; };
    }, []);

    const handleTabChange = useCallback((newTab: "saved" | "add") => {
        setTab(newTab);
        if (newTab === "saved" && accountsCache !== null) {
            setAccounts(accountsCache);
        }
    }, []);

    async function removeAccount(id: string) {
        const updated = accounts.filter(a => a.id !== id);
        setAccounts(updated);
        await saveAccounts(updated);
    }

    async function verifyAll() {
        if (verifying) return; setVerifying(true);
        const ns: Record<string, string> = {};
        for (const acc of accounts) {
            ns[acc.id] = "checking"; setStatuses({ ...ns });
            try { const r = await Native.checkToken(acc.token); ns[acc.id] = r.valid ? "valid" : "invalid"; } catch { ns[acc.id] = "error"; }
            setStatuses({ ...ns });
            await new Promise(r => setTimeout(r, 400));
        }
        const toKeep = accounts.filter(a => ns[a.id] !== "invalid");
        if (toKeep.length !== accounts.length) { setAccounts(toKeep); await saveAccounts(toKeep); }
        setVerifying(false);
    }

    async function processTokens(raw: string) {
        const tokens = extractTokens(raw);
        if (!tokens.length) { setResults([{ token: "No tokens found", status: "invalid" }]); return; }
        const initial: TokenResult[] = tokens.map(t => ({ token: t, status: "pending" as const }));
        setResults(initial); setChecking(true); setDone(false);
        const updated = [...initial];
        const existing = await getAccounts();
        for (let i = 0; i < tokens.length; i++) {
            updated[i] = { ...updated[i], status: "checking" }; setResults([...updated]);
            try {
                const result = await Native.checkToken(tokens[i]);
                if (result.valid && result.user) {
                    const u = result.user;
                    const av = u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.webp?size=64`
                        : `https://cdn.discordapp.com/embed/avatars/${(BigInt(u.id) >> 22n) % 6n}.png`;
                    if (!existing.find(a => a.id === u.id)) {
                        existing.push({ id: u.id, token: tokens[i], username: u.global_name || u.username, discriminator: u.discriminator ?? "0", avatar: av });
                        await saveAccounts(existing);
                        await patchTokenStore();
                        setAccounts([...existing]);
                    }
                    updated[i] = { ...updated[i], status: "valid", username: u.global_name || u.username, id: u.id, avatar: av };
                } else {
                    updated[i] = { ...updated[i], status: (result as any).error === "rate_limited" ? "rate_limited" : (result as any).error ? "error" : "invalid" };
                }
            } catch { updated[i] = { ...updated[i], status: "error" }; }
            setResults([...updated]);
            await new Promise(r => setTimeout(r, 200));
        }
        setChecking(false); setDone(true);
    }

    function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => processTokens(ev.target?.result as string ?? "");
        reader.readAsText(file); e.target.value = "";
    }

    function handlePasteChange(val: string) {
        setPaste(val);
        if (detectTimer.current) clearTimeout(detectTimer.current);
        detectTimer.current = setTimeout(() => {
            setDetectedCount(extractTokens(val).length);
        }, 150);
    }

    return (
        <ModalRoot {...rootProps} size="medium">
            <ModalHeader separator={false}>
                <Forms.FormTitle tag="h4" style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, color: "#ffffff" }}>
                    <FolderIcon width={16} height={16} /> Token Importer
                </Forms.FormTitle>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent className="ti-content">
                <div className="ti-tabs">
                    <button className={`ti-tab ${tab === "saved" ? "ti-tab--active" : ""}`} onClick={() => handleTabChange("saved")}>
                        Saved accounts
                        {accounts.length > 0 && <span className="ti-tab-count">{accounts.length}</span>}
                    </button>
                    <button className={`ti-tab ${tab === "add" ? "ti-tab--active" : ""}`} onClick={() => handleTabChange("add")}>
                        Paste tokens
                    </button>
                </div>

                {tab === "saved" && (
                    <>
                        <div className="ti-bar">
                            <div className="ti-search-wrap">
                                <input className="ti-search-input" placeholder={t("Search accounts...")} value={accountSearch} onChange={e => setAccountSearch(e.target.value)} />
                                {accountSearch && <button className="ti-search-clear" onClick={() => setAccountSearch("")}>✕</button>}
                            </div>
                            <button className="ti-verify-btn" style={{ marginRight: 6 }} onClick={async () => {
                                if (verifying) return;
                                setVerifying(true);
                                try {
                                    const tokens = await Native.findLocalTokens();
                                    const existing = await getAccounts();
                                    let addedCount = 0;
                                    for (const tok of tokens) {
                                        if (!existing.find(a => a.token === tok)) {
                                            const verified = await Native.checkToken(tok);
                                            if (verified.valid && verified.user) {
                                                const u = verified.user;
                                                const av = u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.webp?size=64`
                                                    : `https://cdn.discordapp.com/embed/avatars/${(BigInt(u.id) >> 22n) % 6n}.png`;
                                                if (!existing.find(a => a.id === u.id)) {
                                                    existing.push({ id: u.id, token: tok, username: u.global_name || u.username, discriminator: u.discriminator ?? "0", avatar: av });
                                                    addedCount++;
                                                }
                                            }
                                            await new Promise(r => setTimeout(r, 200));
                                        }
                                    }
                                    if (addedCount > 0) {
                                        await saveAccounts(existing);
                                        await patchTokenStore();
                                        setAccounts([...existing]);
                                        (window as any).Vencord?.Webpack?.findByProps?.("showToast")?.showToast?.(`${addedCount} new accounts imported!`);
                                    } else {
                                        (window as any).Vencord?.Webpack?.findByProps?.("showToast")?.showToast?.("No new accounts found.");
                                    }
                                } catch (err) {
                                    console.error("[TokenImporter] Scan failed:", err);
                                } finally {
                                    setVerifying(false);
                                }
                            }}>
                                <FolderIcon width={12} height={12} style={{ marginRight: 4 }} /> Scan local Discords
                            </button>
                            <button className="ti-verify-btn" style={{ marginRight: 6, opacity: copied ? 0.7 : 1 }} onClick={() => { copyMyToken(); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                                {copied ? "Copied ✓" : "My Token"}
                            </button>
                            <button className="ti-verify-btn" onClick={verifyAll} disabled={verifying || !loaded}>
                                {verifying ? "Stopping..." : "Verify all"}
                            </button>
                        </div>
                        {!loaded ? <div className="ti-empty" style={{ opacity: 0.5 }}>Loading accounts...</div>
                            : accounts.length === 0 ? <div className="ti-empty">No accounts — add tokens via the tab above.</div>
                                : filteredAccounts.length === 0 ? <div className="ti-empty">No accounts match your search.</div>
                                    : <div className="ti-list">
                                        {filteredAccounts.map(a => {
                                            const st = statuses[a.id] ?? "idle";
                                            return (
                                                <div key={a.id} className={`ti-row ti-row--${st === "invalid" ? "invalid" : st === "error" ? "warn" : st === "valid" ? "valid" : "idle"}`}>
                                                    {a.avatar ? <img src={a.avatar} className="ti-avatar" alt="" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                                        : <div className="ti-avatar ti-avatar--ph">{a.username?.[0]?.toUpperCase() ?? "?"}</div>}
                                                    <div className="ti-row-info">
                                                        <span className="ti-username">
                                                            {a.username}{a.discriminator && a.discriminator !== "0" ? `#${a.discriminator}` : ""}
                                                            {st === "valid" && <span className="ti-st ti-st--ok"><CheckIcon /></span>}
                                                            {st === "invalid" && <span className="ti-st ti-st--bad"><CrossIcon /></span>}
                                                            {st === "checking" && <span className="ti-st ti-st--loading">...</span>}
                                                        </span>
                                                        <span className="ti-token-hidden" onClick={() => navigator.clipboard.writeText(a.token)} title="Copy token" style={{ cursor: "pointer" }}>••••••••••••••••••••••••</span>
                                                    </div>
                                                    <div className="ti-row-actions">
                                                        <button className="ti-switch-btn" onClick={() => switchToAccount(a.token, a.id)}>Switch</button>
                                                        <button className="ti-del-btn" style={{ color: "#b9bbbe" }} title="Copy Token" onClick={() => {
                                                            const native = (window as any).DiscordNative?.clipboard?.copy;
                                                            if (typeof native === "function") native(a.token);
                                                            else navigator.clipboard.writeText(a.token);
                                                            const { showToast, Toasts } = (window as any).Vencord.Webpack.common;
                                                            showToast("Token copied!", Toasts.Type.SUCCESS);
                                                        }}><CopyIcon /></button>
                                                        <button className="ti-del-btn" title="Delete" onClick={() => removeAccount(a.id)}><TrashIcon /></button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                        }
                    </>
                )}

                {tab === "add" && (
                    <div className="ti-add-body">
                        <textarea className="ti-textarea ti-textarea-mask" placeholder="Paste your Discord tokens here... (1 per line, or pasted together)" value={pasteValue} onChange={e => handlePasteChange(e.target.value)} autoFocus />
                        <div className="ti-add-footer">
                            <span className="ti-detected">{detectedCount} token{detectedCount !== 1 ? "s" : ""} detected</span>
                            <button className="ti-file-btn" onClick={() => fileRef.current?.click()}>File .txt</button>
                            <button className="ti-submit-btn" disabled={checking || detectedCount === 0} onClick={() => processTokens(pasteValue)}>
                                {checking ? "Checking..." : "Verify & Add"}
                            </button>
                        </div>
                        <input ref={fileRef} type="file" accept=".txt,text/plain" style={{ display: "none" }} onChange={handleFile} />
                        {results.length > 0 && (
                            <div className="ti-results">
                                {done && (
                                    <div className="ti-results-summary">
                                        <span className="ti-st ti-st--ok"><CheckIcon /> {results.filter(r => r.status === "valid").length} valid{results.filter(r => r.status === "valid").length !== 1 ? "s" : ""}</span>
                                        <span className="ti-st ti-st--bad"><CrossIcon /> {results.filter(r => r.status === "invalid").length} invalid{results.filter(r => r.status === "invalid").length !== 1 ? "s" : ""}</span>
                                    </div>
                                )}
                                <div className="ti-list">
                                    {results.map((r, i) => (
                                        <div key={i} className={`ti-row ti-row--${r.status === "valid" ? "valid" : r.status === "checking" ? "idle" : "invalid"}`}>
                                            {r.status === "valid" && r.avatar ? <img src={r.avatar} className="ti-avatar" alt="" />
                                                : <div className="ti-avatar ti-avatar--ph">{r.status === "checking" ? "..." : "?"}</div>}
                                            <div className="ti-row-info">
                                                {r.status === "valid" ? <span className="ti-username">{r.username}</span>
                                                    : <span className="ti-token-hidden" onClick={() => navigator.clipboard.writeText(r.token)} title="Copy token" style={{ cursor: "pointer" }}>{r.status === "checking" ? "Checking..." : "••••••••••••••••••••••••"}</span>}
                                            </div>
                                            <span className={`ti-badge ti-badge--${r.status === "rate_limited" || r.status === "error" ? "warn" : r.status === "valid" ? "valid" : "invalid"}`}>
                                                {r.status === "valid" ? <CheckIcon /> : r.status === "checking" ? "..." : r.status === "rate_limited" ? "Slow" : r.status === "error" ? "!" : <CrossIcon />}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </ModalContent>
        </ModalRoot>
    );
}

function TokenImporterButton() {
    return <HeaderBarButton icon={FolderIcon} tooltip="Token Importer" onClick={() => openModal(props => <TokenModal rootProps={props} />)} />;
}

export default definePlugin({
    name: "TokenImporter",
    enabledByDefault: true,
    description: "Import and verify Discord tokens.",
    authors: [{ name: "Nightcord", id: 0n }],
    dependencies: ["HeaderBarAPI"],
    start() {
        addHeaderBarButton("nightcord-token-importer", () => <TokenImporterButton />, 10);
        getAccounts().then(async existing => {
            try {
                if (window.DiscordNative?.process?.platform === "win32") {
                    const autoFound = await Native.findLocalTokens();
                    let added = false;
                    const current = [...existing];
                    for (const tok of autoFound) {
                        if (!current.find(a => a.token === tok)) {
                            const verified = await Native.checkToken(tok);
                            if (verified.valid && verified.user) {
                                const u = verified.user;
                                if (!current.find(a => a.id === u.id)) {
                                    const av = u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.webp?size=64`
                                        : `https://cdn.discordapp.com/embed/avatars/${(BigInt(u.id) >> 22n) % 6n}.png`;
                                    current.push({ id: u.id, token: tok, username: u.global_name || u.username, discriminator: u.discriminator ?? "0", avatar: av });
                                    added = true;
                                }
                            }
                        }
                    }
                    if (added) {
                        await saveAccounts(current);
                        await patchTokenStore();
                    }
                }
            } catch (e) { console.error("[TokenImporter] Auto import failed:", e); }
            setTimeout(() => this._injectAccounts(), 5000);
        });
    },
    async _injectAccounts() {
        try {
            const saved = await getAccounts();
            if (!saved.length) return;
            const FluxDispatcher = findByProps("dispatch", "subscribe", "register");
            if (!FluxDispatcher?.dispatch) return;
            const existing = new Set((findByProps("getAccounts")?.getAccounts?.() ?? []).map((u: any) => u.id));
            const toInject = saved.filter(a => !existing.has(a.id));
            for (const acc of toInject) {
                await new Promise(r => setTimeout(r, 0));
                try {
                    FluxDispatcher.dispatch({
                        type: "MULTI_ACCOUNT_VALIDATE_TOKEN_SUCCESS",
                        userId: acc.id,
                        token: acc.token,
                        user: { id: acc.id, username: acc.username, discriminator: acc.discriminator, avatar: null }
                    });
                } catch { }
                await new Promise(r => setTimeout(r, 300));
            }
        } catch (e) { console.error("[TokenImporter] inject:", e); }
    },
    stop() {
        removeHeaderBarButton("nightcord-token-importer");
        if (tokenModulePatched) {
            try {
                const tokenMod = findByProps("getToken", "encryptAndStoreTokens");
                if (tokenMod && originalEncryptAndStoreTokens) {
                    tokenMod.encryptAndStoreTokens = originalEncryptAndStoreTokens;
                }
            } catch (e) {
                console.warn("[TokenImporter] unpatchTokenStore failed", e);
            }
            tokenModulePatched = false;
            originalEncryptAndStoreTokens = null;
        }
        accountsCache = null;
    },
});
