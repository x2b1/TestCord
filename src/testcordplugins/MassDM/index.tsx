/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, sendBotMessage } from "@api/Commands";
import { definePluginSettings } from "@api/Settings";
import { TestcordDevs } from "@utils/constants";
import { sendMessage } from "@utils/discord";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, GuildMemberStore, GuildStore, React, RelationshipStore, UserStore } from "@webpack/common";

const logger = new Logger("MassDM");

interface ResponsePair {
    trigger: string;
    response: string;
}

const settings = definePluginSettings({
    friends: {
        type: OptionType.BOOLEAN,
        description: "Include friends in mass DM",
        default: true,
    },
    onlyFriends: {
        type: OptionType.BOOLEAN,
        description: "Only message friends (requires Friends to be enabled)",
        default: false,
    },
    randomPeople: {
        type: OptionType.BOOLEAN,
        description: "Include random people from servers",
        default: false,
    },
    randomPeopleLimit: {
        type: OptionType.NUMBER,
        description: "Maximum number of random people to message",
        default: 10,
    },
    autoResponses: {
        type: OptionType.BOOLEAN,
        description: "Enable automatic responses to triggers",
        default: false,
    },
    responses: {
        type: OptionType.COMPONENT,
        description: "Manage trigger-response pairs",
        component: () => <ResponsesSettings />,
    },
});

function ResponsesSettings() {
    const [responses, setResponses] = React.useState<ResponsePair[]>(settings.store.responses || []);

    const addResponse = () => {
        setResponses([...responses, { trigger: "", response: "" }]);
    };

    const updateResponse = (index: number, field: keyof ResponsePair, value: string) => {
        const newResponses = [...responses];
        newResponses[index][field] = value;
        setResponses(newResponses);
        settings.store.responses = newResponses;
    };

    const deleteResponse = (index: number) => {
        const newResponses = responses.filter((_, i) => i !== index);
        setResponses(newResponses);
        settings.store.responses = newResponses;
    };

    return (
        <div>
            {responses.map((resp, index) => (
                <div key={index} style={{ marginBottom: "10px", display: "flex", alignItems: "center" }}>
                    <input
                        type="text"
                        placeholder="Trigger word"
                        value={resp.trigger}
                        onChange={e => updateResponse(index, "trigger", e.target.value)}
                        style={{ marginRight: "10px", flex: 1 }}
                    />
                    <input
                        type="text"
                        placeholder="Response message"
                        value={resp.response}
                        onChange={e => updateResponse(index, "response", e.target.value)}
                        style={{ marginRight: "10px", flex: 1 }}
                    />
                    <button onClick={() => deleteResponse(index)}>Delete</button>
                </div>
            ))}
            <button onClick={addResponse}>Add Response</button>
        </div>
    );
}

function getUsersToMessage() {
    const users: string[] = [];

    if (settings.store.friends) {
        const friendIds = RelationshipStore.getFriendIDs();
        users.push(...friendIds);
    }

    if (settings.store.randomPeople) {
        const guildIds = Object.keys(GuildStore.getGuilds());
        const randomUsers: string[] = [];

        for (const guildId of guildIds) {
            const members = GuildMemberStore.getMembers(guildId);
            for (const member of members) {
                const memberId = member.userId;
                if (!users.includes(memberId) && RelationshipStore.getRelationshipType(memberId) !== 2) { // not blocked
                    randomUsers.push(memberId);
                }
            }
        }

        // Shuffle and limit
        const shuffled = randomUsers.sort(() => 0.5 - Math.random());
        users.push(...shuffled.slice(0, settings.store.randomPeopleLimit));
    }

    if (settings.store.onlyFriends && settings.store.friends) {
        // If only friends, filter to only friends
        const friendIds = RelationshipStore.getFriendIDs();
        return users.filter(id => friendIds.includes(id));
    }

    return users.filter(id => id !== UserStore.getCurrentUser().id);
}

export default definePlugin({
    name: "MassDM",
    description: "Mass direct message users with customizable options and auto-responses",
    authors: [TestcordDevs.x2b],
    settings,

    commands: [
        {
            name: "massdm",
            description: "Send a message to multiple users",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "message",
                    description: "The message to send",
                    type: ApplicationCommandOptionType.STRING,
                    required: true,
                },
                {
                    name: "delay",
                    description: "Delay between messages in milliseconds (default: 100)",
                    type: ApplicationCommandOptionType.NUMBER,
                    required: false,
                },
            ],
            execute: async (args, ctx) => {
                const message = args.find(arg => arg.name === "message")?.value as string;
                const delayArg = args.find(arg => arg.name === "delay")?.value;
                const delay = typeof delayArg === "number" ? delayArg : 100;

                if (!message) {
                    sendBotMessage(ctx.channel.id, { content: "❌ Please provide a message." });
                    return;
                }

                const users = getUsersToMessage();
                if (users.length === 0) {
                    sendBotMessage(ctx.channel.id, { content: "❌ No users to message based on current settings." });
                    return;
                }

                sendBotMessage(ctx.channel.id, { content: `🚀 Starting mass DM to ${users.length} users...` });

                for (let i = 0; i < users.length; i++) {
                    const userId = users[i];
                    try {
                        const channelId = ChannelStore.getDMFromUserId(userId);
                        if (channelId) {
                            sendMessage(channelId, { content: message });
                        }
                    } catch (error) {
                        logger.error(`Failed to send message to ${userId}:`, error);
                    }

                    if (i < users.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }

                sendBotMessage(ctx.channel.id, { content: "✅ Mass DM completed!" });
            },
        },
    ],

    patches: [
        {
            find: "MESSAGE_CREATE:function",
            replacement: {
                match: /MESSAGE_CREATE:function\((\i)\)\{/,
                replace: "MESSAGE_CREATE:function($1){$self.handleMessage($1);",
            },
        },
    ],

    handleMessage: (event: any) => {
        if (!settings.store.autoResponses) return;

        const { message } = event;
        if (!message || message.author.id === UserStore.getCurrentUser().id) return;

        const responses: ResponsePair[] = settings.store.responses || [];
        for (const resp of responses) {
            if (resp.trigger && resp.response && message.content.toLowerCase().includes(resp.trigger.toLowerCase())) {
                // Send response in the same channel
                sendMessage(message.channel_id, { content: resp.response });
                break; // Only respond to first matching trigger
            }
        }
    },
});
