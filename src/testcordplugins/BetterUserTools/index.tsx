/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { definePluginSettings } from "@api/Settings";
import { getUserSettingLazy } from "@api/UserSettings";
import { EquicordDevs, TestcordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { MediaEngineStore, React, showToast, Toasts, UserStore, VoiceStateStore } from "@webpack/common";
import { UserAreaButton } from "@api/UserArea";

type LoopbackActions = {
    setLoopback(tag: string, enabled: boolean): unknown;
    toggleSelfDeaf(): unknown;
};

const VoiceActions = findByPropsLazy("setLoopback", "toggleSelfDeaf") as unknown as LoopbackActions | null;

const ShowCurrentGame = getUserSettingLazy<boolean>("status", "showCurrentGame")!;
const StatusSetting = getUserSettingLazy<string>("status", "status")!;

const settings = definePluginSettings({
    micLoopbackButton: {
        description: "Show Mic Test Loopback button",
        type: OptionType.BOOLEAN,
        default: true
    },
    offTheRadarButton: {
        description: "Show Off The Radar button",
        type: OptionType.BOOLEAN,
        default: true
    }
});

const log = new Logger("BetterUserTools");

let loopbackActive = false;
let selfDeafenedByPlugin = false;
let missingModuleNotified = false;

const OTR_DATA_KEY = "BetterUserTools_OffTheRadar_State";
interface OffTheRadarState {
    enabled: boolean;
    prevStatus?: string;
    prevShowCurrentGame?: boolean;
}
let otrState: OffTheRadarState = { enabled: false };

function notifyMic(msg: string, type: number) {
    showToast(msg, type);
}

function getVoiceActions(): LoopbackActions | null {
    try {
        const actions = VoiceActions as LoopbackActions | null;
        if (!actions?.setLoopback || !actions?.toggleSelfDeaf) {
            if (!missingModuleNotified) {
                missingModuleNotified = true;
                notifyMic("Mic test controls unavailable (missing VoiceActions module)", Toasts.Type.FAILURE);
            }
            return null;
        }
        return actions;
    } catch (err) {
        if (!missingModuleNotified) {
            missingModuleNotified = true;
            notifyMic("Mic test controls unavailable (see console)", Toasts.Type.FAILURE);
        }
        log.error("Failed to resolve VoiceActions module", err);
        return null;
    }
}

function isInVoiceChannel() {
    const id = UserStore.getCurrentUser()?.id;
    if (!id) return false;
    const state = VoiceStateStore.getVoiceStateForUser(id);
    return Boolean(state?.channelId);
}

async function enableLoopback() {
    const actions = getVoiceActions();
    if (!actions) return false;

    try {
        await actions.setLoopback("mic_test", true);
        loopbackActive = true;

        if (isInVoiceChannel() && !MediaEngineStore.isSelfDeaf()) {
            await actions.toggleSelfDeaf();
            selfDeafenedByPlugin = true;
        } else {
            selfDeafenedByPlugin = false;
        }

        notifyMic("Mic test loopback enabled", Toasts.Type.SUCCESS);
        return true;
    } catch (err) {
        log.error("Failed to enable mic test loopback", err);
        notifyMic("Failed to start mic test loopback (see console)", Toasts.Type.FAILURE);
        return false;
    }
}

async function disableLoopback(silent = false) {
    const actions = getVoiceActions();
    if (!actions) {
        loopbackActive = false;
        selfDeafenedByPlugin = false;
        return;
    }

    try {
        await actions.setLoopback("mic_test", false);
        loopbackActive = false;

        if (selfDeafenedByPlugin && MediaEngineStore.isSelfDeaf()) {
            await actions.toggleSelfDeaf();
        }
        selfDeafenedByPlugin = false;

        if (!silent) notifyMic("Mic test loopback disabled", Toasts.Type.SUCCESS);
    } catch (err) {
        log.error("Failed to disable mic test loopback", err);
        if (!silent) notifyMic("Failed to stop mic test loopback (see console)", Toasts.Type.FAILURE);
    }
}

function MicLoopbackIcon({ active }: { active: boolean; }) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect
                x="9"
                y="4"
                width="6"
                height="10"
                rx="3"
                stroke="currentColor"
                strokeWidth="1.6"
            />
            <path
                d="M7 10a5 5 0 0 0 10 0"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
            />
            <path
                d="M12 15v4m-3 1h6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
            />
            <path
                d="M6 7c-1.333 1.333-1.333 4.667 0 6m12-6c1.333 1.333 1.333 4.667 0 6"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeDasharray="2 2"
            />
            {active && (
                <path
                    d="M4 20 20 4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                />
            )}
        </svg>
    );
}

