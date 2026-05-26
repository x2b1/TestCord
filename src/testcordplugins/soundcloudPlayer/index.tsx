/*
 * Equicord, a modification for Discord's desktop app
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * SoundCloud / SoundCord Player Plugin
 * Ported from soundcloud_player.h (GTK/C)
 *
 * Client ID is fetched via native.ts (Electron net.fetch, main process)
 * to bypass Discord CSP which blocks fetch() from the renderer.
 */

import "./styles.css";

import { DataStore } from "@api/index";
import { HeaderBarButton } from "@api/HeaderBar";
import { EquicordDevs } from "@utils/constants";
import { openModal, ModalRoot, ModalSize } from "@utils/modal";
import definePlugin, { IconComponent, PluginNative } from "@utils/types";
import { React, useState, useEffect, useRef, Select, MediaEngineStore } from "@webpack/common";
import { t, useTranslation } from "../../plugins/autoTranslateNightcord";

// ─── Native (IPC → main process) ─────────────────────────────────────────────

const Native = VencordNative.pluginHelpers.SoundCordPlayer as PluginNative<typeof import("./native")>;

// ─── SoundCord Icon ──────────────────────────────────────────────────────────

function SoundCloudIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width={20} height={20} fill="none" viewBox="0 0 24 24" {...props}>
            <path fill="currentColor" d="M8.65 1.51A2 2 0 0 0 6 3.41v9.88A3.98 3.98 0 0 0 4.5 13C2.57 13 1 14.34 1 16s1.57 3 3.5 3S8 17.66 8 16V5.4l11 3.81v7.08a3.98 3.98 0 0 0-1.5-.29c-1.93 0-3.5 1.34-3.5 3s1.57 3 3.5 3 3.5-1.34 3.5-3V7.03c0-.74-.47-1.4-1.18-1.65L8.65 1.51Z" />
        </svg>
    );
}

const SoundCloudIconComponent: IconComponent = props => <SoundCloudIcon {...props} />;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScTrack {
    id: string;
    title: string;
    artist: string;
    artworkUrl: string;
    streamUrl: string;
    durationMs: number;
}

// ─── DataStore keys ───────────────────────────────────────────────────────────

const SC_CLIENT_ID_KEY = "SoundCordPlayer_clientId";
const SC_FAVS_KEY = "SoundCordPlayer_favorites";

let cachedClientId: string | null = null;

async function loadCachedClientId(): Promise<string | null> {
    if (cachedClientId) return cachedClientId;
    try {
        const stored = await DataStore.get<string>(SC_CLIENT_ID_KEY);
        if (stored) cachedClientId = stored;
    } catch { }
    return cachedClientId;
}

async function saveClientId(id: string) {
    cachedClientId = id;
    try { await DataStore.set(SC_CLIENT_ID_KEY, id); } catch { }
}

// ─── Client ID Fetch via native (main process) ────────────────────────────

async function fetchClientId(): Promise<string | null> {
    const cached = await loadCachedClientId();
    if (cached) return cached;

    const FALLBACK = "iZIs9mchVcX5lhVRyQGGAYlNPVldzAoX";

    try {
        let id = null;
        if (Native?.fetchSoundCloudClientId) {
            id = await Native.fetchSoundCloudClientId();
        }
        if (!id) id = FALLBACK;
        await saveClientId(id);
        return id;
    } catch (e: any) {
        console.error("[SoundCloudPlayer] fetchClientId:", e?.message);
        await saveClientId(FALLBACK);
        return FALLBACK;
    }
}

async function refreshClientId(): Promise<string | null> {
    cachedClientId = null;
    try { await DataStore.del(SC_CLIENT_ID_KEY); } catch { }
    return fetchClientId();
}

// ─── SoundCloud API via native ────────────────────────────────────────────────

