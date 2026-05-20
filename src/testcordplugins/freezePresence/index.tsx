/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { TestcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { FluxDispatcher, UserStore } from "@webpack/common";

const PresenceStore = findByPropsLazy("getStatus", "isMobileOnline", "getActivities");

const settings = definePluginSettings({
    freezeList: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Freeze the member list — stop it from jumping around when people change status.",
        onChange(val: boolean) {
            if (val) startFreeze();
            else stopFreeze();
        }
    },
    fakeAllOnline: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Make everyone appear as Online (green) in the member list.",
        onChange(val: boolean) {
            if (val) applyFakeOnline();
            else removeFakeOnline();
        }
    }
});

// ─── Fake online logic ────────────────────────────────────────────────────────

let _fakeOnlineActive = false;

function fakeOnlineInterceptor(payload: any) {
    if (payload.type === "PRESENCE_UPDATES" || payload.type === "PRESENCES_REPLACE" || payload.type === "PASSIVE_UPDATE_V1") {
        return false;
    }
}

function applyFakeOnline() {
    if (_fakeOnlineActive) return;
    FluxDispatcher.addInterceptor(fakeOnlineInterceptor);
    _fakeOnlineActive = true;
    try {
        const state = PresenceStore.getState?.();
        const myId = UserStore.getCurrentUser()?.id;
        const presences: any[] = [];
        const statuses = state?.statuses ?? {};
        for (const userId of Object.keys(statuses)) {
            if (userId === myId) continue;
            presences.push({ user: { id: userId }, status: "online", clientStatus: { desktop: "online" }, activities: [] });
        }
        if (presences.length > 0) {
            FluxDispatcher.removeInterceptor(fakeOnlineInterceptor);
            FluxDispatcher.dispatch({ type: "PRESENCES_REPLACE", presences });
            FluxDispatcher.addInterceptor(fakeOnlineInterceptor);
        }
    } catch { /* ignore */ }
}

function removeFakeOnline() {
    if (!_fakeOnlineActive) return;
    FluxDispatcher.removeInterceptor(fakeOnlineInterceptor);
    _fakeOnlineActive = false;
    FluxDispatcher.dispatch({ type: "PRESENCE_UPDATES", updates: [] });
}

// ─── Freeze logic — patch shouldComponentUpdate on the member list component ──

let _freezeActive = false;

function startFreeze() {
    _freezeActive = true;
}

function stopFreeze() {
    _freezeActive = false;
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default definePlugin({
    name: "FreezePresence",
    description: "Stops the member list from jumping around when people change status, and optionally makes everyone appear online.",
    tags: ["Utility", "MemberList"],
    authors: [TestcordDevs.nnenaza],
    settings,

    patches: [
        {
            // Patch shouldComponentUpdate on the member list component
            // Original: shouldComponentUpdate(e){return e.channel.id!==this.props.channel.id||e.version!==this.props.version||e.groups.length!==this.props.groups.length}
            find: "e.channel.id!==this.props.channel.id||e.version!==this.props.version",
            replacement: {
                match: /shouldComponentUpdate\((\i)\)\{return \i\.channel\.id!==this\.props\.channel\.id\|\|\i\.version!==this\.props\.version\|\|\i\.groups\.length!==this\.props\.groups\.length\}/,
                replace: "shouldComponentUpdate($1){if($self.isFrozen())return $1.channel.id!==this.props.channel.id||$1.rows!==this.props.rows;return $1.channel.id!==this.props.channel.id||$1.version!==this.props.version||$1.groups.length!==this.props.groups.length}"
            }
        }
    ],

    isFrozen(): boolean {
        return _freezeActive;
    },

    start() {
        if (settings.store.freezeList) startFreeze();
        if (settings.store.fakeAllOnline) applyFakeOnline();
    },

    stop() {
        stopFreeze();
        removeFakeOnline();
    }
});
