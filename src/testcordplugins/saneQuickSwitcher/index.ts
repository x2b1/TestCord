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

import { Devs } from "@utils/constants";
import { getCurrentGuild } from "@utils/discord";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "SaneQuickSwitcher",
    authors: [
        Devs.sadan
    ],
    description: "Puts results for the channels in the current server at the top of the quick switcher. Only reorders the results",
    patches: [
        {
            find: ".QUICKSWITCHER_PLACEHOLDER",
            replacement: {
                match: /renderResults\(\).{0,50}\i:(\i)}=this\.props;/,
                replace: "$&$1=$self.order($1);"
            }
        }
    ],
    order(results: any){
        const cGuild = getCurrentGuild();
        if(!cGuild)
            return results;
        const maxScore = results[0].score;
        for(const r of results){
            if (r.record?.guild_id === cGuild.id){
                r.score += maxScore;
            }
        }
        // it makes no sense, but for some reason, it is b - a
        return results.sort((a, b) => b.score - a.score);
    }
});
