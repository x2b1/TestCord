/*
 * GhostClient native.ts — main process Electron
 * Lance ghost-server via node.exe bundlé dans nightcord-dist
 * Communication via HTTP localhost:47821
 */

import { app, shell, ipcMain } from "electron";
import * as childProcess from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";

// Handler IPC pour ouvrir les URLs externes (utilisé par NightcordUpdater)
ipcMain.handle("NIGHTCORD_OPEN_URL", (_event, url: string) => {
    if (typeof url === "string" && url.startsWith("https://")) {
        shell.openExternal(url);
    }
});

const PORT = 47821;
let serverProc: childProcess.ChildProcess | null = null;
let serverReady = false;
let startPromise: Promise<boolean> | null = null;

// ── Trouver ghost-server/server.js ────────────────────────────────────────────
function findServerScript(): string | null {
    const execDir = path.dirname(process.execPath);
    const resPath = (process as any).resourcesPath ?? "";
    const candidates = [
        // Production Electron : resources/ghost-server/server.js
        path.join(resPath, "ghost-server", "server.js"),
        // Production Electron (avec app.asar décompressé) : resources/app/ghost-server/server.js
        path.join(resPath, "app", "ghost-server", "server.js"),
        // Production : exe + resources/ sous-dossier
        path.join(execDir, "resources", "ghost-server", "server.js"),
        path.join(execDir, "resources", "app", "ghost-server", "server.js"),
        // Portable (dist/desktop extrait) : exe dans dist/desktop, ghost-server à côté
        path.join(execDir, "ghost-server", "server.js"),
        // dev-inject : __dirname = dist/desktop/renderer
        path.join(__dirname, "..", "..", "ghost-server", "server.js"),
        path.join(__dirname, "..", "..", "..", "ghost-server", "server.js"),
        path.join(__dirname, "..", "..", "..", "..", "ghost-server", "server.js"),
        // Racine du repo en dev
        path.join(resPath, "..", "ghost-server", "server.js"),
    ];
    console.log("[GhostNative] execPath:", process.execPath);
    console.log("[GhostNative] resourcesPath:", resPath);
    console.log("[GhostNative] __dirname:", __dirname);
    for (const c of candidates) {
        console.log("[GhostNative] test:", c, fs.existsSync(c) ? "✓" : "✗");
        if (fs.existsSync(c)) { console.log("[GhostNative] server.js trouvé:", c); return c; }
    }
    console.error("[GhostNative] server.js introuvable ! Candidats testés:", candidates.length);
    return null;
}

function findNode(): string {
    const execDir = path.dirname(process.execPath);
    const resPath = (process as any).resourcesPath ?? "";
    const candidates = [
        // Production Electron : node.exe copié à côté du .exe Discord
        path.join(execDir, "node.exe"),
        // Production : dans resources/ (collect-assets copie là)
        path.join(resPath, "node.exe"),
        path.join(resPath, "..", "node.exe"),
        path.join(resPath, "app", "node.exe"),
        // Dans le sous-dossier resources/
        path.join(execDir, "resources", "node.exe"),
        path.join(execDir, "resources", "app", "node.exe"),
        // Portable : dist/desktop contient node.exe, __dirname remonte à dist/desktop
        path.join(__dirname, "..", "..", "node.exe"),
        path.join(__dirname, "..", "..", "..", "node.exe"),
        // NVM for Windows
        path.join(process.env.LOCALAPPDATA ?? "", "nvm", "nodejs", "node.exe"),
        "C:\\nvm4w\\nodejs\\node.exe",
        "C:\\Program Files\\nodejs\\node.exe",
        "C:\\Program Files (x86)\\nodejs\\node.exe",
        path.join(process.env.LOCALAPPDATA ?? "", "Programs", "nodejs", "node.exe"),
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) { console.log("[GhostNative] node.exe trouvé:", c); return c; }
    }
    console.warn("[GhostNative] node.exe bundlé introuvable, fallback vers 'node' du PATH");
    return "node";
}

