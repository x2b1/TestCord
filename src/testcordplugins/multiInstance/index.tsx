/*
 * Nightcord — MultiInstance plugin
 *
 * Clic gauche sur un account :
 *   → Si token disponible : choisit directement "New window" ou "Split" via le ctx menu
 *   → Si pas de token : switch rapide uniquement
 *
 * Clic droit sur un account : context menu (New window | Split screen | Close)
 *
 * La logique est :
 *   - Clic GAUCHE avec token → ouvre le context menu (même que clic droit)
 *     (on ne fait PLUS location.reload sur clic gauche si le account a un token)
 *   - Clic GAUCHE sans token → switch rapide classique
 *   - Clic DROIT avec token → context menu
 */

import { addHeaderBarButton, HeaderBarButton, removeHeaderBarButton } from "@api/HeaderBar";
import { DataStore } from "@api/index";
import definePlugin, { PluginNative } from "@utils/types";
import { ModalCloseButton, ModalContent, ModalHeader, ModalRoot, openModal } from "@utils/modal";
import { findByProps } from "@webpack";
import { Forms, React, ReactDOM, UserStore } from "@webpack/common";
import { t } from "../autoTranslateNightcord";
import "./styles.css";

const Native = VencordNative.pluginHelpers.MultiInstance as PluginNative<typeof import("./native")>;
const STORE_KEY = "TokenImporter_accounts";
const MI_TOKEN_CACHE_KEY = "nightcord-mi-token-cache";

// ─────────────────────────────────────────────────────────────────────────────
// Token cache — capture les tokens des accounts natifs Discord
// ─────────────────────────────────────────────────────────────────────────────

let tokenCache: Record<string, string> = {};
let tokenCacheLoaded = false;
let encryptHooked = false;

async function loadTokenCache(): Promise<void> {
    if (tokenCacheLoaded) return;
    tokenCache = (await DataStore.get<Record<string, string>>(MI_TOKEN_CACHE_KEY)) ?? {};
    tokenCacheLoaded = true;
}

async function saveTokenCache(): Promise<void> {
    await DataStore.set(MI_TOKEN_CACHE_KEY, tokenCache);
}

function cacheToken(userId: string, token: string): void {
    if (!userId || !token) return;
    tokenCache[userId] = token;
}

function captureCurrentToken(): void {
    try {
        const tokenMod = findByProps("getToken", "encryptAndStoreTokens");
        const token = tokenMod?.getToken?.();
        const user = UserStore.getCurrentUser();
        if (token && user?.id) {
            cacheToken(user.id, token);
            saveTokenCache();
        }
    } catch { }
}

function hookEncryptAndStoreTokens(): void {
    if (encryptHooked) return;
    try {
        const tokenMod = findByProps("getToken", "encryptAndStoreTokens");
        if (!tokenMod?.encryptAndStoreTokens) return;
        const orig = tokenMod.encryptAndStoreTokens.bind(tokenMod);
        tokenMod.encryptAndStoreTokens = async function (tokens: Record<string, string>) {
            // Capture tous les tokens au passage
            for (const [id, token] of Object.entries(tokens)) {
                if (id && token) cacheToken(id, token);
            }
            saveTokenCache();
            return orig(tokens);
        };
        encryptHooked = true;
    } catch { }
}

