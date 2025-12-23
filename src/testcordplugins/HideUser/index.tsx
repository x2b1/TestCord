/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { TestcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Menu, React } from "@webpack/common";

const settings = definePluginSettings({
    hiddenUserIds: {
        type: OptionType.STRING,
        description: "Comma-separated list of user IDs to hide from server messages",
        default: "",
    },
});

function isUserHidden(userId: string): boolean {
    const hiddenIds = settings.store.hiddenUserIds.split(",").map(id => id.trim());
    return hiddenIds.includes(userId);
}

function toggleHideUser(userId: string) {
    const hiddenIds = settings.store.hiddenUserIds.split(",").map(id => id.trim()).filter(id => id);
    const index = hiddenIds.indexOf(userId);
    if (index > -1) {
        hiddenIds.splice(index, 1);
    } else {
        hiddenIds.push(userId);
    }
    settings.store.hiddenUserIds = hiddenIds.join(",");
}

const UserContextMenuPatch: NavContextMenuPatchCallback = (
    children,
    { user }: { user: any; }
) => {
    if (!user) return;

    const isHidden = isUserHidden(user.id);

    children.push(
        React.createElement(Menu.MenuSeparator, {}),
        React.createElement(Menu.MenuItem, {
            id: "hide-user",
            label: isHidden ? `👁️ Unhide ${user.username}` : `🙈 Hide ${user.username}`,
            action: () => toggleHideUser(user.id),
        })
    );
};

export default definePlugin({
    name: "HideUser",
    description: "Hide selected users from server messages by adding context menu options to hide/unhide users",
    authors: [TestcordDevs.x2b],
    settings,

    contextMenus: {
        "user-context": UserContextMenuPatch,
    },

    patches: [
        {
            find: "childrenMessageContent:null",
            replacement: {
                match: /(cozyMessage.{1,50},)childrenHeader:/,
                replace: "$1childrenAccessories:arguments[0].childrenAccessories || null,childrenHeader:"
            }
        },
        {
            find: "THREAD_STARTER_MESSAGE?null==",
            replacement: {
                match: /deleted:\i\.deleted, editHistory:\i\.editHistory,/,
                replace: "deleted:$self.getDeleted(...arguments), editHistory:$self.getEdited(...arguments),"
            }
        },
        {
            find: "_tryFetchMessagesCached",
            replacement: [
                {
                    match: /(?<=\.get\({url.+?then\()(\i)=>\(/,
                    replace: "async $1=>(await $self.processMessageFetch($1),"
                },
                {
                    match: /(?<=type:"LOAD_MESSAGES_SUCCESS",.{1,100})messages:(\i)/,
                    replace: "get messages() {return $self.filterHiddenMessages($1, this);}"
                }
            ]
        }
    ],

    processMessageFetch(response: any) {
        if (!response.ok || !response.body) return;

        // Filter out hidden messages
        response.body = response.body.filter((msg: any) => !isUserHidden(msg.author?.id));
    },

    filterHiddenMessages(messages: any[], payload: any) {
        return messages.filter((msg: any) => !isUserHidden(msg.author?.id));
    },

    getDeleted(m1: any, m2: any) {
        return m2?.deleted ?? m1?.deleted ?? false;
    },

    getEdited(m1: any, m2: any) {
        return m2?.editHistory ?? m1?.editHistory ?? [];
    },
});