function ping(): Promise<boolean> {
    return new Promise(resolve => {
        const req = http.get(`http://127.0.0.1:${PORT}/status`, res => {
            resolve(res.statusCode === 200);
        });
        req.setTimeout(1500, () => { req.destroy(); resolve(false); });
        req.on("error", () => resolve(false));
    });
}

async function killZombieServer(): Promise<void> {
    // Si un ghost-server zombie tourne depuis un crash précédent, le tuer proprement
    try {
        const res = await Promise.race([
            ping(),
            new Promise<boolean>(r => setTimeout(() => r(false), 500))
        ]);
        if (res) {
            // Un serveur répond — vérifier si c'est le nôtre ou un zombie
            if (!serverProc) {
                // Pas notre process — c'est un zombie du crash précédent
                // On essaie de l'arrêter via l'API HTTP
                try {
                    await new Promise<void>((resolve) => {
                        const req = http.request({ hostname: '127.0.0.1', port: PORT, path: '/shutdown', method: 'POST' }, () => resolve());
                        req.setTimeout(1000, () => { req.destroy(); resolve(); });
                        req.on('error', () => resolve());
                        req.end();
                    });
                } catch { }
                // Fallback : taskkill
                try {
                    childProcess.execSync('taskkill /F /IM node.exe /FI "WINDOWTITLE eq ghost-server"', { stdio: 'ignore' });
                } catch { }
                await new Promise(r => setTimeout(r, 500));
            }
        }
    } catch { }
}

async function ensureServer(): Promise<boolean> {
    if (serverReady && await ping()) return true;
    if (startPromise) return startPromise;

    startPromise = (async () => {
        // Tuer les zombies avant de démarrer
        await killZombieServer();
        if (await ping()) { serverReady = true; return true; }

        const script = findServerScript();
        if (!script) {
            console.error("[GhostNative] server.js introuvable !");
            startPromise = null;
            return false;
        }

        const nodeExe = findNode();
        const scriptDir = path.dirname(script);
        const nodeModulesPath = path.join(scriptDir, "node_modules");
        console.log(`[GhostNative] Lancement: ${nodeExe} ${script}`);
        console.log(`[GhostNative] cwd: ${scriptDir}`);
        console.log(`[GhostNative] node_modules exists: ${fs.existsSync(nodeModulesPath)}`);

        serverProc = childProcess.spawn(nodeExe, [script], {
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"],
            detached: false,
            cwd: scriptDir,
            env: {
                ...process.env,
            }
        });

        // Limiter les logs du ghost-server dans le main process Electron
        // Trop de logs = I/O sur le thread principal = freezes
        // Mais on les écrit dans un fichier de log pour le débogage
        const logPath = path.join(app.getPath("userData"), "ghost-server.log");
        let logStream: fs.WriteStream | null = null;
        try {
            logStream = fs.createWriteStream(logPath, { flags: "w" });
            logStream.write(`=== GHOST SERVER LOGS STARTED AT ${new Date().toISOString()} ===\n`);
            console.log("[GhostNative] Log file created at:", logPath);
        } catch (e: any) {
            console.error("[GhostNative] Impossible de creer le fichier de log:", e.message);
        }

        let logBuffer = "";
        serverProc.stdout?.on("data", (d: Buffer) => {
            if (logStream) logStream.write(d);
            logBuffer += d.toString();
            const lines = logBuffer.split("\n");
            logBuffer = lines.pop() ?? "";
            for (const line of lines) {
                if (line.trim()) console.log("[GhostServer]", line.trim());
            }
        });
        serverProc.stderr?.on("data", (d: Buffer) => {
            if (logStream) logStream.write(d);
            const msg = d.toString().trim();
            if (msg) console.error("[GhostServer ERR]", msg);
        });
        serverProc.on("exit", (code: number | null) => {
            console.log("[GhostNative] server exit:", code);
            if (logStream) {
                logStream.write(`\n=== GHOST SERVER EXITED WITH CODE ${code} ===\n`);
                logStream.end();
            }
            serverProc = null;
            serverReady = false;
        });
        serverProc.on("error", (e: Error) => {
            console.error("[GhostNative] spawn error:", e.message);
            if (logStream) {
                logStream.write(`\n=== GHOST SERVER SPAWN ERROR: ${e.message} ===\n`);
            }
        });

        // Poll toutes les 200ms pendant 60s max
        for (let i = 0; i < 300; i++) {
            await new Promise(r => setTimeout(r, 200));
            if (await ping()) {
                console.log("[GhostNative] ghost-server prêt ✓");
                serverReady = true;
                startPromise = null;
                return true;
            }
        }

        console.error("[GhostNative] ghost-server timeout !");
        startPromise = null;
        return false;
    })();

    return startPromise;
}

