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

import definePlugin from "@utils/types";
import { Devs, EquicordDevs } from "@utils/constants";
import { RestAPI } from "@webpack/common";

export default definePlugin({
    name: "NoOnboarding",
    description: "Bypasses Discord's onboarding process for quicker server entry.",
    authors: [EquicordDevs.omaw, Devs.Glitch],
    patches: [
        {
            find: ",acceptInvite(",
            replacement: {
                match: /INVITE_ACCEPT_SUCCESS.+?,(\i)=null!=.+?;/,
                replace: (m, guildId) => `${m}$self.bypassOnboard(${guildId});`
            }
        },
        {
            find: "{joinGuild:",
            replacement: {
                match: /guildId:(\i),lurker:(\i).{0,20}}\)\);/,
                replace: (m, guildId, lurker) => `${m}if(!${lurker})$self.bypassOnboard(${guildId});`
            }
        }
    ],
    bypassOnboard(guild_id: string) {
        RestAPI.get({ url: `/guilds/${guild_id}/onboarding` }).then(res => {
            const data = res.body;
            if (!data?.prompts?.length) return;

            const now = Math.floor(Date.now() / 1000);
            const prompts_seen = {};
            const responses_seen = {};
            const responses: string[] = [];

            for (const prompt of data.prompts) {
                const options = prompt.options || [];
                if (!options.length) continue;
                prompts_seen[prompt.id] = now;
                for (const opt of options) responses_seen[opt.id] = now;
                responses.push(options[options.length - 1].id);
            }

            const payload = {
                onboarding_responses: responses,
                onboarding_prompts_seen: prompts_seen,
                onboarding_responses_seen: responses_seen,
            };

            RestAPI.post({
                url: `/guilds/${guild_id}/onboarding-responses`,
                body: payload
            });
        });
    }
});
