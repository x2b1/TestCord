/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandOptionType, sendBotMessage } from "@api/Commands";
import { ApplicationCommandInputType } from "@api/Commands/types";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";
import { FluxDispatcher, UserStore } from "@webpack/common";

const CLYDE_USER_ID = "1081004946872352958";
const DISCORD_SYSTEM_USER_ID = "000000000000000000"; // Discord system user

enum MessageType {
    DEFAULT = 0,
    RECIPIENT_ADD = 1,
    RECIPIENT_REMOVE = 2,
    CALL = 3,
    CHANNEL_NAME_CHANGE = 4,
    CHANNEL_ICON_CHANGE = 5,
    CHANNEL_PINNED_MESSAGE = 6,
    USER_JOIN = 7,
    GUILD_BOOST = 8,
    GUILD_BOOST_TIER_1 = 9,
    GUILD_BOOST_TIER_2 = 10,
    GUILD_BOOST_TIER_3 = 11,
    CHANNEL_FOLLOW_ADD = 12,
    GUILD_DISCOVERY_DISQUALIFIED = 14,
    GUILD_DISCOVERY_REQUALIFIED = 15,
    GUILD_DISCOVERY_GRACE_PERIOD_INITIAL_WARNING = 16,
    GUILD_DISCOVERY_GRACE_PERIOD_FINAL_WARNING = 17,
    THREAD_CREATED = 18,
    REPLY = 19,
    CHAT_INPUT_COMMAND = 20,
    THREAD_STARTER_MESSAGE = 21,
    GUILD_INVITE_REMINDER = 22,
    CONTEXT_MENU_COMMAND = 23,
    AUTO_MODERATION_ACTION = 24,
    ROLE_SUBSCRIPTION_PURCHASE = 25,
    INTERACTION_PREMIUM_UPSELL = 26,
    STAGE_START = 27,
    STAGE_END = 28,
    STAGE_SPEAKER = 29,
    STAGE_TOPIC = 31,
    GUILD_APPLICATION_PREMIUM_SUBSCRIPTION = 32,
    GUILD_INCIDENT_ALERT_MODE_ENABLED = 36,
    GUILD_INCIDENT_ALERT_MODE_DISABLED = 37,
    GUILD_INCIDENT_REPORT_RAID = 38,
    GUILD_INCIDENT_REPORT_FALSE_ALARM = 39,
    PURCHASE_NOTIFICATION = 44
}

function createOfficialNitroGiftEmbed(duration: string, fromUser: string) {
    return {
        type: "rich",
        title: "You've been gifted a subscription!",
        description: `${fromUser} has gifted you Discord Nitro for ${duration}!`,
        color: 0x5865f2,
        thumbnail: {
            url: "https://discord.com/assets/3c6ccb83716d1e4fb91d3082f6b21d77.svg"
        },
        fields: [
            {
                name: "Expires in",
                value: "48 hours",
                inline: true
            }
        ],
        footer: {
            text: "Discord",
            icon_url: "https://discord.com/assets/28174a34e77bb5e5310ced9f95cb480b.png"
        },
        timestamp: new Date().toISOString()
    };
}

function createOfficialBadgeEmbed() {
    return {
        type: "rich",
        author: {
            name: "Discord",
            icon_url: "https://discord.com/assets/28174a34e77bb5e5310ced9f95cb480b.png"
        },
        color: 0x5865f2
    };
}

function createClydeComponents() {
    return [
        {
            type: 1,
            components: [
                {
                    type: 2,
                    style: 4,
                    label: "Dismiss message",
                    custom_id: "clyde_dismiss"
                }
            ]
        }
    ];
}

