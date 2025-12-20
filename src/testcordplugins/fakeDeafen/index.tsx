import definePlugin from "@utils/types";
import { findByProps, findComponentByCodeLazy } from "@webpack";
import { React } from "@webpack/common";

import { TestcordDevs } from "@utils/constants";

let originalVoiceStateUpdate: any;
let fakeDeafenEnabled = false;

// Removed custom Button component, now using UserAreaButton from API

function FakeDeafenIcon() {
    return (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M14 2a1 1 0 0 0 -1 1v1c0 5.5 -2.5 10 -7 10" />
            <path d="M17 2a1 1 0 0 0 0 2" />
            <path d="M11 18v-1a4 4 0 0 0 -4 -4h-1" />
            <path d="M7 9v-1a4 4 0 0 1 4 -4h1" />
            <path d="M21 15v-6a2 2 0 0 0 -2 -2h-2" />
            <path d="M3 15v-6a2 2 0 0 1 2 -2h2" />
            <path d="M7 10v-1a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v1" />
            <path d="M12 4v1" />
            <path d="M12 20v1" />
            {fakeDeafenEnabled && <path d="M3 3l18 18" />}
        </svg>
    );
}

function FakeDeafenButton() {
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);

    const handleClick = React.useCallback(() => {
        fakeDeafenEnabled = !fakeDeafenEnabled;
        const ChannelStore = findByProps("getChannel", "getDMFromUserId");
        const SelectedChannelStore = findByProps("getVoiceChannelId");
        const GatewayConnection = findByProps("voiceStateUpdate", "voiceServerPing");
        const MediaEngineStore = findByProps("isDeaf", "isMute");
        if (ChannelStore && SelectedChannelStore && GatewayConnection && typeof GatewayConnection.voiceStateUpdate === "function") {
            const channelId = SelectedChannelStore.getVoiceChannelId?.();
            const channel = channelId ? ChannelStore.getChannel?.(channelId) : null;
            if (channel) {
                if (fakeDeafenEnabled) {
                    GatewayConnection.voiceStateUpdate({
                        channelId: channel.id,
                        guildId: channel.guild_id,
                        selfMute: true,
                        selfDeaf: true
                    });
                } else {
                    const selfMute = MediaEngineStore?.isMute?.() ?? false;
                    const selfDeaf = MediaEngineStore?.isDeaf?.() ?? false;
                    GatewayConnection.voiceStateUpdate({
                        channelId: channel.id,
                        guildId: channel.guild_id,
                        selfMute,
                        selfDeaf
                    });
                }
            }
        }
        forceUpdate();
    }, []);

    return (
        <UserAreaButton
            tooltipText={fakeDeafenEnabled ? "Disable Fake Deafen" : "Enable Fake Deafen"}
            icon={<FakeDeafenIcon />}
            role="switch"
            aria-checked={fakeDeafenEnabled}
            redGlow={fakeDeafenEnabled}
            onClick={handleClick}
        />
    );
}

export default definePlugin({
    name: "FakeDeafen",
    description: "Adds a button to fake deafen yourself in voice channels. When enabled, you appear deafened and muted to others, but you can still hear and speak.",
    authors: [TestcordDevs.x2b],
    patches: [
        {
            find: "#{intl::ACCOUNT_SPEAKING_WHILE_MUTED}",
            replacement: {
                match: /className:\i\.buttons,.{0,50}children:\[/,
                replace: "$&$self.FakeDeafenButton(),"
            }
        }
    ],
    FakeDeafenButton,
    start() {
        const GatewayConnection = findByProps("voiceStateUpdate", "voiceServerPing");
        if (!GatewayConnection || typeof GatewayConnection.voiceStateUpdate !== "function") {
            console.warn("[FakeDeafen] GatewayConnection.voiceStateUpdate not found");
        } else {
            originalVoiceStateUpdate = GatewayConnection.voiceStateUpdate;
            GatewayConnection.voiceStateUpdate = function (args) {
                if (fakeDeafenEnabled && args && typeof args === "object") {
                    args.selfMute = true;
                    args.selfDeaf = true;
                }
                return originalVoiceStateUpdate.apply(this, arguments);
            };
        }
    },
    stop() {
        const GatewayConnection = findByProps("voiceStateUpdate", "voiceServerPing");
        if (GatewayConnection && originalVoiceStateUpdate) {
            GatewayConnection.voiceStateUpdate = originalVoiceStateUpdate;
        }
    }
});