function hookFluxDispatcher(): (() => void) | null {
    try {
        const Flux = findByProps("dispatch", "subscribe");
        if (!Flux?.subscribe) return null;
        const handler = (event: any) => {
            if (event?.token && event?.userId) {
                cacheToken(event.userId, event.token);
                saveTokenCache();
            }
        };
        Flux.subscribe("MULTI_ACCOUNT_VALIDATE_TOKEN_SUCCESS", handler);
        return () => Flux.unsubscribe("MULTI_ACCOUNT_VALIDATE_TOKEN_SUCCESS", handler);
    } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SavedAccount {
    id: string;
    token: string;
    username: string;
    discriminator: string;
    avatar: string;
}

interface AccountEntry extends SavedAccount {
    hasToken: boolean;
    isNative: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getAvatarUrl(id: string, hash?: string | null, discriminator?: string): string {
    if (hash) return `https://cdn.discordapp.com/avatars/${id}/${hash}.webp?size=64`;
    const idx = discriminator && discriminator !== "0"
        ? parseInt(discriminator) % 5
        : Number(BigInt(id) >> 22n) % 6;
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}

function getNativeAccounts(): SavedAccount[] {
    try {
        const store = findByProps("getUsers", "getValidUsers");
        const users: any[] = store?.getUsers?.() ?? [];
        return users.filter(u => u?.id).map(u => ({
            id: u.id,
            token: tokenCache[u.id] ?? "",
            username: u.globalName || u.username || `User_${u.id.slice(-4)}`,
            discriminator: u.discriminator ?? "0",
            avatar: getAvatarUrl(u.id, u.avatar, u.discriminator),
        }));
    } catch {
        return [];
    }
}

/** Quick switch — token direct */
function switchToQuick(token: string) {
    try {
        window.localStorage.setItem("token", `"${token}"`);
        location.reload();
    } catch {
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        document.body.appendChild(iframe);
        try { (iframe as any).contentWindow.localStorage.token = `"${token}"`; } catch { }
        document.body.removeChild(iframe);
        location.reload();
    }
}

/** Switch pour accounts natifs sans token — utilise le mécanisme Discord natif */
function switchNativeAccount(userId: string) {
    try {
        const multiAuth = findByProps("switchAccount", "loginToken") ?? findByProps("switchAccount");
        if (multiAuth?.switchAccount) {
            multiAuth.switchAccount(userId);
            return;
        }
        // Fallback : dispatch le flux event comme Discord le fait nativement
        const Flux = findByProps("dispatch", "subscribe");
        if (Flux?.dispatch) {
            Flux.dispatch({ type: "MULTI_ACCOUNT_SWITCH_ATTEMPT", userId });
        }
    } catch {
        console.warn("[MultiInstance] switchNativeAccount failed for", userId);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context menu — monté dans document.body via portal pour éviter l'overflow
// ─────────────────────────────────────────────────────────────────────────────

interface CtxState {
    x: number;
    y: number;
    acc: AccountEntry;
}

interface CtxMenuProps extends CtxState {
    isOpen: boolean;
    onClose(): void;
    onNewWindow(): void;
    onNewDetached(): void;
    onNewGrouped(): void;
    onSwitch(): void;
}

function ContextMenuPortal(props: CtxMenuProps) {
    const { x, y, acc, isOpen, onClose, onNewWindow, onNewDetached, onNewGrouped, onSwitch } = props;
    const ref = React.useRef<HTMLDivElement>(null);
    const [pos, setPos] = React.useState({ left: x, top: y });

    // Crée le container portal une seule fois
    const [container] = React.useState(() => {
        const el = document.getElementById("nightcord-mi-ctx-root") ?? document.createElement("div");
        el.id = "nightcord-mi-ctx-root";
        if (!el.parentNode) document.body.appendChild(el);
        return el;
    });

    // Nettoie le container à l'unmount
    React.useEffect(() => {
        return () => {
            try { container.remove(); } catch { }
        };
    }, [container]);

    // Ferme si clic en dehors ou Escape
    React.useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("mousedown", onDown, true);
        document.addEventListener("keydown", onKey, true);
        return () => {
            document.removeEventListener("mousedown", onDown, true);
            document.removeEventListener("keydown", onKey, true);
        };
    }, [onClose]);

    // Ajuste la position pour rester dans le viewport
    React.useLayoutEffect(() => {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        setPos({
            left: Math.min(x, window.innerWidth - rect.width - 8),
            top: Math.min(y, window.innerHeight - rect.height - 8),
        });
    }, [x, y]);

    const menu = (
        <div ref={ref} className="mi-ctx-menu" style={{ left: pos.left, top: pos.top, position: "fixed" }}>
            <div className="mi-ctx-header">
                <span className="mi-ctx-username">{acc.username}</span>
            </div>
            <div className="mi-ctx-separator" />

            {acc.hasToken && <>
                <div className="mi-ctx-item" onClick={() => { onNewWindow(); onClose(); }}>
                    <WindowIcon /> {t("New detached instance")}
                </div>
                <div className="mi-ctx-item" onClick={() => { onNewGrouped(); onClose(); }}>
                    <GroupedIcon /> {t("New grouped instance")}
                </div>
                <div className="mi-ctx-separator" />
            </>}

            <div className="mi-ctx-item" onClick={() => { onSwitch(); onClose(); }}>
                <SwitchIcon /> {t("Quick switch")}
            </div>

            {isOpen && <>
                <div className="mi-ctx-separator" />
                <div className="mi-ctx-item mi-ctx-item--danger" onClick={async () => {
                    await Native.closeInstance(acc.id).catch(() => { });
                    onClose();
                }}>
                    <CloseIcon /> {t("Close instance")}
                </div>
            </>}
        </div>
    );

    // createPortal monte le menu dans document.body — hors du DOM du modal
    // ce qui contourne le z-index et l'overflow du ModalRoot
    return ReactDOM.createPortal(menu, container) as any;
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal principal
// ─────────────────────────────────────────────────────────────────────────────

function MultiInstanceModal({ rootProps }: { rootProps: any; }) {
    const currentUser = UserStore.getCurrentUser();
    const [savedAccounts, setSavedAccounts] = React.useState<SavedAccount[]>([]);
    const [nativeAccounts, setNativeAccounts] = React.useState<SavedAccount[]>([]);
    const [openInstances, setOpenInstances] = React.useState<string[]>([]);
    const [ctx, setCtx] = React.useState<CtxState | null>(null);
    const [status, setStatus] = React.useState<string | null>(null);

    React.useEffect(() => {
        captureCurrentToken();
        DataStore.get<SavedAccount[]>(STORE_KEY).then(v => setSavedAccounts(v ?? []));
        setNativeAccounts(getNativeAccounts());
        Native.getOpenInstances().then(ids => setOpenInstances(ids ?? [])).catch(() => { });
    }, []);

    const allAccounts = React.useMemo<AccountEntry[]>(() => {
        const seen = new Set<string>();
        const result: AccountEntry[] = [];

        for (const acc of nativeAccounts) {
            if (acc.id === currentUser?.id || seen.has(acc.id)) continue;
            seen.add(acc.id);
            const saved = savedAccounts.find(s => s.id === acc.id);
            const token = saved?.token || acc.token || tokenCache[acc.id] || "";
            result.push({ ...acc, token, hasToken: !!token, isNative: true });
        }
        for (const acc of savedAccounts) {
            if (acc.id === currentUser?.id || seen.has(acc.id)) continue;
            seen.add(acc.id);
            result.push({ ...acc, hasToken: true, isNative: false });
        }
        return result;
    }, [savedAccounts, nativeAccounts, currentUser]);

    const refreshInstances = async () => {
        const ids = await Native.getOpenInstances().catch(() => []);
        setOpenInstances(ids ?? []);
    };

    const handleNewWindow = async (acc: AccountEntry) => {
        if (!acc.hasToken) return;
        setCtx(null);
        setStatus(t("Opening window…"));
        // @ts-ignore - Passage du pseudo
        const res = await Native.openInstanceWindow(acc.token, acc.id, false, acc.username).catch(() => ({ ok: false, error: "error" }));
        if ((res as any).ok) {
            setStatus(t("Window opened ✓"));
            await refreshInstances();
        } else {
            setStatus(`${t("Error:")} ` + ((res as any).error ?? t("unknown")));
        }
        setTimeout(() => setStatus(null), 3000);
    };

    const handleNewDetached = async (acc: AccountEntry) => {
        if (!acc.hasToken) return;
        setCtx(null);
        setStatus(t("Opening detached instance…"));
        // @ts-ignore - Argument 'detached' et pseudo ajoutés
        const res = await Native.openInstanceWindow(acc.token, acc.id, true, acc.username).catch(() => ({ ok: false, error: "error" }));
        if ((res as any).ok) {
            setStatus(t("Instance opened ✓"));
            await refreshInstances();
        } else {
            setStatus(`${t("Error:")} ` + ((res as any).error ?? t("unknown")));
        }
        setTimeout(() => setStatus(null), 3000);
    };

    const handleNewGrouped = async (acc: AccountEntry) => {
        if (!acc.hasToken) return;
        setCtx(null);
        setStatus(t("Opening grouped instance…"));
        // @ts-ignore
        const res = await Native.openInstanceWindowGrouped(acc.token, acc.id, acc.username).catch(() => ({ ok: false, error: "error" }));
        if ((res as any).ok) {
            setStatus(t("Instance opened ✓"));
            await refreshInstances();
        } else {
            setStatus(`${t("Error:")} ` + ((res as any).error ?? t("unknown")));
        }
        setTimeout(() => setStatus(null), 3000);
    };

    const openCtx = (e: React.MouseEvent, acc: AccountEntry) => {
        e.preventDefault();
        e.stopPropagation();
        setCtx({ x: e.clientX, y: e.clientY, acc });
    };

    return (
        <ModalRoot {...rootProps} size="small">
            <ModalHeader separator={false}>
                <Forms.FormTitle tag="h4" style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, color: "#fff" }}>
                    <DiscordIcon /> {t("Multi-instance")}
                </Forms.FormTitle>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>

            <ModalContent className="mi-modal-content">
                <p className="mi-subtitle">
                    <strong>{t("Left click")}</strong> {t("or")} <strong>{t("right click")}</strong> → {t("options menu")}
                </p>

                {/* Active account */}
                {currentUser && (
                    <div className="mi-list">
                        <div className="mi-section-label">{t("ACTIVE ACCOUNT")}</div>
                        <div className="mi-account-row mi-account-row--current">
                            <AccountAvatar
                                url={getAvatarUrl(currentUser.id, currentUser.avatar, currentUser.discriminator)}
                                name={currentUser.username}
                            />
                            <div className="mi-account-info">
                                <span className="mi-account-name">
                                    {(currentUser as any).globalName || currentUser.username}
                                </span>
                                <span className="mi-account-tag">@{currentUser.username}</span>
                            </div>
                            <span className="mi-badge-current">{t("Active")}</span>
                        </div>
                    </div>
                )}

                {/* Autres accounts */}
                <div className="mi-list">
                    <div className="mi-section-label">
                        {allAccounts.length} {t(allAccounts.length !== 1 ? "OTHER ACCOUNTS" : "OTHER ACCOUNT")}
                    </div>

                    {allAccounts.length === 0 ? (
                        <div className="mi-empty">
                            No other account found.<br />
                            Use "<strong>Switch Account</strong>" in Discord or add tokens via <strong>TokenImporter</strong>.
                        </div>
                    ) : allAccounts.map(acc => {
                        const isOpen = openInstances.includes(acc.id);
                        const tagText = acc.hasToken
                            ? (acc.isNative ? "🔗 Discord Account" : `🔑 Token`)
                            : t("Switch only");
                        return (
                            <div
                                key={acc.id}
                                className={`mi-account-row${isOpen ? " mi-account-row--active" : ""}${!acc.hasToken ? " mi-account-row--no-token" : ""}`}
                                onClick={e => openCtx(e, acc)}
                                onContextMenu={e => openCtx(e, acc)}
                            >
                                <AccountAvatar url={acc.avatar} name={acc.username} />
                                <div className="mi-account-info">
                                    <span className="mi-account-name">{acc.username}</span>
                                    <span className="mi-account-tag">
                                        {tagText}{acc.hasToken && acc.discriminator && acc.discriminator !== "0" ? ` · #${acc.discriminator}` : ""}
                                    </span>
                                </div>
                                {isOpen
                                    ? <span className="mi-badge-open">{t("Open")}</span>
                                    : <span className="mi-badge-arrow">›</span>}
                            </div>
                        );
                    })}
                </div>

                {status && (
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "center", margin: "4px 0 0" }}>
                        {status}
                    </p>
                )}
            </ModalContent>

            {/* Context menu via portal */}
            {ctx && (() => {
                const acc = allAccounts.find(a => a.id === ctx.acc.id);
                if (!acc) return null;
                return (
                    <ContextMenuPortal
                        x={ctx.x}
                        y={ctx.y}
                        acc={acc}
                        isOpen={openInstances.includes(acc.id)}
                        onClose={() => setCtx(null)}
                        onNewWindow={() => handleNewWindow(acc)}
                        onNewDetached={() => handleNewDetached(acc)}
                        onNewGrouped={() => handleNewGrouped(acc)}
                        onSwitch={() => acc.token ? switchToQuick(acc.token) : switchNativeAccount(acc.id)}
                    />
                );
            })()}
        </ModalRoot>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composants
// ─────────────────────────────────────────────────────────────────────────────

function AccountAvatar({ url, name }: { url: string; name: string; }) {
    const [err, setErr] = React.useState(false);
    if (err || !url) return <div className="mi-avatar mi-avatar--ph">{name?.[0]?.toUpperCase() ?? "?"}</div>;
    return <img src={url} className="mi-avatar" alt="" onError={() => setErr(true)} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Icônes
// ─────────────────────────────────────────────────────────────────────────────

function DiscordIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.73 4.87a18.2 18.2 0 0 0-4.6-1.44c-.21.4-.4.8-.58 1.21-1.69-.25-3.4-.25-5.1 0-.18-.41-.37-.82-.59-1.2-1.6.27-3.14.75-4.6 1.43A19.04 19.04 0 0 0 .96 17.7a18.43 18.43 0 0 0 5.63 2.87c.46-.62.86-1.28 1.2-1.98-.65-.25-1.29-.55-1.9-.92.17-.12.32-.24.47-.37 3.58 1.7 7.7 1.7 11.28 0l.46.37c-.6.36-1.25.67-1.9.92.35.7.75 1.35 1.2 1.98 2.03-.63 3.94-1.6 5.64-2.87.47-4.87-.78-9.09-3.3-12.83ZM8.3 15.12c-1.1 0-2-1.02-2-2.27 0-1.24.88-2.26 2-2.26s2.02 1.02 2 2.26c0 1.25-.89 2.27-2 2.27Zm7.4 0c-1.1 0-2-1.02-2-2.27 0-1.24.88-2.26 2-2.26s2.02 1.02 2 2.26c0 1.25-.88 2.27-2 2.27Z" />
        </svg>
    );
}

function WindowIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v10z" />
        </svg>
    );
}

function ExternalIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
    );
}

function SwitchIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 17v-3H9v-4h7V7l5 5-5 5zm-9 2H5V5h2V3H5C3.9 3 3 3.9 3 5v14c0 1.1.9 2 2 2h2v-2z" />
        </svg>
    );
}

function GroupedIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 7h20v2H2zm0 4h20v2H2zm0 4h20v2H2z" />
        </svg>
    );
}

function CloseIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        </svg>
    );
}

function MultiInstanceIcon({ width = 20, height = 20 }: { width?: number; height?: number; }) {
    return (
        <svg width={width} height={height} viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.73 4.87a18.2 18.2 0 0 0-4.6-1.44c-.21.4-.4.8-.58 1.21-1.69-.25-3.4-.25-5.1 0-.18-.41-.37-.82-.59-1.2-1.6.27-3.14.75-4.6 1.43A19.04 19.04 0 0 0 .96 17.7a18.43 18.43 0 0 0 5.63 2.87c.46-.62.86-1.28 1.2-1.98-.65-.25-1.29-.55-1.9-.92.17-.12.32-.24.47-.37 3.58 1.7 7.7 1.7 11.28 0l.46.37c-.6.36-1.25.67-1.9.92.35.7.75 1.35 1.2 1.98 2.03-.63 3.94-1.6 5.64-2.87.47-4.87-.78-9.09-3.3-12.83ZM8.3 15.12c-1.1 0-2-1.02-2-2.27 0-1.24.88-2.26 2-2.26s2.02 1.02 2 2.26c0 1.25-.89 2.27-2 2.27Zm7.4 0c-1.1 0-2-1.02-2-2.27 0-1.24.88-2.26 2-2.26s2.02 1.02 2 2.26c0 1.25-.88 2.27-2 2.27Z" />
            <circle cx="19.5" cy="19.5" r="4.5" fill="var(--brand-500, #5865f2)" />
            <path d="M19.5 17.5v4M17.5 19.5h4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bouton header bar
// ─────────────────────────────────────────────────────────────────────────────

function MultiInstanceButton() {
    return (
        <HeaderBarButton
            icon={MultiInstanceIcon}
            tooltip="Multi-instance — open Discord with another account"
            onClick={() => openModal(props => <MultiInstanceModal rootProps={props} />)}
        />
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin
// ─────────────────────────────────────────────────────────────────────────────

export default definePlugin({
    name: "MultiInstance",
    enabledByDefault: true,
    description: "Opens a 2nd Discord (new window or split screen) with another account.",
    authors: [{ name: "Nightcord", id: 0n }],
    dependencies: ["HeaderBarAPI"],

    _fluxUnsub: null as (() => void) | null,

    async start() {
        await loadTokenCache();
        hookEncryptAndStoreTokens();
        this._fluxUnsub = hookFluxDispatcher();
        captureCurrentToken();
        addHeaderBarButton("nightcord-multi-instance", () => <MultiInstanceButton />, 9);
    },

    stop() {
        removeHeaderBarButton("nightcord-multi-instance");
        if (this._fluxUnsub) { this._fluxUnsub(); this._fluxUnsub = null; }
        const root = document.getElementById("nightcord-mi-ctx-root");
        if (root) root.remove();
    },
});
