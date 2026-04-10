import definePlugin, { OptionType } from "@utils/types";
import { Toasts, FluxDispatcher, PermissionsBits, UserStore, GuildStore, GuildMemberStore, RestAPI } from "@webpack/common";
import { definePluginSettings } from "@api/Settings";
import { Guild, GuildMember, Role } from "discord-types/general";
import { findByPropsLazy, findStoreLazy, findByCodeLazy, findLazy } from "@webpack";

const VoiceStateStore = findStoreLazy("VoiceStateStore");

const alarm = "https://www.myinstants.com/media/sounds/tmp_7901-951678082.mp3";


export default definePlugin({
    name: "antiMod",
    description: "Tools to avoid mods",
    authors: [{ name: "dot", id: 1400610916285812776n }],
    start() { FluxDispatcher.subscribe("VOICE_STATE_UPDATES", cb); }

});

const avoidPermission: bigint[] = [
    (BigInt(1) << 3n),
    (BigInt(1) << 2n),
    (BigInt(1) << 1n),
    (BigInt(1) << 24n),
    (BigInt(1) << 22n),
    (BigInt(1) << 23n),
    (BigInt(1) << 7n),
    (BigInt(1) << 5n),
    (BigInt(1) << 28n),
    (BigInt(1) << 40n),
    (BigInt(1) << 4n),
];

const cb = async (e: any) => {
    const state = e.voiceStates[0];
    if (!state?.channelId) return;
    if (state.userId == UserStore.getCurrentUser().id || !state.userId) return;
    if (state?.channelId == state?.oldChannelId) return;

    const channelVoiceStates = VoiceStateStore.getVoiceStatesForChannel(state?.channelId) ?? {};
    if (!Object.keys(channelVoiceStates).includes(UserStore.getCurrentUser().id)) return;
    const member = GuildMemberStore.getMember(state.guildId, state.userId!);

    const roles = getSortedRoles(GuildStore.getGuild(state.guildId), member)
        .map(role => ({
            type: 0,
            ...role
        }));
    for (let role of roles) {
        for (let permission of avoidPermission) {
            if ((role.permissions & permission) === permission) {
                Toasts.show({
                    message: `MOD ALERT  ${state.userId} detected`,
                    id: "Vc-permissions",
                    type: Toasts.Type.FAILURE,
                    options: {
                        position: Toasts.Position.BOTTOM,
                    }
                });
                audio();

                break;
            }
        }
    }

};

function getSortedRoles({ id }: Guild, member: GuildMember) {
    const roles = GuildStore.getRoles(id);

    return [...member.roles, id]
        .map(id => roles[id])
        .sort((a, b) => b.position - a.position);
}

function audio() {
    const audioElement = document.createElement("audio");
    audioElement.src = alarm;
    audioElement.volume = 1;
    audioElement.play();
}


