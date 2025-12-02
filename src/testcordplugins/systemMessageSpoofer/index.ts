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

function generateSnowflake() {
    const timestamp = Date.now() - 1420070400000;
    const random = Math.floor(Math.random() * 4096);
    return ((timestamp << 22) | random).toString();
}

function createOfficialNitroGiftEmbed(gifterId: string, duration: string = "1 month") {
    const gifter = UserStore.getUser(gifterId);
    const gifterName = gifter ? `<@${gifter.id}>` : "Someone";

    return {
        type: "rich",
        title: "A gift for you!",
        description: `${gifterName} just gifted you **Discord Nitro** for **${duration}**! 🎉\nEnjoy animated avatars, custom emoji anywhere, and more!`,
        color: 0x5865F2,
        thumbnail: {
            url: "https://cdn.discordapp.com/attachments/1024859932628434964/1118092054170116167/Nitro.png"
        },
        fields: [
            {
                name: "Expires in",
                value: "48 hours",
                inline: true
            },
            {
                name: "Gift Value",
                value: `$${duration === "1 month" ? "9.99" : duration === "1 year" ? "99.99" : "4.99"}`,
                inline: true
            }
        ],
        footer: {
            text: "Discord",
            icon_url: "https://cdn.discordapp.com/attachments/1024859932628434964/1118092054564376586/5865F2.png"
        },
        timestamp: new Date().toISOString()
    };
}

function createServerBoostEmbed(tier: number = 1, boosterId?: string) {
    const booster = boosterId ? UserStore.getUser(boosterId) : null;
    const boosterName = booster ? `<@${booster.id}>` : "Someone";
    const levelEmoji = ["✨", "🌟", "💫"][tier - 1] || "✨";

    return {
        type: "rich",
        title: `${levelEmoji} Server Boosted!`,
        description: `${boosterName} just boosted the server${tier > 1 ? ` ${tier} times!` : '!'}`,
        color: 0xFF73FA,
        thumbnail: {
            url: "https://cdn.discordapp.com/attachments/1024859932628434964/1118092054778282054/Boost.png"
        },
        fields: [
            {
                name: "Server Level",
                value: `Level ${tier}`,
                inline: true
            },
            {
                name: "Benefits Unlocked",
                value: `${tier >= 1 ? "✓ 50 Emoji Slots\n" : ""}${tier >= 2 ? "✓ 100 Emoji Slots\n" : ""}${tier >= 3 ? "✓ Animated Server Icon\n" : ""}`,
                inline: true
            }
        ],
        footer: {
            text: "Thank you for boosting!",
            icon_url: "https://cdn.discordapp.com/attachments/1024859932628434964/1118092054564376586/5865F2.png"
        },
        timestamp: new Date().toISOString()
    };
}

function createClydeEmbed(message: string) {
    return {
        type: "rich",
        title: "Clyde",
        description: message,
        color: 0x2F3136,
        footer: {
            text: "This is an automated message from Discord",
            icon_url: "https://cdn.discordapp.com/attachments/1024859932628434964/1118092054564376586/5865F2.png"
        },
        timestamp: new Date().toISOString()
    };
}

function createDiscordSystemEmbed(title: string, message: string, type: string = "announcement") {
    const color = {
        announcement: 0x5865F2,
        warning: 0xFEE75C,
        update: 0x57F287,
        maintenance: 0xED4245
    }[type] || 0x5865F2;

    return {
        type: "rich",
        title: title,
        description: message,
        color: color,
        author: {
            name: "Discord",
            icon_url: "https://cdn.discordapp.com/attachments/1024859932628434964/1118092054564376586/5865F2.png"
        },
        footer: {
            text: "System Message",
            icon_url: "https://cdn.discordapp.com/attachments/1024859932628434964/1118092054564376586/5865F2.png"
        },
        timestamp: new Date().toISOString()
    };
}

