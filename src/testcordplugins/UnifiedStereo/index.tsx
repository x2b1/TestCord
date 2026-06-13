/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { TestcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";

const settings = definePluginSettings({
    enableStereo: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Master toggle"
    },
    stereoChannel: {
        description: "Static codec channel (basic patch)",
        type: OptionType.SELECT,
        options: [
            { label: "Mono", value: 1 },
            { label: "Stereo", value: 2, default: true },
            { label: "Surround", value: 7.1 }
        ]
    },
    stereoChannels: {
        description: "Runtime channels slider",
        type: OptionType.SLIDER,
        markers: [1.0, 2.0, 4.0, 7.1],
        default: 2.0,
        stickToMarkers: true
    },
    bitrateKbps: {
        description: "Bitrate kbps",
        type: OptionType.SLIDER,
        markers: [32, 128, 256, 384, 512],
        default: 512,
        stickToMarkers: true
    },
    disableFEC: {
        type: OptionType.BOOLEAN,
        description: "Disable forward error correction",
        default: true
    },
    enablePriorityDucking: {
        type: OptionType.BOOLEAN,
        description: "Enable priority ducking",
        default: false
    },
    enableToasts: {
        type: OptionType.BOOLEAN,
        description: "Show toast notifications",
        default: true
    },
    enableScreenshareFix: {
        type: OptionType.BOOLEAN,
        description: "Enable screenshare stereo fix",
        default: true
    }
});

const VoiceSettingsStore = findByPropsLazy("getEchoCancellation");
const VoiceModule = findByPropsLazy("updateVideoQuality");

const origRTCPeerConnection: any = {};

const mungeSDP = (sdp: string) => {
    if (!sdp) return sdp;
    const opusPts = new Set();
    sdp.split(/\r\n/).forEach(line => {
        const m = line.match(/^a=rtpmap:(\d+)\s+opus\/48000/i);
        if (m) opusPts.add(m[1]);
    });
    if (!opusPts.size) return sdp;
    return sdp.replace(/^a=fmtp:(\d+)\s+(.+)$/gmi, (full, pt, params) => {
        if (!opusPts.has(pt)) return full;
        if (params.match(/(\bstereo=1\b)|(\bsprop-stereo=1\b)/i)) return full;
        const sep = params.endsWith(";") ? "" : ";";
        return `a=fmtp:${pt} ${params}${sep}stereo=1;sprop-stereo=1`;
    });
};

const patchDesc = (desc: any) => ({
    type: desc.type,
    sdp: mungeSDP(desc.sdp)
});

