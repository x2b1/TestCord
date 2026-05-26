/*
 * Nightcord — MultiInstance native.ts
 *
 * Injection du token : méthode robuste via setPreloads de la session.
 * On crée un script de préchargement TEMPORAIRE dans un fichier que
 * l'on passe à ses.setPreloads([...]) — ce script s'exécute dans
 * le main world AVANT tout JS de la page, garantissant que
 * localStorage.token est défini avant que Discord le lise.
 */

import { BrowserWindow, screen, session, nativeImage, app, ipcMain, systemPreferences, Session } from "electron";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

// Inlined from nightcord/main/mediaPermissions.ts
function registerMediaPermissionsForSession(ses: Session) {
    ses.setPermissionCheckHandler((_webContents, permission, _requestingOrigin, details) => {
        if (permission === "media") {
            return true;
        }
        return true;
    });

    ses.setPermissionRequestHandler(async (_webContents, permission, callback, details) => {
        if (permission === "media") {
            let granted = true;

            if (process.platform === "darwin" && "mediaTypes" in details) {
                if (details.mediaTypes?.includes("audio")) {
                    granted &&= await systemPreferences.askForMediaAccess("microphone");
                }
                if (details.mediaTypes?.includes("video")) {
                    granted &&= await systemPreferences.askForMediaAccess("camera");
                }
            }

            return callback(granted);
        }

        callback(true);
    });
}

const openWindows = new Map<string, BrowserWindow>();

// ─────────────────────────────────────────────────────────────────────────────
// Intercepte les IPC de contrôle de fenêtre pour une instance multi.
//
// Discord natif utilise ipcMain.handle("DISCORD_WINDOW_CLOSE" | "DISCORD_WINDOW_MINIMIZE" | ...)
// Ces handlers sont enregistrés GLOBALEMENT par Discord sur ipcMain, donc ils
// attrapent tous les événements de toutes les fenêtres et appellent injectedGetWindow(key)
// qui retourne toujours la fenêtre principale.
//
// Pour contourner ça, on utilise webContents.ipc.handle sur le webContents
// de chaque fenêtre multi-instance — ces handlers sont LOCAUX à ce webContents
// et ont priorité sur les handlers globaux ipcMain pour ce sender.
// ─────────────────────────────────────────────────────────────────────────────

