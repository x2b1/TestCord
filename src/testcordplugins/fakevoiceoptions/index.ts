import definePlugin, { OptionType } from "@utils/types";

export default definePlugin({
    name: "Fake Voice Options",
    description: "Spoof your mute and/or deafen status",
    authors: [{
        name: "SaucyDuck",
        id: 1004904120056029256n
    }],
    patches: [
        {
            find: "e.setSelfMute(n)",
            replacement: [{
                // prevent client-side mute
                match: /e\.setSelfMute\(n\),/g,
                replace: 'e.setSelfMute(Vencord.Settings.plugins["Fake Voice Options"].fakeMute?false:n),'
            },
            {
                // prevent client-side deafen
                match: /e\.setSelfDeaf\(t\.deaf\)/g,
                replace: 'e.setSelfDeaf(Vencord.Settings.plugins["Fake Voice Options"].fakeDeafen?false:t.deaf)'
            }]
        },
    ],
    options: {
        fakeMute: {
            description: "Make everyone believe you're muted (you can still speak)",
            type: OptionType.BOOLEAN,
            default: false,
        },
        fakeDeafen: {
            description: "Make everyone believe you're deafened (you can still hear)",
            type: OptionType.BOOLEAN,
            default: false,
        },
    },
});
