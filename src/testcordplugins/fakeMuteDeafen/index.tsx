/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { UserAreaButton } from "@api/UserArea";
import { TestcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { Menu, React, SelectedChannelStore, Toasts } from "@webpack/common";

const { toggleSelfMute, toggleSelfDeaf } = findByPropsLazy("toggleSelfMute");

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

const states = {
    mute: false,
    deafen: false
};

let updaterequired = false;
let lastVoiceChannelId: string | undefined = undefined;

function toggleFakeMute() {
    states.mute = !states.mute;
    updaterequired = true;
    toggleSelfMute();
    toggleSelfMute();
    updaterequired = false;
    
    Toasts.show({
        message: `🎤 Fake mute is now: ${states.mute ? "enabled" : "disabled"}`,
        id: "fake-mute",
        type: states.mute ? Toasts.Type.SUCCESS : Toasts.Type.FAILURE,
        options: { position: Toasts.Position.BOTTOM }
    });
}

function toggleFakeDeafen() {
    states.deafen = !states.deafen;
    if (states.deafen) states.mute = true;
    
    updaterequired = true;
    toggleSelfDeaf();
    toggleSelfDeaf();
    if (states.deafen) {
        toggleSelfMute();
        toggleSelfMute();
    }
    updaterequired = false;
    
    const msg = states.deafen 
        ? "Fake deafen enabled (+ fake mute)" 
        : "Fake deafen disabled";
    Toasts.show({
        message: `🔇 ${msg}`,
        id: "fake-deafen",
        type: states.deafen ? Toasts.Type.SUCCESS : Toasts.Type.FAILURE,
        options: { position: Toasts.Position.BOTTOM }
    });
}

function FakeDeafenIcon() {
    const enabled = states.deafen;
    return (
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <rect x="6" y="8" width="20" height="4" rx="2" fill={enabled ? "#fff" : "#888"} />
            <rect x="11" y="3" width="10" height="8" rx="3" fill={enabled ? "#fff" : "#888"} />
            <circle cx="10" cy="21" r="4" stroke={enabled ? "#fff" : "#888"} strokeWidth="2" fill="none" />
            <circle cx="22" cy="21" r="4" stroke={enabled ? "#fff" : "#888"} strokeWidth="2" fill="none" />
            <path d="M14 21c1 1 3 1 4 0" stroke={enabled ? "#fff" : "#888"} strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

function FakeMuteDeafenButton() {
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);

    const handleClick = React.useCallback(() => {
        if (!states.deafen) {
            toggleFakeDeafen();
        } else {
            if (states.mute) {
                toggleFakeMute();
            }
            states.deafen = false;
            toggleFakeDeafen();
        }
        forceUpdate();
    }, []);

    return (
        <UserAreaButton
            tooltipText={states.deafen ? "Disable Fake Mute & Deafen" : "Enable Fake Mute & Deafen"}
            icon={<FakeDeafenIcon />}
            role="switch"
            aria-checked={states.deafen}
            redGlow={states.deafen}
            onClick={handleClick}
        />
    );
}

export default definePlugin({
    name: "FakeMuteDeafen",
    description: "Fake mute and deafen yourself. You can continue speaking and being heard during this time. Toggle via user area button or context menu.",
    authors: [TestcordDevs.x2b],
    settings,
    
    state(type: string, real: boolean) {
        if (type === "mute" && !states.mute) return true;
        else if (type === "deafen" && !states.deafen) return true;
        return real;
    },
    
    patches: [
        {
            find: "}voiceStateUpdate(",
            replacement: {
                match: /self_mute:([^,]+),self_deaf:([^,]+)/,
                replace: "self_mute:$self.state('mute',$1),self_deaf:$self.state('deafen',$2)"
            }
        }
    ],

    start() {
        lastVoiceChannelId = SelectedChannelStore.getVoiceChannelId();
        
        if (settings.store.userAreaButton) {
            Vencord.Api.UserArea.addUserAreaButton("fake-mute-deafen", () => <FakeMuteDeafenButton />);
        }
        
        SelectedChannelStore.addChangeListener(this.handleVoiceChannelChange.bind(this));
        
        Toasts.show({
            message: "🎤 FakeMuteDeafen loaded!",
            id: "fake-mute-deafen-loaded",
            type: Toasts.Type.SUCCESS,
            options: { position: Toasts.Position.BOTTOM, duration: 3000 }
        });
    },
    
    stop() {
        SelectedChannelStore.removeChangeListener(this.handleVoiceChannelChange.bind(this));
        lastVoiceChannelId = undefined;
        Vencord.Api.UserArea.removeUserAreaButton("fake-mute-deafen");
    },
    
    handleVoiceChannelChange() {
        const currentChannelId = SelectedChannelStore.getVoiceChannelId();
        const previousChannelId = lastVoiceChannelId;
        
        lastVoiceChannelId = currentChannelId ?? undefined;
        
        if (!previousChannelId && currentChannelId) {
            setTimeout(() => {
                if (!states.mute || !states.deafen) {
                    updaterequired = true;
                    if (!states.deafen) {
                        toggleSelfDeaf();
                        toggleSelfDeaf();
                    }
                    if (!states.mute) {
                        toggleSelfMute();
                        toggleSelfMute();
                    }
                    updaterequired = false;
                }
            }, 500);
        } else if (previousChannelId && currentChannelId && previousChannelId !== currentChannelId) {
            setTimeout(() => {
                if (!states.mute || !states.deafen) {
                    updaterequired = true;
                    if (!states.deafen) {
                        toggleSelfDeaf();
                        toggleSelfDeaf();
                    }
                    if (!states.mute) {
                        toggleSelfMute();
                        toggleSelfMute();
                    }
                    updaterequired = false;
                }
            }, 300);
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
                        checked={states.mute}
                        action={toggleFakeMute}
                    />
                );
            }

            if (d.renderOutputDevices) {
                children.push(
                    <Menu.MenuSeparator />,
                    <Menu.MenuCheckboxItem
                        id="fake-deafen"
                        label="Fake Deafen"
                        checked={states.deafen}
                        action={toggleFakeDeafen}
                    />
                );
            }
        },
        "video-device-context"(children) {
            // Video fake disabled - not needed
        }
    }
});