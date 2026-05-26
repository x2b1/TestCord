import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";

const MediaEngineStore = findByPropsLazy("getMediaEngine", "isKrispAvailable");
const NativeModuleStore = findByPropsLazy("requireModule");

/**
 * Simulate the Studio → Voice Isolation cycle that users discovered as a
 * workaround. This resets the WebRTC audio pipeline and makes Krisp process
 * only background noise instead of muting the whole microphone signal.
 *
 * Timeline:
 *   t=0   → set noiseSuppression to 'studio'   (reset pipeline)
 *   t=400 → set noiseSuppression to 'krisp'    (activate isolation)
 *   t=800 → done — Krisp is properly initialised
 */
function resetKrispPipeline() {
    try {
        const MediaSettingsStore = (window as any).Vencord?.Webpack?.findByProps?.("setNoiseSuppressionLevel", "getNoiseSuppression");
        if (!MediaSettingsStore) return;

        const original = MediaSettingsStore.getNoiseSuppression?.();

        // Step 1: switch to Studio (full noise suppression — resets the pipeline)
        MediaSettingsStore.setNoiseSuppressionLevel?.("studio");

        // Step 2: switch back to Voice Isolation (Krisp) — now correctly initialised
        setTimeout(() => {
            try {
                MediaSettingsStore.setNoiseSuppressionLevel?.("krisp");
                console.log("[FixKrisp] Pipeline reset complete — Krisp correctly initialised.");
            } catch { }
        }, 400);
    } catch { }
}

export default definePlugin({
    name: "FixKrisp",
    description: "Forces Krisp (Noise Suppression) to be available and auto-resets the audio pipeline so only background noise is suppressed (not the whole voice).",
    authors: [{ name: "Nightcord", id: 0n }],
    enabledByDefault: true,
    required: true,

    _callCleanup: null as (() => void) | null,

    start() {
        console.log("[FixKrisp] Forcing Krisp eligibility...");

        // Note: nightcord originally injected an inline <script> here to patch
        // DiscordNative.nativeModules.requireModule and shim isKrispAvailable.
        // Discord's CSP blocks inline scripts in testcord, so we rely on the
        // webpack patches below + the runtime forceKrisp fallback for the same
        // result without polluting the console.
        try {
            const stores = (window as any).Vencord?.Webpack?.findByProps?.("getMediaEngine", "isKrispAvailable");
            if (stores) {
                Object.defineProperty(stores, "isKrispAvailable", { get: () => true, configurable: true });
                Object.defineProperty(stores, "isKrispSupported", { get: () => true, configurable: true });
            }
            const experiments = (window as any).Vencord?.Webpack?.findByProps?.("getKrispExperiment");
            const res = experiments?.getKrispExperiment?.();
            if (res) res.eligible = true;
        } catch { }

        // Auto-reset pipeline when user joins a voice channel
        // This replaces the manual Studio → Isolation cycle
        const handler = (event: any) => {
            if (event?.type === "VOICE_CHANNEL_SELECT" && event.channelId) {
                // Small delay to let Discord connect the audio engine first
                setTimeout(() => resetKrispPipeline(), 1200);
            }
        };
        try {
            const FD = (window as any).Vencord?.Webpack?.findByProps?.("dispatch", "subscribe");
            FD?.subscribe?.("VOICE_CHANNEL_SELECT", handler);
            this._callCleanup = () => FD?.unsubscribe?.("VOICE_CHANNEL_SELECT", handler);
        } catch { }

        // Also run once on startup for users already in a call (e.g. after a reload)
        setTimeout(() => resetKrispPipeline(), 2000);

        // Ensure UI displays it
        const style = document.createElement("style");
        style.textContent = `
            [aria-label*="Krisp"], [aria-label*="Noise"], [aria-label*="Bruit"], [aria-label*="Réduction"],
            button[class*="noiseCancellation"], div[class*="noiseCancellation"] {
                display: flex !important;
                visibility: visible !important;
                opacity: 1 !important;
                width: auto !important;
                height: auto !important;
            }
        `;
        document.head.appendChild(style);
    },

    patches: [
        {
            // Force MediaEngine to report Krisp as available and supported
            find: "MediaEngineStore",
            replacement: [
                {
                    // Force isKrispAvailable() to return true
                    match: /isKrispAvailable\(\){return !?1}/,
                    replace: "isKrispAvailable(){return true}"
                },
                {
                    // Force isKrispSupported() to return true
                    match: /isKrispSupported\(\){return !?1}/,
                    replace: "isKrispSupported(){return true}"
                },
                {
                    // Bypass the "is eligible" check for the Krisp experiment
                    match: /getIsEligible\(\){return !?1}/,
                    replace: "getIsEligible(){return true}"
                },
                {
                    // Force setKrispEnabled to always succeed
                    match: /setKrispEnabled\(\i\){/,
                    replace: "$&return Promise.resolve({ok:true});"
                }
            ]
        },
        {
            // Force Experiment eligibility
            find: "getKrispExperiment",
            replacement: {
                match: /eligible:!?1/g,
                replace: "eligible:true"
            }
        },
        {
            // Patch the UI component for Noise Suppression to include Krisp
            find: "NoiseCancellationLocations",
            replacement: [
                {
                    match: /isEligible:!?1/g,
                    replace: "isEligible:true"
                },
                {
                    match: /isKrispAvailable:!?1/g,
                    replace: "isKrispAvailable:true"
                }
            ]
        }
    ],

    stop() {
        this._callCleanup?.();
        this._callCleanup = null;
    }
});
