import { disableStyle, enableStyle } from "@api/Styles";
import ErrorBoundary from "@components/ErrorBoundary";
import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";

import { settings } from "./settings";
import style from "./style.css?managed";

const Button = findByPropsLazy("Sizes", "Colors", "Looks").Button;
const UserPanelSection = findByPropsLazy("default").default;

function makeIcon(enabled?: boolean) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="currentColor" d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3zm7.91 6a1 1 0 0 1 .993.883l.007.117v2a7 7 0 0 1-5.468 6.834l-.232.042a4 4 0 0 1-7.45-1.328L7 17v-5h-.996a1 1 0 0 1-.993-.883L5 11V9a1 1 0 0 1 .883-.993L6 8h13.91z"/>
            {!enabled && <path fill="var(--red-400)" d="M4.5 2.5L21 19"/>}
        </svg>
    );
}

function FakeVoiceButton() {
    const { fakeMute, fakeDeafen } = settings.use(["fakeMute", "fakeDeafen"]);
    const enabled = fakeDeafen && fakeMute;

    return (
        <Button
            size="sm"
            color={enabled ? "green" : "red"}
            look="filled"
            onClick={() => {
                settings.store.fakeDeafen = !fakeDeafen;
                settings.store.fakeMute = !fakeMute;
            }}
            icon={makeIcon(enabled)}
        >
            {enabled ? "Faking VC" : "Fake VC"}
        </Button>
    );
}

export default definePlugin({
    name: "Fake Voice Options",
    description: "Appear muted/deafened while still being able to speak/hear",
    authors: [{
        name: "Wikinger8",
        id: 387168065273593878n,
    }, TestcordDevs.x2b],
    patches: [
        {
            find: ".userPanelVoiceSection,",
            replacement: {
                match: /(userPanelVoiceSection.+?children:)\[(\i)/,
                replace: "$1[$self.FakeVoiceButton(),$2"
            }
        },
        {
            find: ".Messages.VOICE_CONNECTED_DEVICE_LABEL",
            replacement: [
                {
                    match: /(\i)\.setSelfMute\((\i)\)/,
                    replace: "$1.setSelfMute(Vencord.Settings.plugins['Fake Voice Options'].fakeMute?false:$2)"
                },
                {
                    match: /(\i)\.setSelfDeaf\((\i)\)/,
                    replace: "$1.setSelfDeaf(Vencord.Settings.plugins['Fake Voice Options'].fakeDeafen?false:$2)"
                }
            ]
        }
    ],
    FakeVoiceButton: ErrorBoundary.wrap(FakeVoiceButton),
    settings,

    start() {
        enableStyle(style);
    },

    stop() {
        disableStyle(style);
    }
});