export default definePlugin({
    name: "SystemMessageSpoofer",
    description: "Spoof Discord system messages, including nitro gifts, Clyde messages, and verified Discord messages",
    authors: [Devs.Ven],
    dependencies: ["CommandsAPI"],

    commands: [
        {
            name: "spoofsystem",
            description: "Spoof a system message",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    type: ApplicationCommandOptionType.STRING,
                    name: "type",
                    description: "Type of system message to spoof (nitro_gift, clyde, discord_system)",
                    required: true,
                    choices: [
                        { label: "Nitro Gift", name: "Nitro Gift", value: "nitro_gift" },
                        { label: "Clyde Message", name: "Clyde Message", value: "clyde" },
                        { label: "Discord System", name: "Discord System", value: "discord_system" }
                    ]
                },
                {
                    type: ApplicationCommandOptionType.STRING,
                    name: "message",
                    description: "The message content",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.CHANNEL,
                    name: "channel",
                    description: "Channel to send the spoofed message in",
                    required: false
                },
                {
                    type: ApplicationCommandOptionType.INTEGER,
                    name: "delay",
                    description: "Delay for the message to appear (in seconds)",
                    required: false
                }
            ],
            execute: async (args, ctx) => {
                try {
                    const channel = args.find(x => x.name === "channel") ?? { value: ctx.channel.id };
                    const delay = args.find(x => x.name === "delay");
                    const type = args.find(x => x.name === "type")?.value as string || "server_boost";
                    const message = args.find(x => x.name === "message")?.value as string || "";
                    const fromUserArg = args.find(x => x.name === "from_user");
                    const duration = args.find(x => x.name === "duration")?.value as string || "1 month";

                    if (delay) {
                        FluxDispatcher.dispatch({
                            type: "TYPING_START",
                            channelId: channel.value,
                            userId: type === "clyde" ? CLYDE_USER_ID : DISCORD_SYSTEM_USER_ID,
                        });
                    }

                    let authorId: string;
                    let authorName: string;
                    let messageType: MessageType;
                    let content: string = "";
                    let embeds: any[] = [];
                    let components: any[] = [];

                    switch (type) {
                        case "server_boost":
                            authorId = DISCORD_SYSTEM_USER_ID;
                            authorName = "Discord";
                            messageType = MessageType.GUILD_BOOST;
                            content = message || "This server has reached a new boost level!";
                            break;
                        case "fake_boost":
                            authorId = DISCORD_SYSTEM_USER_ID;
                            authorName = "Discord";
                            messageType = MessageType.GUILD_BOOST;
                            content = message || "🎉 This server has reached a new boost level! 🎉";
                            break;
                        case "nitro_gift":
                            authorId = DISCORD_SYSTEM_USER_ID;
                            authorName = "Discord";
                            messageType = MessageType.DEFAULT;
                            const fromUser = fromUserArg ? UserStore.getUser(fromUserArg.value)?.username || "Someone" : "Someone";
                            embeds = [createNitroGiftEmbed(duration, fromUser)];
                            components = [
                                {
                                    type: 1,
                                    components: [
                                        {
                                            type: 2,
                                            style: 3,
                                            label: "Accept",
                                            custom_id: "nitro_accept"
                                        }
                                    ]
                                }
                            ];
                            break;
                        case "clyde":
                            authorId = CLYDE_USER_ID;
                            authorName = "Clyde";
                            messageType = MessageType.DEFAULT;
                            content = message || "This is a message from Clyde!";
                            components = createClydeComponents();
                            break;
                        case "discord_system":
                            authorId = DISCORD_SYSTEM_USER_ID;
                            authorName = "Discord";
                            messageType = MessageType.DEFAULT;
                            content = message || "This is a system message from Discord.";
                            embeds = [createOfficialBadgeEmbed()];
                            break;
                        case "user_join":
                            authorId = DISCORD_SYSTEM_USER_ID;
                            authorName = "Discord";
                            messageType = MessageType.USER_JOIN;
                            const joinUser = fromUserArg ? UserStore.getUser(fromUserArg.value)?.username || "Someone" : "Someone";
                            content = message || `${joinUser} joined the server.`;
                            break;
                        case "channel_pin":
                            authorId = DISCORD_SYSTEM_USER_ID;
                            authorName = "Discord";
                            messageType = MessageType.CHANNEL_PINNED_MESSAGE;
                            const pinUser = fromUserArg ? UserStore.getUser(fromUserArg.value)?.username || "Someone" : "Someone";
                            content = message || `${pinUser} pinned a message to this channel.`;
                            break;
                        case "call_start":
                            authorId = DISCORD_SYSTEM_USER_ID;
                            authorName = "Discord";
                            messageType = MessageType.CALL;
                            const callUser = fromUserArg ? UserStore.getUser(fromUserArg.value)?.username || "Someone" : "Someone";
                            content = message || `${callUser} started a call.`;
                            break;
                        default:
                            // Default to server boost if no type specified
                            authorId = DISCORD_SYSTEM_USER_ID;
                            authorName = "Discord";
                            messageType = MessageType.GUILD_BOOST;
                            content = message || "This server has reached a new boost level!";
                            break;
                    }

                    const user = UserStore.getUser(authorId) || {
                        id: authorId,
                        username: authorName,
                        avatar: authorId === DISCORD_SYSTEM_USER_ID ? "https://discord.com/assets/28174a34e77bb5e5310ced9f95cb480b.png" : null,
                        discriminator: "0000",
                        public_flags: (authorId === DISCORD_SYSTEM_USER_ID || type === "discord_system" || type === "server_boost" || type === "nitro_gift") ? (1 << 12) | (1 << 16) : 0, // Verified bot + official Discord flags
                        premium_type: 0,
                        flags: 0,
                        banner: null,
                        accent_color: null,
                        global_name: authorName,
                        avatar_decoration_data: null,
                        banner_color: null
                    };

                    setTimeout(() => {
                        FluxDispatcher.dispatch({
                            type: "MESSAGE_CREATE",
                            channelId: channel.value,
                            message: {
                                attachments: [],
                                author: {
                                    id: user.id,
                                    username: user.username,
                                    avatar: user.avatar,
                                    discriminator: user.discriminator,
                                    public_flags: user.publicFlags,
                                    premium_type: user.premiumType,
                                    flags: user.flags,
                                    banner: user.banner,
                                    accent_color: null,
                                    global_name: user.globalName,
                                    avatar_decoration_data: null,
                                    banner_color: null
                                },
                                channel_id: channel.value,
                                components: components,
                                content: content,
                                edited_timestamp: null,
                                embeds: embeds,
                                flags: 0,
                                id: (BigInt(Date.now() - 1420070400000) << 22n).toString(),
                                mention_everyone: false,
                                mention_roles: [],
                                mentions: [],
                                nonce: (BigInt(Date.now() - 1420070400000) << 22n).toString(),
                                pinned: false,
                                timestamp: new Date(),
                                tts: false,
                                type: messageType
                            },
                            optimistic: false,
                            isPushNotification: false
                        });
                    }, (Number(delay?.value ?? 0.5) * 1000));
                } catch (error) {
                    sendBotMessage(ctx.channel.id, {
                        content: `Something went wrong: \`${error}\``,
                    });
                }
            }
        }
    ]
});
