/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { UserAreaButton } from "@api/UserArea";
import { TestcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findByProps, findByPropsLazy } from "@webpack";
import { Menu, React } from "@webpack/common";

const MediaEngineActions = findByPropsLazy("toggleSelfMute");
const NotificationSettingsStore = findByPropsLazy("getDisableAllSounds", "getState");

let originalVoiceStateUpdate: any;

export const settings = definePluginSettings({
    userAreaButton: {
        type: OptionType.BOOLEAN,
        description: "Show button in user area (voice controls)",
        default: true
    },
    contextMenu: {
        type: OptionType.BOOLEAN,
        description: "Show options in audio device context menu",
        default: true
    },
    autoMute: {
        type: OptionType.BOOLEAN,
        description: "Automatically mute when deafened.",
        default: true
    }
});

let updating = false;
async function updateSound() {
    if (updating) return setTimeout(updateSound, 125);
    updating = true;
    const state = NotificationSettingsStore.getState();
    const toDisable: string[] = [];
    if (!state.disabledSounds.includes("mute")) toDisable.push("mute");
    if (!state.disabledSounds.includes("unmute")) toDisable.push("unmute");

    state.disabledSounds.push(...toDisable);
    await new Promise(r => setTimeout(r, 50));
    await MediaEngineActions.toggleSelfMute();
    await new Promise(r => setTimeout(r, 100));
    await MediaEngineActions.toggleSelfMute();
    state.disabledSounds = state.disabledSounds.filter((i: string) => !toDisable.includes(i));
    updating = false;
}

const fakeVoiceState = {
    _selfMute: false,
    get selfMute() {
        try {
            if (!settings.store.autoMute) return this._selfMute;
            return this.selfDeaf || this._selfMute;
        } catch (e) {
            return this._selfMute;
        }
    },
    set selfMute(value) {
        this._selfMute = value;
    },
    selfDeaf: false,
    selfVideo: false
};

const StateKeys = ["selfDeaf", "selfMute", "selfVideo"];

function modifyVoiceState(e: any) {
    for (let i = 0; i < StateKeys.length; i++) {
        const stateKey = StateKeys[i];
        e[stateKey] = fakeVoiceState[stateKey as keyof typeof fakeVoiceState] || e[stateKey];
    }
    return e;
}

function FakeDeafenIcon() {
    const enabled = fakeVoiceState.selfDeaf;
    return (
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <rect
                x="6"
                y="8"
                width="20"
                height="4"
                rx="2"
                fill={enabled ? "#fff" : "#888"}
            />
            <rect
                x="11"
                y="3"
                width="10"
                height="8"
                rx="3"
                fill={enabled ? "#fff" : "#888"}
            />
            <circle
                cx="10"
                cy="21"
                r="4"
                stroke={enabled ? "#fff" : "#888"}
                strokeWidth="2"
                fill="none"
            />
            <circle
                cx="22"
                cy="21"
                r="4"
                stroke={enabled ? "#fff" : "#888"}
                strokeWidth="2"
                fill="none"
            />
            <path
                d="M14 21c1 1 3 1 4 0"
                stroke={enabled ? "#fff" : "#888"}
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    );
}

