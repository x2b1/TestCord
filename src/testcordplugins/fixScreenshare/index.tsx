import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { FluxDispatcher } from "@webpack/common";

const MediaEngineStore = findByPropsLazy("getMediaEngine");

function fixEngine() {
    try {
        const engine = MediaEngineStore.getMediaEngine();
        if (engine) {
            if (typeof engine.reconfigure === "function") {
                console.log("[FixScreenshare] Forcing media engine reconfiguration...");
                engine.reconfigure();
            }
            // Some versions use setVideoCapturerSource for initialization
            if (typeof engine.setVideoCapturerSource === "function") {
                console.log("[FixScreenshare] Media Engine capturer ready.");
            }
        }
    } catch (e) {
        console.error("[FixScreenshare] Error during engine fix:", e);
    }
}

const handleVoiceChannelSelect = () => {
    // Small delay to let Discord settle after joining voice
    setTimeout(fixEngine, 1000);
};

export default definePlugin({
    name: "FixScreenshare",
    description: "Fixes infinite loading and crashes on screenshare after reload (Ctrl+R) by forcing module re-initialization.",
    authors: [{ name: "Nightcord", id: 0n }],
    required: true,

    start() {
        console.log("[FixScreenshare] Mandatory fix starting...");

        // Run immediately and after a short delay to ensure Discord is ready
        fixEngine();
        setTimeout(fixEngine, 5000);
        setTimeout(fixEngine, 15000);

        // Listen for voice channel joins to re-apply fix
        FluxDispatcher.subscribe("VOICE_CHANNEL_SELECT", handleVoiceChannelSelect);
    },

    stop() {
        FluxDispatcher.unsubscribe("VOICE_CHANNEL_SELECT", handleVoiceChannelSelect);
    }
});