async function api(endpoint: string, body?: object, timeoutMs = 15000): Promise<any> {
    // FIX : timeout réduit de 90s → 15s.
    // 90s bloquait l'UI Discord entière pendant presque 2 minutes si le ghost-server
    // ne répondait pas (ex: yt-dlp en cours, ffmpeg qui démarre).
    // 15s est largement suffisant pour tous les appels rapides (/connect, /join, /leave).
    // Les appels lents (/stream-start) sont maintenant non-bloquants côté server.js.
    const ok = await ensureServer();
    if (!ok) return { ok: false, error: "ghost-server introuvable ou timeout" };

    return new Promise((resolve, reject) => {
        const data = body !== undefined ? JSON.stringify(body) : undefined;
        const opts: http.RequestOptions = {
            hostname: "127.0.0.1",
            port: PORT,
            path: endpoint,
            method: body !== undefined ? "POST" : "GET",
            headers: {
                "Content-Type": "application/json",
                ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
            },
        };
        const req = http.request(opts, res => {
            let raw = "";
            res.on("data", c => raw += c);
            res.on("end", () => {
                try { resolve(JSON.parse(raw)); }
                catch { resolve({ ok: false, error: "Invalid JSON" }); }
            });
        });
        // FIX : timeout de 15s au lieu de 90s — évite de geler l'UI Discord
        req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error(`Timeout ${timeoutMs / 1000}s`)); });
        req.on("error", reject);
        if (data) req.write(data);
        req.end();
    });
}

export async function listAudioInputDevices(_: any): Promise<{ label: string; dshowName: string; }[]> {
    // FIX : on essaie le ghost-server D'ABORD (rapide, < 1s si dispo).
    // Avant ce fix, si le ghost-server n'était pas prêt, on spawnait ffmpeg directement
    // sur le main process Electron avec un timeout de 8s — ce qui freezait l'UI Discord
    // pendant 8 secondes et expliquait le "ça charge longtemps" sur le sélecteur d'écran.
    // Maintenant : ghost-server en 1s → fallback ffmpeg en 5s max (réduit de 8s).
    try {
        const ok = await Promise.race([
            ping(),
            new Promise<boolean>(r => setTimeout(() => r(false), 1000))
        ]);
        if (ok) {
            const res = await api("/devices", undefined, 3000);
            if (res?.devices?.length) {
                const names: string[] = res.devices;
                return names.map((n: string) => ({ label: n, dshowName: n }));
            }
        }
    } catch { }

    // Fallback ffmpeg direct — timeout réduit à 5s (au lieu de 8s)
    return new Promise(resolve => {
        const ghostServerNodeModules = path.join(process.resourcesPath ?? "", "ghost-server", "node_modules");
        const ffmpegCandidates = [
            path.join(path.dirname(process.execPath), "ffmpeg.exe"),
            path.join(process.resourcesPath ?? "", "..", "ffmpeg.exe"),
            // Bundled via node-av dans ghost-server/node_modules (déjà dans l'installer)
            path.join(ghostServerNodeModules, "node-av", "binary", "ffmpeg.exe"),
            path.join(ghostServerNodeModules, "node_modules", "node-av", "binary", "ffmpeg.exe"),
            "ffmpeg",
        ];
        let ffmpeg = "ffmpeg";
        for (const c of ffmpegCandidates) {
            if (c !== "ffmpeg" && fs.existsSync(c)) { ffmpeg = c; break; }
        }

        try {
            const proc = childProcess.spawn(ffmpeg, [
                "-list_devices", "true", "-f", "dshow", "-i", "dummy", "-hide_banner"
            ], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });

            const chunks: Buffer[] = [];
            proc.stderr?.on("data", (d: Buffer) => chunks.push(d));
            proc.stdout?.on("data", (d: Buffer) => chunks.push(d));

            proc.on("exit", () => {
                // Décode UTF-8, fallback latin1 si caractères de remplacement
                // (ffmpeg Windows utilise le codepage système, pas UTF-8)
                const raw = Buffer.concat(chunks);
                let out = raw.toString("utf8");
                if (out.includes("\ufffd")) out = raw.toString("latin1");
                const names: string[] = [];
                for (const line of out.split(/\r?\n/)) {
                    if (!/\(audio\)/i.test(line) || /Alternative name/i.test(line)) continue;
                    const m = line.match(/"([^"]+)"/);
                    if (!m) continue;
                    const name = m[1].trim();
                    if (!name.startsWith("@") && name.length >= 2 && !names.includes(name))
                        names.push(name);
                }
                resolve(names.map((n: string) => ({ label: n, dshowName: n })));
            });

            proc.on("error", () => resolve([]));
            // FIX : timeout réduit à 5s (au lieu de 8s) — réduit le freeze UI de 37%
            setTimeout(() => { try { proc.kill(); } catch { } resolve([]); }, 5000);
        } catch { resolve([]); }
    });
}

