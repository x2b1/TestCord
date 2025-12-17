/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs, TestcordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "ScreenshareKeybind",
    description: "Adds a keybind to instantly screenshare",
    authors: [TestcordDevs.x2b],
    patches: [
        {
            find: "DISCONNECT_FROM_VOICE_CHANNEL]",
            replacement: {
                match: /\[\i\.\i\.DISCONNECT_FROM_VOICE_CHANNEL/,
                replace: "SHARE_ENTIRE_SCREEN:{onTrigger:$self.trigger,keyEvents:{keyUp:!1,keyDown:!0}},$&"
            },
        },
        {
            find: "keybindActionTypes()",
            replacement: {
                match: /=\[(\{value:\i\.\i\.UNASSIGNED)/,
                replace: "=[{value:'SHARE_ENTIRE_SCREEN',label:'Share Entire Screen'},$1"
            }
        }
    ],
    async trigger() {
        var selected = Vencord.Webpack.Common.SelectedChannelStore.getVoiceChannelId();
        if (!selected) return;
        var channel = Vencord.Webpack.Common.ChannelStore.getChannel(selected);
        var source = await Vencord.Webpack.findByCode("desktop sources")(Vencord.Webpack.findByProps("getMediaEngine").getMediaEngine(), ["screen"], null);
        Vencord.Webpack.findByCode('dispatch({type:"STREAM_START"')(channel.guild_id, selected, {
            "pid": null,
            "sourceId": source.id,
            "sourceName": source.name,
            "audioSourceId": null,
            "sound": true,
            "previewDisabled": false
        });
    }
});





