/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { addContextMenuPatch, findGroupChildrenByChildId, NavContextMenuPatchCallback, removeContextMenuPatch } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { Devs, EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import type { User } from "@vencord/discord-types";
import { findByPropsLazy } from "@webpack";
import { Menu } from "@webpack/common";
import { Util } from "Vencord";

const { search } = findByPropsLazy("search", "searchByMode");

export interface UserContextProps {
    guildId?: string;
    user: User;
}
// m.default[O.SearchTokenTypes.FILTER_IN].key
function searchButtonHandler(user: User, searchContextId: string, modifier: boolean, isDM: boolean) {
    const searchCurrent = (settings.store.searchCurrentChannel ? !modifier : modifier) && !isDM;
    const query: { author_id: [string], channel_id?: [string]; } = { author_id: [user.id] };
    let queryString = `from: ${Util.getUniqueUsername(user)} `;
    const channel = Util.getCurrentChannel();
    if (searchCurrent && channel) {
        query.channel_id = [channel.id];
        queryString += `in:#${channel.name} `;
    }
    search(searchContextId, query, queryString, false);
}

const UserContextMenuPatch: NavContextMenuPatchCallback = (children, { user, guildId }: UserContextProps) => () => {
    if (!user || !guildId) return;

    const group = findGroupChildrenByChildId("user-profile", children);

    group?.push(
        <Menu.MenuItem
            id="vc-user-context-search-messages"
            label="Search Messages"
            action={t => (searchButtonHandler(user, guildId, (t.ctrlKey || t.metaKey), false))}
        />
    );
};


const settings = definePluginSettings({
    searchCurrentChannel: {
        type: OptionType.BOOLEAN,
        description: "Search query will search the current channel by default, hold Ctrl/Cmd to search the whole guild",
        default: false
    }
});

export default definePlugin({
    name: "SearchUserMessages",
    authors: [Devs.Sqaaakoi, EquicordDevs.x2b],
    description: "Adds a context menu option to search messages from a user",
    settings,

    start() {
        addContextMenuPatch("user-context", UserContextMenuPatch);
    },

    stop() {
        removeContextMenuPatch("user-context", UserContextMenuPatch);
    },
});