function FakeMuteDeafenButton() {
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);

    const handleClick = React.useCallback(() => {
        fakeVoiceState.selfDeaf = !fakeVoiceState.selfDeaf;
        fakeVoiceState.selfMute = fakeVoiceState.selfDeaf;

        const ChannelStore = findByPropsLazy("getChannel", "getDMFromUserId");
        const SelectedChannelStore = findByPropsLazy("getVoiceChannelId");
        const GatewayConnection = findByPropsLazy(
            "voiceStateUpdate",
            "voiceServerPing"
        );
        const MediaEngineStore = findByPropsLazy("isDeaf", "isMute");

        if (
            ChannelStore &&
            SelectedChannelStore &&
            GatewayConnection &&
            typeof GatewayConnection.voiceStateUpdate === "function"
        ) {
            const channelId = SelectedChannelStore.getVoiceChannelId?.();
            const channel = channelId
                ? ChannelStore.getChannel?.(channelId)
                : null;

            if (channel) {
                if (fakeVoiceState.selfDeaf) {
                    GatewayConnection.voiceStateUpdate({
                        channelId: channel.id,
                        guildId: channel.guild_id,
                        selfMute: true,
                        selfDeaf: true,
                    });
                } else {
                    const selfMute = MediaEngineStore?.isMute?.() ?? false;
                    const selfDeaf = MediaEngineStore?.isDeaf?.() ?? false;
                    GatewayConnection.voiceStateUpdate({
                        channelId: channel.id,
                        guildId: channel.guild_id,
                        selfMute,
                        selfDeaf,
                    });
                }
            }
        }
        forceUpdate();
    }, []);

    const isEnabled = fakeVoiceState.selfDeaf;

    return (
        <UserAreaButton
            tooltipText={
                isEnabled ? "Disable Fake Mute & Deafen" : "Enable Fake Mute & Deafen"
            }
            icon={<FakeDeafenIcon />}
            role="switch"
            aria-checked={isEnabled}
            redGlow={isEnabled}
            onClick={handleClick}
        />
    );
}

export default definePlugin({
    name: "FakeMuteDeafen",
    description: "Fake mute and deafen yourself. You can continue speaking and being heard during this time. Toggle via user area button or context menu.",
    tags: ["Voice", "Privacy"],
    authors: [TestcordDevs.x2b],
    settings,
    start() {
        // The voiceStateUpdate module doesn't exist in current Discord version
        // But we can still show the button for visual indication that the feature exists
        if (settings.store.userAreaButton) {
            try {
                Vencord.Api.UserArea.addUserAreaButton("fake-mute-deafen", () => <FakeMuteDeafenButton />);
            } catch (e) {
                console.warn("[FakeMuteDeafen] Failed to add user area button:", e);
            }
        }
        console.warn("[FakeMuteDeafen] voiceStateUpdate module not found - faking disabled");
    },
    stop() {
        try {
            Vencord.Api.UserArea.removeUserAreaButton("fake-mute-deafen");
        } catch (e) {
            // Ignore
        }
    },
    contextMenus: {
        "audio-device-context"(children, d) {
            if (!settings.store.contextMenu) return;

            if (d.renderInputDevices) {
                children.push(
                    <Menu.MenuSeparator />,
                    <Menu.MenuCheckboxItem
                        id="fake-mute"
                        label="Fake Mute"
                        checked={fakeVoiceState.selfMute}
                        action={() => {
                            fakeVoiceState.selfMute = !fakeVoiceState.selfMute;
                            updateSound();
                        }}
                    />
                );
            }

            if (d.renderOutputDevices) {
                children.push(
                    <Menu.MenuSeparator />,
                    <Menu.MenuCheckboxItem
                        id="fake-deafen"
                        label="Fake Deafen"
                        checked={fakeVoiceState.selfDeaf}
                        action={() => {
                            fakeVoiceState.selfDeaf = !fakeVoiceState.selfDeaf;
                            if (settings.store.autoMute && fakeVoiceState.selfDeaf) {
                                fakeVoiceState.selfMute = true;
                            }
                            updateSound();
                        }}
                    />
                );
            }
        },
        "video-device-context"(children) {
            if (!settings.store.contextMenu) return;

            children.push(
                <Menu.MenuSeparator />,
                <Menu.MenuCheckboxItem
                    id="fake-video"
                    label="Fake Camera"
                    checked={fakeVoiceState.selfVideo}
                    action={() => {
                        fakeVoiceState.selfVideo = !fakeVoiceState.selfVideo;
                        updateSound();
                    }}
                />
            );
        }
    }
});