function createAutoModEmbed(rule: string, action: string, username?: string) {
    return {
        type: "rich",
        title: "🚨 AutoMod Action",
        description: username ? `${username} triggered an AutoMod rule` : "A message was blocked by AutoMod",
        color: 0xED4245,
        fields: [
            {
                name: "Rule Triggered",
                value: rule,
                inline: true
            },
            {
                name: "Action Taken",
                value: action,
                inline: true
            }
        ],
        footer: {
            text: "Discord AutoMod",
            icon_url: "https://cdn.discordapp.com/attachments/1024859932628434964/1118092054564376586/5865F2.png"
        },
        timestamp: new Date().toISOString()
    };
}

function createPurchaseNotificationEmbed(item: string, price: string, username?: string) {
    return {
        type: "rich",
        title: "🛒 Purchase Complete",
        description: username ? `${username} purchased ${item}` : "Thanks for your purchase!",
        color: 0x57F287,
        fields: [
            {
                name: "Item",
                value: item,
                inline: true
            },
            {
                name: "Amount",
                value: price,
                inline: true
            }
        ],
        footer: {
            text: "Discord Shop",
            icon_url: "https://cdn.discordapp.com/attachments/1024859932628434964/1118092054564376586/5865F2.png"
        },
        timestamp: new Date().toISOString()
    };
}

function dispatchMessage(channelId: string, messageData: any) {
    const snowflake = generateSnowflake();
    const timestamp = new Date().toISOString();

    const fullMessage = {
        ...messageData,
        id: snowflake,
        nonce: snowflake,
        timestamp: timestamp,
        channel_id: channelId,
        edited_timestamp: null,
        mention_everyone: false,
        mention_roles: [],
        mentions: [],
        mention_channels: [],
        attachments: messageData.attachments || [],
        embeds: messageData.embeds || [],
        components: messageData.components || [],
        sticker_items: [],
        reactions: [],
        position: 0,
        message_reference: null,
        referenced_message: null,
        interaction: null,
        webhook_id: null,
        activity: null,
        application: null,
        application_id: null,
        flags: messageData.flags || 0,
        pinned: false,
        tts: false
    };

    FluxDispatcher.dispatch({
        type: "MESSAGE_CREATE",
        message: fullMessage,
        optimistic: false,
        isPushNotification: false
    });
}