function parseTracks(data: any): ScTrack[] {
    if (!data?.collection) return [];
    const tracks: ScTrack[] = [];
    for (const item of data.collection) {
        if (item.kind !== "track") continue;
        let streamUrl = "";
        const transcodings = item.media?.transcodings ?? [];

        // Priorité 1 : progressive (MP3 direct)
        for (const tc of transcodings) {
            if (tc.format?.protocol === "progressive" && tc.url) {
                streamUrl = tc.url;
                break;
            }
        }

        // Priorité 2 : hls (m3u8 - mieux supporté par les navigateurs modernes)
        if (!streamUrl) {
            for (const tc of transcodings) {
                if (tc.format?.protocol === "hls" && tc.url) {
                    streamUrl = tc.url;
                    break;
                }
            }
        }

        if (!streamUrl) continue;
        let artworkUrl = item.artwork_url || item.user?.avatar_url || "";
        if (artworkUrl) {
            artworkUrl = artworkUrl.replace(/-(large|t500x500|t300x300|t120x120|t200x200|t67x67)/, "-t500x500");
            if (!artworkUrl.includes("-t500x500")) artworkUrl = artworkUrl.replace(/\.jpg$/, "-t500x500.jpg");
        }
        tracks.push({
            id: String(item.id),
            title: item.title ?? "Unknown title",
            artist: item.user?.username ?? "Unknown artist",
            artworkUrl,
            streamUrl,
            durationMs: item.duration ?? 0,
        });
    }
    return tracks;
}

async function searchTracks(query: string, clientId: string): Promise<ScTrack[]> {
    const json = await Native.searchSoundCloud(query, clientId);
    if (!json) throw new Error("Empty response");
    return parseTracks(JSON.parse(json));
}

async function getStreamUrl(streamUrl: string, clientId: string): Promise<string> {
    if (!streamUrl) throw new Error("Stream URL not found");

    // Si c'est déjà une URL de stream finale ou HLS directe
    if (streamUrl.includes("cf-hls-media") || streamUrl.includes("cf-media")) {
        return streamUrl;
    }

    try {
        const url = await Native.resolveStreamUrl(streamUrl, clientId);
        if (!url) throw new Error("Stream URL not found (check region or Go+ status)");
        return url;
    } catch (e: any) {
        throw new Error(e?.message || "Stream URL not found");
    }
}

async function refreshTrackData(track: ScTrack, clientId: string): Promise<ScTrack> {
    try {
        const json = await Native.resolveTrack(track.id, clientId);
        if (!json) return track;
        const data = JSON.parse(json);

        let streamUrl = "";
        const transcodings = data.media?.transcodings ?? [];

        // Priorité 1 : progressive (MP3 direct) - le plus stable
        for (const tc of transcodings) {
            if (tc.format?.protocol === "progressive" && tc.url) {
                streamUrl = tc.url;
                break;
            }
        }

        // Priorité 2 : hls (fallback)
        if (!streamUrl) {
            for (const tc of transcodings) {
                if (tc.format?.protocol === "hls" && tc.url) {
                    streamUrl = tc.url;
                    break;
                }
            }
        }

        if (streamUrl) {
            console.log(`[SoundCord] Track ${track.id} refreshed successfully.`);
            return { ...track, streamUrl };
        }
    } catch (e) {
        console.error(`[SoundCord] Failed to refresh track ${track.id}:`, e);
    }
    return track;
}

// ─── Favorites ──────────────────────────────────────────────────────────────────

async function loadFavorites(): Promise<ScTrack[]> {
    try { return (await DataStore.get<ScTrack[]>(SC_FAVS_KEY)) ?? []; }
    catch { return []; }
}

async function saveFavorites(favs: ScTrack[]) {
    try { await DataStore.set(SC_FAVS_KEY, favs); } catch { }
}

// ─── Duration helper ─────────────────────────────────────────────────────────────