export default definePlugin({
    name: "StereoPremium",
    description: "All-in-one stereo: output, bitrate, screenshare.",
    tags: ["Voice", "Utility"],
    authors: [TestcordDevs.x2b],
    settings,

    _patchedConns: new Set<any>(),

    patches: [
        // Basic static codec patches
        {
            find: '"Audio codecs"',
            replacement: {
                match: /channels:1,/,
                replace: 'channels:1,prams:{stereo:"1"},',
                predicate: () => settings.store.enableStereo && settings.store.stereoChannel === 1
            }
        },
        {
            find: '"Audio codecs"',
            replacement: {
                match: /channels:1,/,
                replace: 'channels:2,prams:{stereo:"2"},',
                predicate: () => settings.store.enableStereo && settings.store.stereoChannel === 2
            }
        },
        {
            find: '"Audio codecs"',
            replacement: {
                match: /channels:1,/,
                replace: 'channels:7.1,prams:{stereo:"7.1"},',
                predicate: () => settings.store.enableStereo && settings.store.stereoChannel === 7.1
            }
        },
        // Runtime hook injection
        {
            find: "updateVideoQuality",
            replacement: {
                match: /updateVideoQuality\([^)]*\)\s*{/,
                replace: "$self.patchVoiceTransport(this);$&"
            }
        }
    ],

    patchVoiceTransport(thisObj: any) {
        if (!settings.store.enableStereo) return;

        const { conn } = thisObj;
        if (!conn?.setTransportOptions || conn._unifiedStereoOrig) return;

        const original = conn.setTransportOptions;
        conn._unifiedStereoOrig = original;
        this._patchedConns.add(conn);
        conn.setTransportOptions = function (obj: any) {
            const channels = settings.store.stereoChannels;
            if (obj.audioEncoder) {
                obj.audioEncoder.channels = channels;
                obj.audioEncoder.params = { stereo: channels.toString() };
                console.log(`[UnifiedStereo] channels=${channels}`);
            }
            if (settings.store.disableFEC && obj.fec !== undefined) {
                obj.fec = false;
                console.log("[UnifiedStereo] FEC disabled");
            }
            const targetBitrate = settings.store.bitrateKbps * 1000;
            if (obj.encodingVoiceBitRate < targetBitrate) {
                console.log(`[UnifiedStereo] bitrate -> ${targetBitrate}`);
                obj.encodingVoiceBitrate = targetBitrate;
            }
            if (obj.prioritySpeaker) {
                obj.prioritySpeaker = true;
                if (settings.store.enablePriorityDucking) {
                    obj.prioritySpeakerDucking = 1e10;
                    console.log("[UnifiedStereo] priority ducking max");
                }
            }

            const result = original.call(this, obj);
            if (settings.store.enableToasts) {
                showNotification({
                    title: "UnifiedStereo Active",
                    body: `${channels}ch @${settings.store.bitrateKbps}kbps`,
                    color: "var(--green-360)"
                });
            }
            return result;
        };
    },

    checkSettings() {
        if (!VoiceSettingsStore) return false;
        const issues = VoiceSettingsStore.getNoiseSuppression?.() || VoiceSettingsStore.getEchoCancellation?.() || VoiceSettingsStore.getNoiseCancellation?.();
        if (issues && settings.store.enableToasts) {
            showNotification({
                title: "UnifiedStereo Warning",
                body: "Disable noise supp/echo/krisp!",
                color: "var(--yellow-360)"
            });
        }
        return !!issues;
    },

    start() {
        console.log("[UnifiedStereo] Loaded all features");
        this.checkSettings();

        if (settings.store.enableScreenshareFix) {
            const SRD = RTCPeerConnection.prototype.setRemoteDescription as any;
            const SLD = RTCPeerConnection.prototype.setLocalDescription as any;

            if (!SRD._unifiedStereoPatched) {
                origRTCPeerConnection.SRD = SRD;
                const wrappedSRD = function (this: RTCPeerConnection, desc: any, ...args: any[]) {
                    return SRD.call(this, patchDesc(desc), ...args);
                };
                (wrappedSRD as any)._unifiedStereoPatched = true;
                RTCPeerConnection.prototype.setRemoteDescription = wrappedSRD as any;
            }

            if (!SLD._unifiedStereoPatched) {
                origRTCPeerConnection.SLD = SLD;
                const wrappedSLD = function (this: RTCPeerConnection, desc: any, ...args: any[]) {
                    return SLD.call(this, patchDesc(desc), ...args);
                };
                (wrappedSLD as any)._unifiedStereoPatched = true;
                RTCPeerConnection.prototype.setLocalDescription = wrappedSLD as any;
            }
        }
    },

    stop() {
        const srd = RTCPeerConnection.prototype.setRemoteDescription as any;
        if (srd?._unifiedStereoPatched && origRTCPeerConnection.SRD) {
            RTCPeerConnection.prototype.setRemoteDescription = origRTCPeerConnection.SRD;
        }
        const sld = RTCPeerConnection.prototype.setLocalDescription as any;
        if (sld?._unifiedStereoPatched && origRTCPeerConnection.SLD) {
            RTCPeerConnection.prototype.setLocalDescription = origRTCPeerConnection.SLD;
        }
        origRTCPeerConnection.SRD = undefined;
        origRTCPeerConnection.SLD = undefined;

        for (const conn of this._patchedConns) {
            try {
                if (conn._unifiedStereoOrig) {
                    conn.setTransportOptions = conn._unifiedStereoOrig;
                    delete conn._unifiedStereoOrig;
                }
            } catch { }
        }
        this._patchedConns.clear();
        console.log("[UnifiedStereo] Unloaded");
    }
});
