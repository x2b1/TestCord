/*
 * Nightcord – DoubleCall plugin
 * Rejoins deux canaux vocaux simultanément avec ton propre account.
 * Recopié depuis le build fonctionnel (compiled output).
 */

import "./styles.css";

import { createAudioPlayer, AudioPlayerInterface } from "@api/AudioPlayer";
import definePlugin, { PluginNative } from "@utils/types";
import { UserAreaButton, UserAreaButtonFactory, UserAreaRenderProps } from "@api/UserArea";
import { findStoreLazy, waitFor } from "@webpack";
import { React, useState } from "@webpack/common";

const VoiceStateStore = findStoreLazy("VoiceStateStore");
const UserStore = findStoreLazy("UserStore");
const ChannelStore = findStoreLazy("ChannelStore");

const Native = VencordNative.pluginHelpers.GhostClient as PluginNative<typeof import("../ghostClient/native")>;

let anchorState: { guildId: string; channelId: string; } | null = null;
let playback: AudioPlayerInterface | null = null;

function getMyToken(): string {
    try {
        return (window as any).Vencord?.Webpack?.findByProps?.("getToken")?.getToken?.() ?? "";
    } catch { return ""; }
}

function getMyUserId(): string {
    try { return UserStore?.getCurrentUser?.()?.id ?? ""; }
    catch { return ""; }
}

function getMyVoiceState(): { channelId: string; guildId: string; } | null {
    const uid = getMyUserId();
    if (!uid) return null;
    const vs = VoiceStateStore.getVoiceStateForUser(uid);
    if (!vs?.channelId) return null;
    return {
        channelId: vs.channelId,
        guildId: vs.guildId ?? ChannelStore.getChannel(vs.channelId)?.guild_id ?? "",
    };
}

function showToast(msg: string) {
    try {
        (window as any).Vencord?.Webpack?.findByProps?.("showToast")?.showToast?.(msg);
    } catch { }
}

function PhoneIcon({ className }: { className?: string; }) {
    return (
        <svg aria-hidden="true" role="img" width="20" height="20" viewBox="0 0 24 24" fill="none" className={className}>
            <path d="M6.62 10.79a15.15 15.15 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.17-.22 11.72 11.72 0 0 0 3.69 1.25 1 1 0 0 1 .83.98v3.66a1 1 0 0 1-1 1A16 16 0 0 1 3 4a1 1 0 0 1 1-1h3.66a1 1 0 0 1 .98.83 11.72 11.72 0 0 0 1.25 3.69 1 1 0 0 1-.22 1.17l-2.2 2.22Z" fill="currentColor" fillOpacity="0.4" />
            <path d="M14 2h5a2 2 0 0 1 2 2v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M21 2l-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="18" cy="6" r="2" fill="currentColor" />
        </svg>
    );
}

const DoubleCallButton: UserAreaButtonFactory = ({ iconForeground }: UserAreaRenderProps) => {
    const [active, setActive] = useState(anchorState !== null);

    async function handleClick() {
        const uid = getMyUserId();

        if (anchorState) {
            // Désactiver : On retire uniquement le Ghost, on laisse le compte principal là où il est
            try {
                // 1. Quitter le moteur ghost uniquement
                await Native.leaveVoice(uid);

                // 2. Stopper l'audio de multi-écoute
                if (playback) {
                    playback.stop();
                    playback.delete();
                    playback = null;
                }
            } catch (e) {
                console.error("[DoubleCall] Error while removing ghost:", e);
            }

            anchorState = null;
            setActive(false);
            showToast("Ghost removed. Principal account stays in voice.");
            return;
        }

        // Activer
        const vs = getMyVoiceState();
        if (!vs) {
            showToast("Rejoignez d'abord une voix pour l'ancrer !");
            return;
        }

        const token = getMyToken();
        if (!token) return;

        anchorState = { ...vs };
        await Native.connectGhost(uid, token, vs.guildId, vs.channelId, "default");

        // Multi-écoute : stream WAV depuis le ghost-server
        if (playback) playback.delete();
        playback = createAudioPlayer(`http://127.0.0.1:47821/playback/${uid}`, {
            volume: 100,
            persistent: true,
            onError: e => console.error("[DoubleCall] Playback error:", e),
        });

        setActive(true);
        showToast("Channel anchored. Multi-listen configured ✓");
    }

    return (
        <UserAreaButton
            tooltipText={active ? "Double Call: Active (Anchored)" : "Double Call: Disabled (Click to anchor current channel)"}
            icon={<PhoneIcon className={`${iconForeground} ${active ? "nightcord-dc-active" : ""}`} />}
            onClick={handleClick}
        />
    );
};

export default definePlugin({
    name: "DoubleCall",
    enabledByDefault: true,
    description: "Join two voice channels simultaneously with your own account.",
    authors: [{ name: "Nightcord", id: 0n }],
    userAreaButton: { icon: PhoneIcon, render: DoubleCallButton, priority: 2 },

    async start() {
        // Intercept the voice disconnect message to provide a hint about DoubleCall
        waitFor(m => m != null && Object.getPrototypeOf(m)?.withFormatters != null, (intl: any) => {
            const proto = Object.getPrototypeOf(intl);
            if (proto && !proto.__dc_patched) {
                proto.__dc_patched = true;
                const origFormat = proto.format;
                proto.format = function (args: any) {
                    const res = origFormat.apply(this, arguments);
                    // If we have an anchored channel and get disconnected by "another location",
                    // give a helpful hint instead of the generic error.
                    if (anchorState && typeof res === "string" &&
                        (res.toLowerCase().includes("disconnected") || res.toLowerCase().includes("location") || res.includes("déconnecté")) &&
                        (res.includes("autre") || res.includes("location") || res.includes("another"))) {
                        return "Canal ancré. Pour rester dans 2 salons, rejoignez un second canal !";
                    }
                    return res;
                };
            }
        });
    },

    stop() {
        if (anchorState) {
            Native.leaveVoice(getMyUserId()).catch(() => { });
            anchorState = null;
        }
    },
});