function fmtDuration(ms: number): string {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ─── Player singleton (persiste après fermeture de la modal) ─────────────────

type PlayerListener = () => void;

const playerState = {
    clientId: null as string | null,
    playing: null as ScTrack | null,
    isPlaying: false,
    progress: 0,
    position: 0,
    duration: 0,
    loop: false,
    volume: 80,
    favIndex: -1,
    favorites: [] as ScTrack[],
    status: "Connecting to SoundCloud…",
    audio: null as HTMLAudioElement | null,
    listeners: new Set<PlayerListener>(),

    notify() { this.listeners.forEach(l => l()); },
    subscribe(l: PlayerListener) { this.listeners.add(l); },
    unsubscribe(l: PlayerListener) { this.listeners.delete(l); },
};

let playerInited = false;
async function initPlayer() {
    if (playerInited) return;
    playerInited = true;
    const id = await fetchClientId();
    if (id) {
        playerState.clientId = id;
        playerState.status = "Search for a title or an artist...";
    } else {
        playerState.status = `❌ Impossible to obtain client_id. Check your connection.`;
    }
    playerState.favorites = await loadFavorites();
    playerState.notify();
}

async function getDiscordRealOutputDeviceId(): Promise<string> {
    try {
        const discordId = MediaEngineStore.getOutputDeviceId();
        if (!discordId || discordId === "default") return "";
        
        const devs = MediaEngineStore.getOutputDevices();
        const selected = devs[discordId];
        if (!selected || !selected.name) return "";
        
        let webDevs = await navigator.mediaDevices.enumerateDevices();
        if (webDevs.some(d => d.kind === "audiooutput" && !d.label)) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(t => t.stop());
                webDevs = await navigator.mediaDevices.enumerateDevices();
            } catch { }
        }
        
        const match = webDevs.find(d => 
            d.kind === "audiooutput" && 
            d.label && 
            (d.label.includes(selected.name) || selected.name.includes(d.label) || d.label.toLowerCase() === selected.name.toLowerCase())
        );
        
        if (match) {
            console.log(`[SoundCord] Mapped Discord output device "${selected.name}" to WebAudio deviceId "${match.deviceId}"`);
            return match.deviceId;
        }
    } catch (err) {
        console.error("[SoundCord] Error mapping Discord output device:", err);
    }
    return "";
}

async function playerPlayTrack(track: ScTrack, fromFavIdx = -1) {
    const s = playerState;
    if (!s.clientId) { s.status = `❌ Missing client_id`; s.notify(); return; }
    if (s.audio) { s.audio.pause(); s.audio.src = ""; s.audio = null; }

    s.status = "⏳ Refreshing track...";
    s.playing = track;
    s.favIndex = fromFavIdx;
    s.progress = 0; s.position = 0; s.isPlaying = false;
    s.notify();

    try {
        // Rafraîchir les données de la piste pour éviter les 404 (liens expirés)
        const freshTrack = await refreshTrackData(track, s.clientId);
        s.playing = freshTrack;

        const mp3Url = await getStreamUrl(freshTrack.streamUrl, s.clientId);
        const audio = new Audio();

        // Nettoyage de l'ancienne instance
        if (s.audio) {
            s.audio.pause();
            s.audio.src = "";
            s.audio.load();
        }

        // Error handling for the audio element itself
        audio.addEventListener("error", (e) => {
            const error = audio.error;
            console.error("[SoundCord] HTML5 Audio Error:", error?.code, error?.message);
            if (error?.code === 4 || error?.code === 3) {
                s.status = "❌ Stream error : No supported source found (Region lock?)";
            } else if (error?.code === 2) {
                s.status = "❌ Network error : Connection failed";
            } else {
                s.status = `❌ Audio playback error (${error?.code || "unknown"})`;
            }
            s.isPlaying = false;
            s.notify();
        });

        audio.src = mp3Url;
        audio.crossOrigin = "anonymous";
        audio.volume = s.volume / 100;
        // Apply saved output device
        try {
            const savedOutput = await DataStore.get<string>("SoundCordPlayer_outputDevice");
            let targetDeviceId = "";
            if (savedOutput && savedOutput !== "default") {
                targetDeviceId = savedOutput;
            } else {
                targetDeviceId = await getDiscordRealOutputDeviceId();
            }
            if (targetDeviceId && (audio as any).setSinkId) {
                await (audio as any).setSinkId(targetDeviceId);
            }
        } catch { }
        s.audio = audio;
        audio.addEventListener("loadedmetadata", () => { s.duration = audio.duration; s.notify(); });
        audio.addEventListener("timeupdate", () => {
            s.position = audio.currentTime;
            s.progress = audio.duration > 0 ? audio.currentTime / audio.duration : 0;
            s.notify();
        });
        audio.addEventListener("ended", () => {
            s.isPlaying = false; s.progress = 0; s.position = 0;
            s.notify();
            if (s.loop) {
                setTimeout(() => {
                    if (s.audio) { s.audio.currentTime = 0; s.audio.play().catch(() => { }); s.isPlaying = true; s.notify(); }
                    else playerPlayTrack(track, fromFavIdx);
                }, 100);
            } else if (fromFavIdx >= 0 && s.favorites.length > 1) {
                playerPlayFavAt((fromFavIdx + 1) % s.favorites.length);
            }
        });
        audio.addEventListener("error", () => { s.status = "❌ Audio playback error"; s.isPlaying = false; s.notify(); });
        await audio.play();
        s.isPlaying = true;
        s.status = `▶ Now playing…`;
        s.notify();
    } catch (e: any) {
        s.status = `❌ Stream error : ${e.message}`;
        s.isPlaying = false;
        s.notify();
    }
}