function MicLoopbackButton() {
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);

    const handleToggle = React.useCallback(async () => {
        if (loopbackActive) {
            await disableLoopback();
        } else {
            await enableLoopback();
        }
        forceUpdate();
    }, []);

    return (
        <UserAreaButton
            tooltipText="Mic Test Loopback"
            icon={<MicLoopbackIcon active={loopbackActive} />}
            role="switch"
            aria-checked={loopbackActive}
            onClick={handleToggle}
            className={`vc-betterusertools-btn${loopbackActive ? " danger" : ""}`}
        />
    );
}

function RadarIcon({ active }: { active: boolean; }) {
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
            <path d="M11.291 11.295a1 1 0 0 0 .709 1.705v8c2.488 0 4.74 -1.01 6.37 -2.642m1.675 -2.319a8.962 8.962 0 0 0 .955 -4.039h-5" />
            <path d="M16 9a5 5 0 0 0 -5.063 -1.88m-2.466 1.347a5 5 0 0 0 .53 7.535" />
            <path d="M20.486 9a9 9 0 0 0 -12.525 -5.032m-2.317 1.675a9 9 0 0 0 3.36 14.852" />
            {active && <path d="M3 3l18 18" />}
        </svg>
    );
}

async function loadOtrState() {
    otrState = await DataStore.get<OffTheRadarState>(OTR_DATA_KEY) || { enabled: false };
}

function persistOtrState() {
    return DataStore.set(OTR_DATA_KEY, otrState);
}

async function applyOtrEnable() {
    if (!ShowCurrentGame || !StatusSetting) return;
    const currentStatus = StatusSetting.getSetting?.();
    const currentShow = ShowCurrentGame.getSetting?.();

    if (otrState.prevStatus === undefined) otrState.prevStatus = currentStatus;
    if (otrState.prevShowCurrentGame === undefined) otrState.prevShowCurrentGame = currentShow;

    await Promise.all([
        ShowCurrentGame.updateSetting(false),
        StatusSetting.updateSetting("idle")
    ]);
    otrState.enabled = true;
    await persistOtrState();
}

async function applyOtrDisable() {
    if (!ShowCurrentGame || !StatusSetting) return;
    const tasks: Array<Promise<unknown>> = [];
    tasks.push(ShowCurrentGame.updateSetting(otrState.prevShowCurrentGame ?? true));
    if (otrState.prevStatus) tasks.push(StatusSetting.updateSetting(otrState.prevStatus));
    otrState.enabled = false;
    await Promise.all(tasks);
    await persistOtrState();
}

function OffTheRadarButton() {
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);

    const toggle = async () => {
        try {
            if (otrState.enabled) {
                await applyOtrDisable();
            } else {
                await applyOtrEnable();
            }
            forceUpdate();
        } catch (err) {
            log.error("OffTheRadar toggle failed", err);
            showToast("OffTheRadar toggle failed", Toasts.Type.FAILURE);
        }
    };

    return (
        <UserAreaButton
            tooltipText={otrState.enabled ? "Off The Radar (on)" : "Off The Radar (off)"}
            icon={<RadarIcon active={otrState.enabled} />}
            role="switch"
            aria-checked={otrState.enabled}
            onClick={toggle}
            className={`vc-betterusertools-btn${otrState.enabled ? " danger" : ""}`}
        />
    );
}

function renderMicLoopbackButton() {
    const { micLoopbackButton } = settings.store;
    return micLoopbackButton ? <MicLoopbackButton /> : null;
}

function renderOffTheRadarButton() {
    const { offTheRadarButton } = settings.store;
    return offTheRadarButton ? <OffTheRadarButton /> : null;
}

const styles = `
.vc-betterusertools-btn { color: var(--interactive-normal); }
`;

export default definePlugin({
    name: "BetterUserTools",
    description: "Adds mic test shortcut button and off-the-radar button to the user panel, both are toggles. MicTest Simply lets you test your mic without entering the settings page. OffTheRadar Enables idle status and hides activity while enabled. just added before equicord, if the original gets added to equicord I will delete this one.",
    authors: [EquicordDevs.Benjii, TestcordDevs.x2b],
    dependencies: ["UserSettingsAPI"],
    settings,
    styles,

    async start() {
        await loadOtrState();
        if (otrState.enabled) await applyOtrEnable();

        Vencord.Api.UserArea.addUserAreaButton("better-user-tools-mic-loopback", renderMicLoopbackButton);
        Vencord.Api.UserArea.addUserAreaButton("better-user-tools-off-the-radar", renderOffTheRadarButton);
    },

    stop() {
        void disableLoopback(true);
        loopbackActive = false;
        selfDeafenedByPlugin = false;
        missingModuleNotified = false;

        if (otrState.enabled) void applyOtrDisable();

        Vencord.Api.UserArea.removeUserAreaButton("better-user-tools-mic-loopback");
        Vencord.Api.UserArea.removeUserAreaButton("better-user-tools-off-the-radar");
    },
});
