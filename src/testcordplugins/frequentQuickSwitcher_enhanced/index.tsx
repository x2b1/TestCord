/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs, TestcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, UserSettingsActionCreators } from "@webpack/common";

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Enable the frequent quick switcher to prioritize your most used channels",
        default: true
    },
    maxResults: {
        type: OptionType.NUMBER,
        description: "Maximum number of frequent channels to show in results",
        default: 20
    }
});

function modifyResults(query, originalResults) {
    if (!settings.store.enabled) return originalResults;

    let frequentChannels = Object.entries(UserSettingsActionCreators.FrecencyUserSettingsActionCreators.getCurrentValue().guildAndChannelFrecency.guildAndChannels)
        .map(([key, value]) => key)
        .filter(id => ChannelStore.getChannel(id) != null)
        .filter(id => query === "" || ChannelStore.getChannel(id).name.toLowerCase().includes(query.toLowerCase()))
        .sort((id1, id2) => {
            const channel1 = UserSettingsActionCreators.FrecencyUserSettingsActionCreators.getCurrentValue().guildAndChannelFrecency.guildAndChannels[id1];
            const channel2 = UserSettingsActionCreators.FrecencyUserSettingsActionCreators.getCurrentValue().guildAndChannelFrecency.guildAndChannels[id2];
            return channel2.totalUses - channel1.totalUses;
        })
        .slice(0, settings.store.maxResults);

    const frequentResults = frequentChannels.map(channelID => {
        const channel = ChannelStore.getChannel(channelID);
        return {
            type: "TEXT_CHANNEL",
            record: channel,
            score: 20,
            comparator: query,
            sortable: query
        };
    });

    // Remove duplicates from original results if they are already in frequent results
    const frequentIds = new Set(frequentResults.map(r => r.record.id));
    const filteredOriginal = originalResults.filter(r => !frequentIds.has(r.record.id));

    return frequentResults.concat(filteredOriginal);
}

export default definePlugin({
    name: "FrequentQuickSwitcher Enhanced",
    description: "Prioritizes your most frequent channels in the quick switcher results while preserving other search results -- enhanced by x2b so it wont break searching for users",
    authors: [TestcordDevs.x2b],
    settings,
    modifyResults: modifyResults,
    patches: [
        {
            find: "#{intl::QUICKSWITCHER_PLACEHOLDER}",
            replacement: {
                match: /let{selectedIndex:\i,results:\i}/,
                replace: "$& this.props.results = $self.modifyResults(this.state.query, results);"
            },
        }
    ]
});