function playerPlayFavAt(idx: number) {
    const favs = playerState.favorites;
    if (favs.length === 0) return;
    const i = ((idx % favs.length) + favs.length) % favs.length;
    playerPlayTrack(favs[i], i);
}

function playerStop() {
    const s = playerState;
    if (s.audio) { s.audio.pause(); s.audio.src = ""; s.audio = null; }
    s.playing = null; s.isPlaying = false; s.progress = 0; s.position = 0; s.favIndex = -1;
    s.status = "Search for a track or an artist...";
    s.notify();
}

// ─── Player Synchronization Hook ────────────────────────────────────────────────

function usePlayerState() {
    const [, forceUpdate] = useState(0);
    useEffect(() => {
        const listener = () => forceUpdate(n => n + 1);
        playerState.subscribe(listener);
        return () => playerState.unsubscribe(listener);
    }, []);
    return playerState;
}

// ─── Composant principal ──────────────────────────────────────────────────────

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function IconSearch() {
    return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><circle cx={11} cy={11} r={8} /><line x1={21} y1={21} x2={16.65} y2={16.65} /></svg>;
}
function IconHeart({ filled }: { filled: boolean; }) {
    return <svg width={14} height={14} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>;
}
function IconPlay({ size = 14 }: { size?: number; }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>;
}
function IconPause() {
    return <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor"><rect x={6} y={4} width={4} height={16} /><rect x={14} y={4} width={4} height={16} /></svg>;
}
function IconPrev() {
    return <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor"><polygon points="19,20 9,12 19,4" /><rect x={5} y={4} width={3} height={16} /></svg>;
}
function IconNext() {
    return <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor"><polygon points="5,4 15,12 5,20" /><rect x={16} y={4} width={3} height={16} /></svg>;
}
function IconStop() {
    return <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor"><rect x={4} y={4} width={16} height={16} rx={2} /></svg>;
}
function IconRepeat({ active }: { active: boolean; }) {
    return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ color: active ? "#c084fc" : undefined }}><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>;
}
function IconVolume({ low }: { low: boolean; }) {
    return low
        ? <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1={15.54} y1={8.46} x2={15.54} y2={15.54} /></svg>
        : <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>;
}
function IconClose() {
    return <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1={18} y1={6} x2={6} y2={18} /><line x1={6} y1={6} x2={18} y2={18} /></svg>;
}
function IconMusicNote() {
    return <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor"><path d="M9 18V5l12-2v13" /><circle cx={6} cy={18} r={3} /><circle cx={18} cy={16} r={3} /></svg>;
}

// ─── Composant principal ──────────────────────────────────────────────────────

const SC_OUTPUT_KEY = "SoundCordPlayer_outputDevice";