function registerWindowControlIpc(win: BrowserWindow): () => void {
    const wc = win.webContents as any; // webContents.ipc existe depuis Electron 20

    // Canaux Discord natif (découverts dans _core_extracted/bundle.js)
    const CLOSE     = "DISCORD_WINDOW_CLOSE";
    const MINIMIZE  = "DISCORD_WINDOW_MINIMIZE";
    const MAXIMIZE  = "DISCORD_WINDOW_MAXIMIZE";
    const RESTORE   = "DISCORD_WINDOW_RESTORE";
    const FULLSCREEN = "DISCORD_WINDOW_TOGGLE_FULLSCREEN";

    // webContents.ipc.handle est prioritaire sur ipcMain.handle pour ce sender
    const handleClose     = () => { if (!win.isDestroyed()) win.close(); };
    const handleMinimize  = () => { if (!win.isDestroyed()) win.minimize(); };
    const handleMaximize  = () => {
        if (win.isDestroyed()) return;
        if (win.isMaximized()) win.unmaximize(); else win.maximize();
    };
    const handleRestore   = () => { if (!win.isDestroyed()) win.restore(); };
    const handleFullscreen = () => { if (!win.isDestroyed()) win.setFullScreen(!win.isFullScreen()); };

    try {
        // webContents.ipc.handle (Electron 20+)
        wc.ipc.handle(CLOSE,      handleClose);
        wc.ipc.handle(MINIMIZE,   handleMinimize);
        wc.ipc.handle(MAXIMIZE,   handleMaximize);
        wc.ipc.handle(RESTORE,    handleRestore);
        wc.ipc.handle(FULLSCREEN, handleFullscreen);
    } catch {
        // Fallback : ipcMain.handle global avec filtre sur sender
        // (moins propre mais fonctionne sur Electron < 20)
        //
        // IMPORTANT: DISCORD_WINDOW_TOGGLE_FULLSCREEN est deja enregistre globalement
        // par le patcher principal. On ne le re-enregistre PAS ici pour eviter
        // "Attempted to register a second handler" qui crashe Discord au demarrage.
        const guardedHandle = (fn: () => void) => (event: Electron.IpcMainInvokeEvent) => {
            if (BrowserWindow.fromWebContents(event.sender) !== win) return;
            fn();
        };
        // removeHandler d'abord pour eviter le crash en cas de double appel
        ipcMain.removeHandler(CLOSE);
        ipcMain.removeHandler(MINIMIZE);
        ipcMain.removeHandler(MAXIMIZE);
        ipcMain.removeHandler(RESTORE);
        // NE PAS enregistrer FULLSCREEN - gere globalement par le patcher
        ipcMain.handle(CLOSE,     guardedHandle(handleClose));
        ipcMain.handle(MINIMIZE,  guardedHandle(handleMinimize));
        ipcMain.handle(MAXIMIZE,  guardedHandle(handleMaximize));
        ipcMain.handle(RESTORE,   guardedHandle(handleRestore));
        return () => {
            ipcMain.removeHandler(CLOSE);
            ipcMain.removeHandler(MINIMIZE);
            ipcMain.removeHandler(MAXIMIZE);
            ipcMain.removeHandler(RESTORE);
        };
    }

    // Retourne le nettoyage pour webContents.ipc
    return () => {
        try {
            wc.ipc.removeHandler(CLOSE);
            wc.ipc.removeHandler(MINIMIZE);
            wc.ipc.removeHandler(MAXIMIZE);
            wc.ipc.removeHandler(RESTORE);
            wc.ipc.removeHandler(FULLSCREEN);
        } catch { }
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Crée le script de préchargement qui injecte le token
// ─────────────────────────────────────────────────────────────────────────────

function createTokenPreload(token: string): string {
    // Dossier temporaire dans userData
    const dir = join(app.getPath("userData"), "nightcord-mi-preloads");
    mkdirSync(dir, { recursive: true });

    const safeToken = JSON.stringify(token); // échappe proprement le token

    const script = `
// Nightcord MultiInstance — token preload
// S'exécute dans le main world AVANT Discord
(function() {
    const TOKEN = ${safeToken};
    try {
        // Définit le token dans localStorage
        Object.defineProperty(window, '__nightcord_token', { value: TOKEN, writable: false });

        // Patch localStorage.getItem pour toujours retourner le token si demandé
        const _origGetItem = Storage.prototype.getItem;
        const _origSetItem = Storage.prototype.setItem;

        Storage.prototype.getItem = function(key) {
            if (this === localStorage && key === "token") {
                return JSON.stringify(TOKEN);
            }
            return _origGetItem.call(this, key);
        };

        // Pré-remplit aussi
        try { localStorage.setItem("token", JSON.stringify(TOKEN)); } catch(_) {}

        console.log("[NightcordMI] Token preload active ✓");
    } catch(e) {
        console.warn("[NightcordMI] Preload error:", e);
    }
})();
`;

    const filePath = join(dir, `token-preload-${Date.now()}.js`);
    writeFileSync(filePath, script, "utf-8");
    return filePath;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ouvre une nouvelle fenêtre Discord isolée
// ─────────────────────────────────────────────────────────────────────────────

// Compteur d'icones detached : tourne de 1 a 5
let iconCounter = 1;

// Chemin vers le dossier d'icones detached (multi-instance-icons/ dans le dist)
function getDetachedIconDir(): string {
    // En production : {app_dir}/multi-instance-icons/
    // En dev : Desktop/lolll/
    const exeDir = join(process.execPath, "..")
    const prodDir = join(exeDir, "multi-instance-icons");
    if (existsSync(prodDir)) return prodDir;
    // Fallback dev : Desktop/lolll
    const desktopDir = join(app.getPath("desktop"), "lolll");
    if (existsSync(desktopDir)) return desktopDir;
    return prodDir;
}

export async function openInstanceWindow(
    _: any,
    token: string,
    userId: string,
    detached = false,
    username = ""
): Promise<{ ok: boolean; error?: string; }> {
    try {
        // Fenetre deja ouverte -> focus
        const existing = openWindows.get(userId);
        if (existing && !existing.isDestroyed()) {
            existing.show();
            existing.focus();
            return { ok: true };
        }

        // ID unique par instance - Windows groupe les fenetres par AppUserModelId
        // En donnant un ID different a chaque fenetre, elles ne se regroupent pas
        const uniqueAppId = `nightcord.instance.${userId}.${Date.now()}`;

        // Icone : rotation 1→2→3→4→5→1→... depuis multi-instance-icons/
        let currentIconPath = "";
        const iconDir = getDetachedIconDir();
        currentIconPath = join(iconDir, `${iconCounter}.ico`);
        if (!existsSync(currentIconPath)) currentIconPath = "";
        iconCounter = iconCounter >= 5 ? 1 : iconCounter + 1;

        // Session Electron isolee par userId
        const partition = `persist:nightcord-mi-${userId}`;
        const ses = session.fromPartition(partition, { cache: true });

        ses.webRequest.onHeadersReceived((details, callback) => {
            const headers = { ...details.responseHeaders };
            for (const key of Object.keys(headers)) {
                const low = key.toLowerCase();
                if (low === "content-security-policy" || low === "permissions-policy" || low === "feature-policy") {
                    delete headers[key];
                }
            }
            callback({ responseHeaders: headers });
        });

        registerMediaPermissionsForSession(ses);

        const preloadPath = createTokenPreload(token);
        ses.setPreloads([preloadPath]);

        const win = new BrowserWindow({
            width: 1280,
            height: 800,
            minWidth: 940,
            minHeight: 500,
            parent: undefined,
            skipTaskbar: false,
            frame: false,
            transparent: false,
            titleBarStyle: "hidden",
            autoHideMenuBar: true,
            darkTheme: true,
            backgroundColor: "#313338",
            title: `Nightcord [${username || userId}]`,
            icon: currentIconPath || undefined,
            webPreferences: {
                preload: join(__dirname, "preload.js"),
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: false,
                session: ses,
                webSecurity: false,
            },
        });

        // CRITIQUE : setAppDetails DOIT etre appele immediatement apres new BrowserWindow,
        // avant que la fenetre soit affichee. C'est ce qui empeche Windows de grouper
        // les fenetres ensemble dans la barre des taches.
        if (process.platform === "win32") {
            try {
                win.setAppDetails({
                    appId: uniqueAppId,
                    appIconPath: currentIconPath || undefined,
                    relaunchDisplayName: `Nightcord [${username || userId}]`,
                });
            } catch (err) {
                console.warn("[NightcordMI] setAppDetails failed:", err);
            }
        }

        openWindows.set(userId, win);

        win.on("enter-html-full-screen", () => {
            win.setFullScreen(true);
        });
        win.on("leave-html-full-screen", () => {
            win.setFullScreen(false);
        });

        // Avant fermeture : désinscrit les service workers et coupe le gateway
        // pour stopper toutes les notifications push
        win.on("close", () => {
            wc.executeJavaScript(`
                (async () => {
                    try {
                        const regs = await navigator.serviceWorker.getRegistrations();
                        for (const r of regs) await r.unregister();
                    } catch(e) {}
                    try {
                        // Coupe la connexion gateway Discord
                        const ws = window.__NIGHTCORD_GW_WS__;
                        if (ws && ws.readyState <= 1) ws.close(4000, 'window_close');
                    } catch(e) {}
                })();
            `).catch(() => {});
        });

        // Enregistre les handlers IPC de contrôle de fenêtre (DISCORD_WINDOW_*) sur ce webContents
        // Doit être fait AVANT que Discord charge son JS (dom-ready)
        const wc = win.webContents;
        const cleanupIpc = registerWindowControlIpc(win);

        win.once("closed", () => {
            cleanupIpc();
            openWindows.delete(userId);
            // Nettoie les service workers de la session pour couper définitivement les notifs
            ses.clearStorageData({ storages: ["serviceworkers"] }).catch(() => {});
        });

        // Flash quand il y a des notifs
        wc.on("page-title-updated", (e, title) => {
            if (process.platform === "win32") {
                if (/^\(\d+\)/.test(title)) win.flashFrame(true);
                else win.flashFrame(false);
            }
        });

        // Injection du token
        const safeToken = JSON.stringify(token);
        const injectJs = `(function(){ try { localStorage.setItem("token", ${safeToken}); } catch(e) {} })();`;
        wc.on("dom-ready", () => wc.executeJavaScript(injectJs).catch(() => { }));
        wc.on("did-finish-load", () => wc.executeJavaScript(injectJs).catch(() => { }));
        wc.on("did-navigate", () => wc.executeJavaScript(injectJs).catch(() => { }));

        // Titre de la fenetre
        wc.on("page-title-updated", (e, title) => {
            const cleanTitle = title.replace(/^\(\d+\)\s*/, "").replace(/\s*\[.*\]$/, "");
            win.setTitle(`${cleanTitle} [${username || userId}]`);
            e.preventDefault();
        });

        wc.on("will-navigate", (e, url) => {
            if (!/^https:\/\/(ptb\.|canary\.)?discord\.com/.test(url)) e.preventDefault();
        });

        wc.setWindowOpenHandler(({ url }) => {
            if (url.startsWith("http")) require("electron").shell.openExternal(url);
            return { action: "deny" };
        });

        await win.loadURL("https://discord.com/channels/@me");
        return { ok: true };
    } catch (e: any) {
        return { ok: false, error: e?.message ?? String(e) };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fenetres « groupées » — meme groupe que Nightcord dans la barre des taches
// Principe : on ne touche PAS a setAppDetails => la fenetre herite de l'AppId
// du processus principal (com.nightcord.app), Windows la groupe automatiquement
// ─────────────────────────────────────────────────────────────────────────────

const openGroupedWindows = new Map<string, BrowserWindow>();

export async function openInstanceWindowGrouped(
    _: any,
    token: string,
    userId: string,
    username = ""
): Promise<{ ok: boolean; error?: string; }> {
    try {
        // Focus si deja ouverte
        const existing = openGroupedWindows.get(userId);
        if (existing && !existing.isDestroyed()) {
            existing.show();
            existing.focus();
            return { ok: true };
        }

        // Session isolee par userId
        const partition = `persist:nightcord-mi-${userId}`;
        const ses = session.fromPartition(partition, { cache: true });

        ses.webRequest.onHeadersReceived((details, callback) => {
            const headers = { ...details.responseHeaders };
            for (const key of Object.keys(headers)) {
                const low = key.toLowerCase();
                if (low === "content-security-policy" || low === "permissions-policy" || low === "feature-policy") {
                    delete headers[key];
                }
            }
            callback({ responseHeaders: headers });
        });

        registerMediaPermissionsForSession(ses);

        const preloadPath = createTokenPreload(token);
        ses.setPreloads([preloadPath]);

        const win = new BrowserWindow({
            width: 1280,
            height: 800,
            minWidth: 940,
            minHeight: 500,
            parent: undefined,
            skipTaskbar: false,
            frame: false,
            transparent: false,
            titleBarStyle: "hidden",
            autoHideMenuBar: true,
            darkTheme: true,
            backgroundColor: "#313338",
            title: `Nightcord [${username || userId}]`,
            webPreferences: {
                preload: join(__dirname, "preload.js"),
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: false,
                session: ses,
                webSecurity: false,
            },
        });

        openGroupedWindows.set(userId, win);

        win.on("enter-html-full-screen", () => {
            win.setFullScreen(true);
        });
        win.on("leave-html-full-screen", () => {
            win.setFullScreen(false);
        });

        // Avant fermeture : désinscrit les service workers et coupe le gateway
        win.on("close", () => {
            wc.executeJavaScript(`
                (async () => {
                    try {
                        const regs = await navigator.serviceWorker.getRegistrations();
                        for (const r of regs) await r.unregister();
                    } catch(e) {}
                    try {
                        const ws = window.__NIGHTCORD_GW_WS__;
                        if (ws && ws.readyState <= 1) ws.close(4000, 'window_close');
                    } catch(e) {}
                })();
            `).catch(() => {});
        });

        // Enregistre les handlers IPC de contrôle de fenêtre pour cette instance groupée
        const wc = win.webContents;
        const cleanupIpc = registerWindowControlIpc(win);

        win.once("closed", () => {
            cleanupIpc();
            openGroupedWindows.delete(userId);
            ses.clearStorageData({ storages: ["serviceworkers"] }).catch(() => {});
        });

        wc.on("page-title-updated", (e, title) => {
            if (process.platform === "win32") {
                if (/^\(\d+\)/.test(title)) win.flashFrame(true);
                else win.flashFrame(false);
            }
        });

        const safeToken = JSON.stringify(token);
        const injectJs = `(function(){ try { localStorage.setItem("token", ${safeToken}); } catch(e) {} })();`;
        wc.on("dom-ready", () => wc.executeJavaScript(injectJs).catch(() => {}));
        wc.on("did-finish-load", () => wc.executeJavaScript(injectJs).catch(() => {}));
        wc.on("did-navigate", () => wc.executeJavaScript(injectJs).catch(() => {}));

        wc.on("page-title-updated", (e, title) => {
            const cleanTitle = title.replace(/^\(\d+\)\s*/, "").replace(/\s*\[.*\]$/, "");
            win.setTitle(`${cleanTitle} [${username || userId}]`);
            e.preventDefault();
        });

        wc.on("will-navigate", (e, url) => {
            if (!/^https:\/\/(ptb\.|canary\.)?discord\.com/.test(url)) e.preventDefault();
        });

        wc.setWindowOpenHandler(({ url }) => {
            if (url.startsWith("http")) require("electron").shell.openExternal(url);
            return { action: "deny" };
        });

        await win.loadURL("https://discord.com/channels/@me");
        return { ok: true };
    } catch (e: any) {
        return { ok: false, error: e?.message ?? String(e) };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Split screen : positionne les deux fenêtres côte à côte
// ─────────────────────────────────────────────────────────────────────────────

export async function arrangeSplit(_: any, userId: string): Promise<void> {
    try {
        const secondWin = openWindows.get(userId);
        if (!secondWin || secondWin.isDestroyed()) return;

        const allWins = BrowserWindow.getAllWindows();
        const mainWin = allWins.find(w => w !== secondWin && !w.isDestroyed());
        if (!mainWin) return;

        const display = screen.getDisplayMatching(mainWin.getBounds());
        const { x, y, width, height } = display.workArea;
        const half = Math.floor(width / 2);

        mainWin.setBounds({ x, y, width: half, height }, true);
        secondWin.setBounds({ x: x + half, y, width: width - half, height }, true);
        secondWin.show();
        secondWin.focus();
    } catch (e) {
        console.error("[NightcordMI] arrangeSplit error:", e);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Liste / ferme les instances
// ─────────────────────────────────────────────────────────────────────────────

export async function getOpenInstances(_: any): Promise<string[]> {
    return [...openWindows.entries()]
        .filter(([, w]) => !w.isDestroyed())
        .map(([id]) => id);
}

export async function closeInstance(_: any, userId: string): Promise<void> {
    const win = openWindows.get(userId);
    if (win && !win.isDestroyed()) win.close();
}
