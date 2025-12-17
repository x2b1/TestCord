import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
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
});