export async function connectGhost(
    _: any, userId: string, token: string, guildId: string, channelId: string, micDevice: string,
): Promise<{ ok: boolean; error?: string; }> {
    // Le ghost-server attend DVS en interne (jusqu'à 60s) + login (20s) + joinVoice
    // Timeout HTTP de 120s pour couvrir le pire cas sans stacker waitForDVS
    try { return await api("/connect", { userId, token, guildId, channelId, micDevice }, 120000); }
    catch (e: any) { return { ok: false, error: e?.message ?? String(e) }; }
}

export async function preConnectGhost(
    _: any, userId: string, token: string, micDevice: string,
): Promise<{ ok: boolean; error?: string; }> {
    try { return await api("/preconnect", { userId, token, micDevice }, 120000); }
    catch (e: any) { return { ok: false, error: e?.message ?? String(e) }; }
}

export async function joinVoice(
    _: any, userId: string, guildId: string, channelId: string, micDevice: string,
): Promise<{ ok: boolean; error?: string; }> {
    try { return await api("/join", { userId, guildId, channelId, micDevice }); }
    catch (e: any) { return { ok: false, error: e?.message ?? String(e) }; }
}

export async function joinVoiceAll(
    _: any, userIds: string[], guildId: string, channelId: string, micDevice: string,
): Promise<{ ok: boolean; }> {
    try { await api("/join-all", { userIds, guildId, channelId, micDevice }); return { ok: true }; }
    catch { return { ok: false }; }
}

export async function leaveVoiceAll(_: any, userIds: string[]): Promise<void> {
    try { await api("/leave-all", { userIds }); } catch { }
}

export async function leaveVoice(_: any, userId: string): Promise<void> {
    try { await api("/leave", { userId }); } catch { }
}

export async function disconnectGhost(_: any, userId: string): Promise<void> {
    try { await api("/disconnect", { userId }); } catch { }
}

export async function init(_: any): Promise<void> {
    const script = findServerScript();
    console.log("[GhostNative] init — server.js:", script ?? "NON TROUVÉ");
    console.log("[GhostNative] node exe:", findNode());

    const ok = await ensureServer();
    if (!ok) {
        console.error("[GhostNative] ghost-server failed");
        return;
    }
    console.log("[GhostNative] ghost-server HTTP prêt ✓");
}

// ── Cleanup ───────────────────────────────────────────────────────────────────
app.on("before-quit", () => {
    if (serverProc) {
        try { serverProc.kill(); } catch { }
        serverProc = null;
    }
});