export default definePlugin({
    name: "SystemMessageSpoofer",
    description: "Spoof Discord system messages, including nitro gifts, Clyde messages, and verified Discord messages",
    authors: [Devs.Ven],
    dependencies: ["CommandsAPI"],

    commands: [
        {
            name: "spoofnitro",
            description: "Spoof a Discord Nitro gift message",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    type: ApplicationCommandOptionType.STRING,
                    name: "duration",
                    description: "Duration of the Nitro gift (e.g., '1 month', '3 months')",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.USER,
                    name: "from_user",
                    description: "User who sent the Nitro gift",
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
                    const duration = args.find(x => x.name === "duration")?.value as string;
                    const fromUserArg = args.find(x => x.name === "from_user");

                    if (delay) {
                        FluxDispatcher.dispatch({
                            type: "TYPING_START",
                            channelId: channel.value,
                            userId: DISCORD_SYSTEM_USER_ID,
                        });
                    }

                    const fromUser = fromUserArg ? UserStore.getUser(fromUserArg.value)?.username || "Someone" : "Someone";
                    const embeds = [createOfficialNitroGiftEmbed(duration, fromUser)];
                    const components = [
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

                    const user = UserStore.getUser(DISCORD_SYSTEM_USER_ID) || {
                        id: DISCORD_SYSTEM_USER_ID,
                        username: "Discord",
                        avatar: "https://discord.com/assets/28174a34e77bb5e5310ced9f95cb480b.png",
                        discriminator: "0000",
                        public_flags: (1 << 12) | (1 << 16), // Verified bot + official Discord flags
                        premium_type: 0,
                        flags: 0,
                        banner: null,
                        accent_color: null,
                        global_name: "Discord",
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
                                content: "",
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
                                type: MessageType.DEFAULT
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
        },
        {
            name: "spoofserverboost",
            description: "Spoof a server boost message",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    type: ApplicationCommandOptionType.STRING,
                    name: "message",
                    description: "The boost message content",
                    required: false
                },
                {
                    type: ApplicationCommandOptionType.USER,
                    name: "sender",
                    description: "User who boosted the server",
                    required: false
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
                    const message = args.find(x => x.name === "message")?.value as string || "This server has reached a new boost level!";
                    const senderArg = args.find(x => x.name === "sender");

                    if (delay) {
                        FluxDispatcher.dispatch({
                            type: "TYPING_START",
                            channelId: channel.value,
                            userId: DISCORD_SYSTEM_USER_ID,
                        });
                    }

                    const sender = senderArg ? UserStore.getUser(senderArg.value)?.username || "Someone" : null;
                    const content = sender ? `${sender} boosted the server! ${message}` : message;

                    const user = UserStore.getUser(DISCORD_SYSTEM_USER_ID) || {
                        id: DISCORD_SYSTEM_USER_ID,
                        username: "Discord",
                        avatar: "https://discord.com/assets/28174a34e77bb5e5310ced9f95cb480b.png",
                        discriminator: "0000",
                        public_flags: (1 << 12) | (1 << 16), // Verified bot + official Discord flags
                        premium_type: 0,
                        flags: 0,
                        banner: null,
                        accent_color: null,
                        global_name: "Discord",
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
                                components: [],
                                content: content,
                                edited_timestamp: null,
                                embeds: [],
                                flags: 0,
                                id: (BigInt(Date.now() - 1420070400000) << 22n).toString(),
                                mention_everyone: false,
                                mention_roles: [],
                                mentions: [],
                                nonce: (BigInt(Date.now() - 1420070400000) << 22n).toString(),
                                pinned: false,
                                timestamp: new Date(),
                                tts: false,
                                type: MessageType.GUILD_BOOST
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
        },
        {
            name: "spoofclyde",
            description: "Spoof a Clyde message",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
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
                    const message = args.find(x => x.name === "message")?.value as string;

                    if (delay) {
                        FluxDispatcher.dispatch({
                            type: "TYPING_START",
                            channelId: channel.value,
                            userId: CLYDE_USER_ID,
                        });
                    }

                    const components = createClydeComponents();

                    const user = UserStore.getUser(CLYDE_USER_ID) || {
                        id: CLYDE_USER_ID,
                        username: "Clyde",
                        avatar: null,
                        discriminator: "0000",
                        public_flags: 0,
                        premium_type: 0,
                        flags: 0,
                        banner: null,
                        accent_color: null,
                        global_name: "Clyde",
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
                                content: message,
                                edited_timestamp: null,
                                embeds: [],
                                flags: 0,
                                id: (BigInt(Date.now() - 1420070400000) << 22n).toString(),
                                mention_everyone: false,
                                mention_roles: [],
                                mentions: [],
                                nonce: (BigInt(Date.now() - 1420070400000) << 22n).toString(),
                                pinned: false,
                                timestamp: new Date(),
                                tts: false,
                                type: MessageType.DEFAULT
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
        },
        {
            name: "spoofsystem",
            description: "Spoof a general system message",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
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
                    const message = args.find(x => x.name === "message")?.value as string;

                    if (delay) {
                        FluxDispatcher.dispatch({
                            type: "TYPING_START",
                            channelId: channel.value,
                            userId: DISCORD_SYSTEM_USER_ID,
                        });
                    }

                    const user = UserStore.getUser(DISCORD_SYSTEM_USER_ID) || {
                        id: DISCORD_SYSTEM_USER_ID,
                        username: "Discord",
                        avatar: "https://discord.com/assets/28174a34e77bb5e5310ced9f95cb480b.png",
                        discriminator: "0000",
                        public_flags: (1 << 12) | (1 << 16), // Verified bot + official Discord flags
                        premium_type: 0,
                        flags: 0,
                        banner: null,
                        accent_color: null,
                        global_name: "Discord",
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
                                components: [],
                                content: message,
                                edited_timestamp: null,
                                embeds: [],
                                flags: 0,
                                id: (BigInt(Date.now() - 1420070400000) << 22n).toString(),
                                mention_everyone: false,
                                mention_roles: [],
                                mentions: [],
                                nonce: (BigInt(Date.now() - 1420070400000) << 22n).toString(),
                                pinned: false,
                                timestamp: new Date(),
                                tts: false,
                                type: MessageType.DEFAULT
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