function SoundCloudModal({ onClose }: { onClose: () => void; }) {
    const [tab, setTab] = useState<"search" | "favs">("search");
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<ScTrack[]>([]);
    const [showSettings, setShowSettings] = useState(false);
    const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedOutput, setSelectedOutput] = useState<string>("default");
    const p = usePlayerState();
    const progressRef = useRef<HTMLDivElement>(null);

    useEffect(() => { initPlayer(); }, []);

    useEffect(() => {
        const load = async () => {
            try {
                // FIX: MediaEngineStore.getOutputDevices() retourne les IDs internes Discord,
                // PAS les vrais deviceId WebAudio requis par setSinkId().
                // On utilise navigator.mediaDevices.enumerateDevices() pour avoir les vrais deviceId.
                let devices = await navigator.mediaDevices.enumerateDevices();
                const outputs = devices.filter(d => d.kind === "audiooutput");

                // Si les labels sont vides (permission pas encore accordée), on essaie de les obtenir
                if (outputs.some(d => !d.label)) {
                    try {
                        // Demander accès micro déclenche la permission pour lister les outputs aussi
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        stream.getTracks().forEach(t => t.stop());
                        devices = await navigator.mediaDevices.enumerateDevices();
                    } catch { }
                }

                setOutputDevices(devices.filter(d => d.kind === "audiooutput"));
                const saved = await DataStore.get<string>(SC_OUTPUT_KEY);
                if (saved) setSelectedOutput(saved);
            } catch { }
        };
        load();
    }, []);


    async function applyOutputDevice(deviceId: string) {
        setSelectedOutput(deviceId);
        await DataStore.set(SC_OUTPUT_KEY, deviceId);
        // Apply to current audio if possible
        try {
            if (p.audio && (p.audio as any).setSinkId) {
                const realId = deviceId === "default"
                    ? await getDiscordRealOutputDeviceId()
                    : deviceId;
                await (p.audio as any).setSinkId(realId);
            }
        } catch { }
    }

    async function doSearch(isRetry = false) {
        if (!p.clientId || !query.trim()) return;
        p.status = "Searching..."; p.notify();
        try {
            const tracks = await searchTracks(query, p.clientId);
            setResults(tracks);
            p.status = tracks.length > 0 ? `${tracks.length} results` : "No results";
            p.notify();
        } catch (e: any) {
            if (!isRetry && (e.message?.includes("401") || e.message?.includes("403"))) {
                p.status = "Refreshing connection..."; p.notify();
                const newId = await refreshClientId();
                if (newId) { 
                    p.clientId = newId; 
                    return doSearch(true);
                }
                else { p.status = "Connection impossible"; p.notify(); }
            } else { p.status = `Error : ${e.message}`; p.notify(); }
        }
    }

    function togglePause() {
        if (!p.audio) return;
        if (p.isPlaying) { p.audio.pause(); p.isPlaying = false; p.notify(); }
        else { p.audio.play(); p.isPlaying = true; p.notify(); }
    }

    function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
        if (!p.audio || !progressRef.current) return;
        const rect = progressRef.current.getBoundingClientRect();
        const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        p.audio.currentTime = frac * (p.audio.duration || 0);
        p.progress = frac; p.notify();
    }

    function navFav(dir: 1 | -1) {
        const base = p.favIndex >= 0 ? p.favIndex : (dir > 0 ? -1 : p.favorites.length);
        playerPlayFavAt(((base + dir) % p.favorites.length + p.favorites.length) % p.favorites.length);
    }

    async function toggleFavorite(track: ScTrack) {
        const favs = [...p.favorites];
        const idx = favs.findIndex(f => f.id === track.id);
        if (idx >= 0) favs.splice(idx, 1); else favs.push(track);
        p.favorites = favs; p.notify();
        await saveFavorites(favs);
    }

    const isFav = (t: ScTrack) => p.favorites.some(f => f.id === t.id);
    const trackList: ScTrack[] = tab === "search" ? results : p.favorites;

    return (
        <div className="sc-player-root">

            {/* Header */}
            <div className="sc-header">
                <span className="sc-header-title">
                    <IconMusicNote />
                    SoundCord Player
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {/* Bouton settings */}
                    <button
                        className="sc-close-btn"
                        title="Audio output"
                        onClick={() => setShowSettings(v => !v)}
                        style={{ color: showSettings ? "#c084fc" : undefined }}
                    >
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <circle cx={12} cy={12} r={3} />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                    </button>
                    <button className="sc-close-btn" onClick={onClose}><IconClose /></button>
                </div>
            </div>

            {/* Panneau settings sortie audio */}
            {showSettings && (
                <div style={{
                    padding: "8px 12px",
                    background: "rgba(0,0,0,0.2)",
                    borderBottom: "1px solid rgba(255,255,255,0.07)",
                    display: "flex", alignItems: "center", gap: 8
                }}>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap" }}>Audio output</span>
                    <div style={{ flex: 1 }}>
                        <Select
                            options={[
                                { value: "default", label: "Default" },
                                ...outputDevices.map(d => ({
                                    value: d.deviceId,
                                    label: d.label || d.deviceId.slice(0, 30)
                                }))
                            ]}
                            select={(v: string) => applyOutputDevice(v)}
                            isSelected={(v: string) => v === selectedOutput}
                            serialize={(v: string) => v}
                            popoutWidth={300}
                        />
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="sc-search-row">
                <input className="sc-search-input" value={query}
                    onChange={e => setQuery(e.currentTarget.value)}
                    onKeyDown={e => e.key === "Enter" && doSearch(false)}
                    placeholder="Track, artist..." />
                <button className="sc-search-btn" onClick={() => doSearch(false)} disabled={!p.clientId}>Search</button>
            </div>

            {/* Tabs */}
            <div className="sc-tabs">
                <button className={`sc-tab${tab === "search" ? " sc-tab-active" : ""}`} onClick={() => setTab("search")}>
                    Results
                </button>
                <button className={`sc-tab${tab === "favs" ? " sc-tab-active" : ""}`} onClick={() => setTab("favs")}>
                    Favorites {p.favorites.length > 0 && `(${p.favorites.length})`}
                </button>
            </div>

            <div className="sc-status">{p.status}</div>

            {/* Track list */}
            <div className="sc-tracklist">
                {trackList.length === 0 ? (
                    <div className="sc-empty">
                        {tab === "search" ? "Start a search to see tracks" : "No favorites saved"}
                    </div>
                ) : trackList.map((track, idx) => (
                    <div key={track.id}
                        className={`sc-track-row${p.playing?.id === track.id ? " sc-track-playing" : ""}`}
                        onClick={() => tab === "favs" ? playerPlayFavAt(idx) : playerPlayTrack(track)}>
                        <img className="sc-artwork" src={track.artworkUrl || ""} alt=""
                            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        <div className="sc-track-info">
                            <div className="sc-track-title">{track.title}</div>
                            <div className="sc-track-artist">{track.artist} · {fmtDuration(track.durationMs)}</div>
                        </div>
                        <button className="sc-play-btn"
                            onClick={e => { e.stopPropagation(); tab === "favs" ? playerPlayFavAt(idx) : playerPlayTrack(track); }}>
                            <IconPlay />
                        </button>
                        <button className={`sc-fav-btn${isFav(track) ? " sc-fav-active" : ""}`}
                            onClick={e => { e.stopPropagation(); toggleFavorite(track); }}
                            title={isFav(track) ? "Remove from favorites" : "Add to favorites"}>
                            <IconHeart filled={isFav(track)} />
                        </button>
                    </div>
                ))}
            </div>

            {/* Now Playing */}
            {p.playing && (
                <div className="sc-now-playing">
                    <div className="sc-np-top">
                        <img className="sc-np-artwork" src={p.playing.artworkUrl || ""} alt=""
                            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        <div className="sc-np-info">
                            <div className="sc-np-title">{p.playing.title}</div>
                            <div className="sc-np-artist">{p.playing.artist}</div>
                        </div>
                    </div>
                    <div ref={progressRef} className="sc-progress-bar" onClick={handleSeek}>
                        <div className="sc-progress-fill" style={{ width: `${p.progress * 100}%` }} />
                    </div>
                    <div className="sc-time-row">
                        <span>{fmtDuration(p.position * 1000)}</span>
                        <span>{fmtDuration(p.duration * 1000)}</span>
                    </div>
                    <div className="sc-controls">
                        <button className="sc-ctrl-btn" onClick={() => navFav(-1)} title="Previous"><IconPrev /></button>
                        <button className="sc-play-pause-btn" onClick={togglePause}>
                            {p.isPlaying ? <IconPause /> : <IconPlay size={16} />}
                        </button>
                        <button className="sc-ctrl-btn" onClick={() => navFav(+1)} title="Next"><IconNext /></button>
                        <button className="sc-ctrl-btn" onClick={playerStop} title="Stop"><IconStop /></button>
                        <button className={`sc-ctrl-btn${p.loop ? " sc-ctrl-active" : ""}`}
                            onClick={() => { p.loop = !p.loop; p.notify(); }} title="Loop">
                            <IconRepeat active={p.loop} />
                        </button>
                    </div>
                    <div className="sc-volume-row">
                        <IconVolume low={p.volume < 50} />
                        <input type="range" min={0} max={100} value={p.volume}
                            className="sc-volume-slider"
                            onChange={e => {
                                p.volume = Number(e.currentTarget.value);
                                if (p.audio) p.audio.volume = p.volume / 100;
                                p.notify();
                            }} />
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Thumbnail Toolbar Windows ──────────────────────────────────────────────

let thumbarListener: (() => void) | null = null;

function initThumbar() {
    try {
        const win = VencordNative?.window as any;
        if (!win?.setThumbarButtons || !win?.onThumbarClick) return;

        // Listen for taskbar clicks
        win.onThumbarClick((action: string) => {
            const s = playerState;
            try {
                if (action === "prev") {
                    if (s.favIndex >= 0) playerPlayFavAt(s.favIndex - 1);
                } else if (action === "next") {
                    if (s.favIndex >= 0) playerPlayFavAt(s.favIndex + 1);
                } else if (action === "play") {
                    if (s.audio) { s.audio.play().catch(() => { }); s.isPlaying = true; s.notify(); }
                } else if (action === "pause") {
                    if (s.audio) { s.audio.pause(); s.isPlaying = false; s.notify(); }
                }
            } catch { }
        });

        // Sync thumbar on every player state change
        thumbarListener = () => {
            try {
                const s = playerState;
                const state: "playing" | "paused" | "stopped" = !s.playing ? "stopped" : s.isPlaying ? "playing" : "paused";
                win.setThumbarButtons(state).catch(() => { });
            } catch { }
        };
        playerState.subscribe(thumbarListener);
    } catch { }
}

function cleanupThumbar() {
    try {
        const win = VencordNative?.window as any;
        if (win?.removeThumbarClickListener) win.removeThumbarClickListener();
        if (win?.setThumbarButtons) win.setThumbarButtons("stopped").catch(() => { });
        if (thumbarListener) {
            playerState.unsubscribe(thumbarListener);
            thumbarListener = null;
        }
    } catch { }
}

// ─── Bouton HeaderBar ─────────────────────────────────────────────────────────

function SCHeaderBarButton() {
    return (
        <HeaderBarButton
            tooltip="SoundCord Player"
            position="bottom"
            icon={SoundCloudIconComponent}
            onClick={() => openModal(props => (
                <ModalRoot {...props} size={ModalSize.SMALL}>
                    <SoundCloudModal onClose={props.onClose} />
                </ModalRoot>
            ))}
        />
    );
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default definePlugin({
    name: "SoundCordPlayer",
    enabledByDefault: true,
    description: "Integrated SoundCord player. Client ID is automatically fetched via native Electron process — no account required.",
    authors: [EquicordDevs.nobody],

    toolboxActions: {
        "Open SoundCord"() {
            openModal(props => (
                <ModalRoot {...props} size={ModalSize.SMALL}>
                    <SoundCloudModal onClose={props.onClose} />
                </ModalRoot>
            ));
        }
    },

    headerBarButton: {
        icon: SoundCloudIconComponent,
        render: SCHeaderBarButton,
    },

    search: searchTracks,
    get clientId() { return playerState.clientId; },

    start() {
        fetchClientId().catch(() => { });
        initThumbar();
    },

    stop() {
        cleanupThumbar();
        playerStop();
        playerInited = false;
    },
});
