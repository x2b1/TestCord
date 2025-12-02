/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandOptionType, sendBotMessage } from "@api/Commands";
import { ApplicationCommandInputType } from "@api/Commands/types";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { FluxDispatcher, UserStore, ChannelStore, RelationshipStore, GuildStore } from "@webpack/common";

const MessageCreator = findByPropsLazy("sendMessage", "editMessage");
const UploadManager = findByPropsLazy("upload", "getUploads");

const CLYDE_USER_ID = "1081004946872352958";
const DISCORD_SYSTEM_USER_ID = "0";

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
    PURCHASE_NOTIFICATION = 44
}

function generateSnowflake() {
    const timestamp = BigInt(Date.now() - 1420070400000);
    const random = BigInt(Math.floor(Math.random() * 4096));
    return (timestamp << 22n | random).toString();
}

function createOfficialNitroGiftEmbed(gifterId: string, duration: string = "1 month") {
    const gifter = UserStore.getUser(gifterId);
    const gifterName = gifter?.username || "Someone";
    
    return {
        id: generateSnowflake(),
        type: "rich",
        title: "A gift for you!",
        description: `${gifterName} just gifted you **Discord Nitro** for **${duration}**! 🎉\nEnjoy animated avatars, custom emoji anywhere, and more!`,
        color: 0x5865F2,
        url: "https://discord.com/gifts/xxxx-xxxx-xxxx",
        thumbnail: {
            url: "https://cdn.discordapp.com/attachments/1024859932628434964/1118092054170116167/Nitro.png",
            width: 128,
            height: 128
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
        timestamp: new Date().toISOString(),
        provider: {
            name: "Discord"
        }
    };
}

function createServerBoostEmbed(tier: number = 1, boosterId?: string) {
    const booster = boosterId ? UserStore.getUser(boosterId) : null;
    const boosterName = booster?.username || "Someone";
    const levelEmoji = ["✨", "🌟", "💫"][tier - 1] || "✨";
    
    return {
        id: generateSnowflake(),
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
        id: generateSnowflake(),
        type: "rich",
        title: "Clyde",
        description: message,
        color: 0x2F3136,
        footer: {
            text: "This is an automated message from Discord",
            icon_url: "https://cdn.discordapp.com/attachments/1024859932628434964/1118092054170116167/Nitro.png"
        },
        timestamp: new Date().toISOString()
    };
}

function createDiscordSystemEmbed(title: string, message: string) {
    return {
        id: generateSnowflake(),
        type: "rich",
        title: title,
        description: message,
        color: 0x5865F2,
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

function createAutoModEmbed(rule: string, action: string) {
    return {
        id: generateSnowflake(),
        type: "rich",
        title: "🚨 AutoMod Action",
        description: `A message was blocked by AutoMod`,
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

function createPurchaseNotificationEmbed(item: string, price: string) {
    return {
        id: generateSnowflake(),
        type: "rich",
        title: "🛒 Purchase Complete",
        description: `Thanks for your purchase!`,
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
    name: "AdvancedSystemMessageSpoofer",
    description: "Spoof Discord system messages with multiple dedicated commands",
    authors: [Devs.Ven],
    dependencies: ["CommandsAPI"],

    commands: [
        {
            name: "spoofnitro",
            description: "Spoof a Discord Nitro gift notification",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    type: ApplicationCommandOptionType.USER,
                    name: "gifter",
                    description: "User who sent the gift",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.STRING,
                    name: "duration",
                    description: "Duration of the Nitro gift",
                    required: false,
                    choices: [
                        { label: "1 Month", value: "1 month" },
                        { label: "3 Months", value: "3 months" },
                        { label: "1 Year", value: "1 year" }
                    ]
                },
                {
                    type: ApplicationCommandOptionType.CHANNEL,
                    name: "channel",
                    description: "Channel to send in (defaults to current)",
                    required: false
                },
                {
                    type: ApplicationCommandOptionType.NUMBER,
                    name: "delay",
                    description: "Delay in seconds",
                    required: false,
                    min_value: 0,
                    max_value: 10
                }
            ],
            execute: async (args, ctx) => {
                try {
                    const channelId = args.find(x => x.name === "channel")?.value ?? ctx.channel.id;
                    const gifterId = args.find(x => x.name === "gifter")?.value as string;
                    const duration = args.find(x => x.name === "duration")?.value as string || "1 month";
                    const delay = (args.find(x => x.name === "delay")?.value as number || 0) * 1000;
                    
                    setTimeout(() => {
                        const embed = createOfficialNitroGiftEmbed(gifterId, duration);
                        
                        dispatchMessage(channelId, {
                            type: MessageType.DEFAULT,
                            author: {
                                id: DISCORD_SYSTEM_USER_ID,
                                username: "Discord",
                                avatar: "28174a34e77bb5e5310ced9f95cb480b",
                                discriminator: "0000",
                                public_flags: 0,
                                bot: true,
                                flags: 0
                            },
                            content: "",
                            embeds: [embed],
                            components: [
                                {
                                    type: 1,
                                    components: [
                                        {
                                            type: 2,
                                            style: 3,
                                            label: "Accept Gift",
                                            custom_id: "accept_nitro_gift"
                                        },
                                        {
                                            type: 2,
                                            style: 2,
                                            label: "See Details",
                                            custom_id: "view_nitro_details"
                                        }
                                    ]
                                }
                            ]
                        });
                    }, delay);
                    
                    sendBotMessage(ctx.channel.id, {
                        content: "✅ Nitro gift spoof will appear shortly...",
                        ephemeral: true
                    });
                } catch (error) {
                    sendBotMessage(ctx.channel.id, {
                        content: `❌ Error: ${error}`,
                        ephemeral: true
                    });
                }
            }
        },
        
        {
            name: "spoofboost",
            description: "Spoof a server boost notification",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    type: ApplicationCommandOptionType.USER,
                    name: "booster",
                    description: "User who boosted",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.INTEGER,
                    name: "tier",
                    description: "Boost tier (1-3)",
                    required: false,
                    choices: [
                        { label: "Tier 1", value: 1 },
                        { label: "Tier 2", value: 2 },
                        { label: "Tier 3", value: 3 }
                    ]
                },
                {
                    type: ApplicationCommandOptionType.CHANNEL,
                    name: "channel",
                    description: "Channel to send in",
                    required: false
                },
                {
                    type: ApplicationCommandOptionType.BOOLEAN,
                    name: "anonymous",
                    description: "Send as anonymous boost",
                    required: false
                }
            ],
            execute: async (args, ctx) => {
                try {
                    const channelId = args.find(x => x.name === "channel")?.value ?? ctx.channel.id;
                    const boosterId = args.find(x => x.name === "booster")?.value as string;
                    const tier = args.find(x => x.name === "tier")?.value as number || 1;
                    const anonymous = args.find(x => x.name === "anonymous")?.value as boolean || false;
                    
                    const embed = createServerBoostEmbed(tier, anonymous ? undefined : boosterId);
                    
                    dispatchMessage(channelId, {
                        type: MessageType.GUILD_BOOST,
                        author: {
                            id: DISCORD_SYSTEM_USER_ID,
                            username: "Discord",
                            avatar: "28174a34e77bb5e5310ced9f95cb480b",
                            discriminator: "0000",
                            public_flags: 0,
                            bot: true,
                            flags: 0
                        },
                        content: "",
                        embeds: [embed]
                    });
                    
                    sendBotMessage(ctx.channel.id, {
                        content: "✅ Server boost spoofed!",
                        ephemeral: true
                    });
                } catch (error) {
                    sendBotMessage(ctx.channel.id, {
                        content: `❌ Error: ${error}`,
                        ephemeral: true
                    });
                }
            }
        },
        
        {
            name: "spoofclyde",
            description: "Spoof a message from Clyde (Discord's bot)",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    type: ApplicationCommandOptionType.STRING,
                    name: "message",
                    description: "Message content from Clyde",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.CHANNEL,
                    name: "channel",
                    description: "Channel to send in",
                    required: false
                },
                {
                    type: ApplicationCommandOptionType.ATTACHMENT,
                    name: "attachment",
                    description: "Optional attachment",
                    required: false
                }
            ],
            execute: async (args, ctx) => {
                try {
                    const channelId = args.find(x => x.name === "channel")?.value ?? ctx.channel.id;
                    const message = args.find(x => x.name === "message")?.value as string;
                    const attachment = args.find(x => x.name === "attachment")?.value;
                    
                    const embed = createClydeEmbed(message);
                    
                    const messageData: any = {
                        type: MessageType.DEFAULT,
                        author: {
                            id: CLYDE_USER_ID,
                            username: "Clyde",
                            avatar: null,
                            discriminator: "0000",
                            public_flags: 1 << 16,
                            bot: true,
                            flags: 0
                        },
                        content: "",
                        embeds: [embed]
                    };
                    
                    if (attachment) {
                        messageData.attachments = [{
                            id: generateSnowflake(),
                            filename: "clyde_attachment.png",
                            size: 1024,
                            url: attachment,
                            proxy_url: attachment,
                            width: 128,
                            height: 128,
                            content_type: "image/png"
                        }];
                    }
                    
                    dispatchMessage(channelId, messageData);
                    
                    sendBotMessage(ctx.channel.id, {
                        content: "✅ Clyde message spoofed!",
                        ephemeral: true
                    });
                } catch (error) {
                    sendBotMessage(ctx.channel.id, {
                        content: `❌ Error: ${error}`,
                        ephemeral: true
                    });
                }
            }
        },
        
        {
            name: "spoofjoin",
            description: "Spoof a user join notification",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    type: ApplicationCommandOptionType.USER,
                    name: "user",
                    description: "User who joined",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.CHANNEL,
                    name: "channel",
                    description: "Channel to send in",
                    required: false
                },
                {
                    type: ApplicationCommandOptionType.BOOLEAN,
                    name: "show_welcome",
                    description: "Show welcome message",
                    required: false
                }
            ],
            execute: async (args, ctx) => {
                try {
                    const channelId = args.find(x => x.name === "channel")?.value ?? ctx.channel.id;
                    const userId = args.find(x => x.name === "user")?.value as string;
                    const showWelcome = args.find(x => x.name === "show_welcome")?.value as boolean || false;
                    
                    const user = UserStore.getUser(userId);
                    const username = user?.username || "Unknown User";
                    
                    dispatchMessage(channelId, {
                        type: MessageType.USER_JOIN,
                        author: {
                            id: DISCORD_SYSTEM_USER_ID,
                            username: "Discord",
                            avatar: "28174a34e77bb5e5310ced9f95cb480b",
                            discriminator: "0000",
                            public_flags: 0,
                            bot: true,
                            flags: 0
                        },
                        content: showWelcome 
                            ? `🎉 Welcome ${username} to the server! 🎉\nPlease read the rules and enjoy your stay!`
                            : `${username} joined the server.`
                    });
                    
                    sendBotMessage(ctx.channel.id, {
                        content: "✅ Join notification spoofed!",
                        ephemeral: true
                    });
                } catch (error) {
                    sendBotMessage(ctx.channel.id, {
                        content: `❌ Error: ${error}`,
                        ephemeral: true
                    });
                }
            }
        },
        
        {
            name: "spoofpin",
            description: "Spoof a message pin notification",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    type: ApplicationCommandOptionType.USER,
                    name: "user",
                    description: "User who pinned",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.CHANNEL,
                    name: "channel",
                    description: "Channel to send in",
                    required: false
                },
                {
                    type: ApplicationCommandOptionType.STRING,
                    name: "pinned_message",
                    description: "Content of pinned message",
                    required: false
                }
            ],
            execute: async (args, ctx) => {
                try {
                    const channelId = args.find(x => x.name === "channel")?.value ?? ctx.channel.id;
                    const userId = args.find(x => x.name === "user")?.value as string;
                    const pinnedContent = args.find(x => x.name === "pinned_message")?.value as string || "Check this out!";
                    
                    const user = UserStore.getUser(userId);
                    const username = user?.username || "Someone";
                    
                    dispatchMessage(channelId, {
                        type: MessageType.CHANNEL_PINNED_MESSAGE,
                        author: {
                            id: DISCORD_SYSTEM_USER_ID,
                            username: "Discord",
                            avatar: "28174a34e77bb5e5310ced9f95cb480b",
                            discriminator: "0000",
                            public_flags: 0,
                            bot: true,
                            flags: 0
                        },
                        content: `${username} pinned a message to this channel. See all the pins.`
                    });
                    
                    sendBotMessage(ctx.channel.id, {
                        content: "✅ Pin notification spoofed!",
                        ephemeral: true
                    });
                } catch (error) {
                    sendBotMessage(ctx.channel.id, {
                        content: `❌ Error: ${error}`,
                        ephemeral: true
                    });
                }
            }
        },
        
        {
            name: "spoofcall",
            description: "Spoof a call start/end notification",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    type: ApplicationCommandOptionType.USER,
                    name: "user",
                    description: "User who started/ended the call",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.CHANNEL,
                    name: "channel",
                    description: "Channel to send in",
                    required: false
                },
                {
                    type: ApplicationCommandOptionType.STRING,
                    name: "action",
                    description: "Call action",
                    required: true,
                    choices: [
                        { label: "Start Call", value: "start" },
                        { label: "End Call", value: "end" }
                    ]
                },
                {
                    type: ApplicationCommandOptionType.INTEGER,
                    name: "duration",
                    description: "Call duration in minutes (for end)",
                    required: false
                }
            ],
            execute: async (args, ctx) => {
                try {
                    const channelId = args.find(x => x.name === "channel")?.value ?? ctx.channel.id;
                    const userId = args.find(x => x.name === "user")?.value as string;
                    const action = args.find(x => x.name === "action")?.value as string;
                    const duration = args.find(x => x.name === "duration")?.value as number;
                    
                    const user = UserStore.getUser(userId);
                    const username = user?.username || "Someone";
                    
                    const content = action === "start" 
                        ? `${username} started a call. Join here!`
                        : `${username} ended the call${duration ? ` (Duration: ${duration} minutes)` : ''}.`;
                    
                    dispatchMessage(channelId, {
                        type: MessageType.CALL,
                        author: {
                            id: DISCORD_SYSTEM_USER_ID,
                            username: "Discord",
                            avatar: "28174a34e77bb5e5310ced9f95cb480b",
                            discriminator: "0000",
                            public_flags: 0,
                            bot: true,
                            flags: 0
                        },
                        content: content,
                        components: action === "start" ? [
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 2,
                                        style: 1,
                                        label: "Join Call",
                                        custom_id: "join_call_button"
                                    }
                                ]
                            }
                        ] : []
                    });
                    
                    sendBotMessage(ctx.channel.id, {
                        content: "✅ Call notification spoofed!",
                        ephemeral: true
                    });
                } catch (error) {
                    sendBotMessage(ctx.channel.id, {
                        content: `❌ Error: ${error}`,
                        ephemeral: true
                    });
                }
            }
        },
        
        {
            name: "spoofautomod",
            description: "Spoof an AutoMod action notification",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    type: ApplicationCommandOptionType.STRING,
                    name: "rule",
                    description: "AutoMod rule that was triggered",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.STRING,
                    name: "action",
                    description: "Action taken",
                    required: true,
                    choices: [
                        { label: "Block Message", value: "block" },
                        { label: "Send Alert", value: "alert" },
                        { label: "Timeout User", value: "timeout" }
                    ]
                },
                {
                    type: ApplicationCommandOptionType.USER,
                    name: "user",
                    description: "User who triggered it",
                    required: false
                },
                {
                    type: ApplicationCommandOptionType.CHANNEL,
                    name: "channel",
                    description: "Channel to send in",
                    required: false
                }
            ],
            execute: async (args, ctx) => {
                try {
                    const channelId = args.find(x => x.name === "channel")?.value ?? ctx.channel.id;
                    const rule = args.find(x => x.name === "rule")?.value as string;
                    const action = args.find(x => x.name === "action")?.value as string;
                    const userId = args.find(x => x.name === "user")?.value as string;
                    
                    const user = userId ? UserStore.getUser(userId) : null;
                    const actionText = {
                        block: "Message blocked",
                        alert: "Alert sent to moderators",
                        timeout: "User timed out"
                    }[action] || action;
                    
                    const embed = createAutoModEmbed(rule, actionText);
                    if (user) {
                        embed.description = `${user.username} triggered an AutoMod rule`;
                    }
                    
                    dispatchMessage(channelId, {
                        type: MessageType.AUTO_MODERATION_ACTION,
                        author: {
                            id: DISCORD_SYSTEM_USER_ID,
                            username: "Discord AutoMod",
                            avatar: "28174a34e77bb5e5310ced9f95cb480b",
                            discriminator: "0000",
                            public_flags: 0,
                            bot: true,
                            flags: 0
                        },
                        content: "",
                        embeds: [embed]
                    });
                    
                    sendBotMessage(ctx.channel.id, {
                        content: "✅ AutoMod notification spoofed!",
                        ephemeral: true
                    });
                } catch (error) {
                    sendBotMessage(ctx.channel.id, {
                        content: `❌ Error: ${error}`,
                        ephemeral: true
                    });
                }
            }
        },
        
        {
            name: "spoofsystem",
            description: "Spoof an official Discord system message",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    type: ApplicationCommandOptionType.STRING,
                    name: "title",
                    description: "Title of the system message",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.STRING,
                    name: "message",
                    description: "System message content",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.CHANNEL,
                    name: "channel",
                    description: "Channel to send in",
                    required: false
                },
                {
                    type: ApplicationCommandOptionType.STRING,
                    name: "type",
                    description: "Type of system message",
                    required: false,
                    choices: [
                        { label: "Announcement", value: "announcement" },
                        { label: "Warning", value: "warning" },
                        { label: "Update", value: "update" },
                        { label: "Maintenance", value: "maintenance" }
                    ]
                },
                {
                    type: ApplicationCommandOptionType.ATTACHMENT,
                    name: "attachment",
                    description: "Optional system attachment",
                    required: false
                }
            ],
            execute: async (args, ctx) => {
                try {
                    const channelId = args.find(x => x.name === "channel")?.value ?? ctx.channel.id;
                    const title = args.find(x => x.name === "title")?.value as string;
                    const message = args.find(x => x.name === "message")?.value as string;
                    const type = args.find(x => x.name === "type")?.value as string || "announcement";
                    const attachment = args.find(x => x.name === "attachment")?.value;
                    
                    const color = {
                        announcement: 0x5865F2,
                        warning: 0xFEE75C,
                        update: 0x57F287,
                        maintenance: 0xED4245
                    }[type] || 0x5865F2;
                    
                    const embed = createDiscordSystemEmbed(title, message);
                    embed.color = color;
                    
                    const messageData: any = {
                        type: MessageType.DEFAULT,
                        author: {
                            id: DISCORD_SYSTEM_USER_ID,
                            username: "Discord",
                            avatar: "28174a34e77bb5e5310ced9f95cb480b",
                            discriminator: "0000",
                            public_flags: 0,
                            bot: true,
                            flags: 0
                        },
                        content: "",
                        embeds: [embed]
                    };
                    
                    if (attachment) {
                        messageData.attachments = [{
                            id: generateSnowflake(),
                            filename: `system_${type}.png`,
                            size: 2048,
                            url: attachment,
                            proxy_url: attachment,
                            content_type: "image/png"
                        }];
                    }
                    
                    dispatchMessage(channelId, messageData);
                    
                    sendBotMessage(ctx.channel.id, {
                        content: "✅ System message spoofed!",
                        ephemeral: true
                    });
                } catch (error) {
                    sendBotMessage(ctx.channel.id, {
                        content: `❌ Error: ${error}`,
                        ephemeral: true
                    });
                }
            }
        },
        
        {
            name: "spoofpurchase",
            description: "Spoof a purchase notification",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    type: ApplicationCommandOptionType.USER,
                    name: "user",
                    description: "User who made purchase",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.STRING,
                    name: "item",
                    description: "Item purchased",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.STRING,
                    name: "price",
                    description: "Price (e.g., $9.99)",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.CHANNEL,
                    name: "channel",
                    description: "Channel to send in",
                    required: false
                }
            ],
            execute: async (args, ctx) => {
                try {
                    const channelId = args.find(x => x.name === "channel")?.value ?? ctx.channel.id;
                    const userId = args.find(x => x.name === "user")?.value as string;
                    const item = args.find(x => x.name === "item")?.value as string;
                    const price = args.find(x => x.name === "price")?.value as string;
                    
                    const user = UserStore.getUser(userId);
                    
                    const embed = createPurchaseNotificationEmbed(item, price);
                    embed.description = `${user?.username || "A user"} purchased ${item}`;
                    
                    dispatchMessage(channelId, {
                        type: MessageType.PURCHASE_NOTIFICATION,
                        author: {
                            id: DISCORD_SYSTEM_USER_ID,
                            username: "Discord Shop",
                            avatar: "28174a34e77bb5e5310ced9f95cb480b",
                            discriminator: "0000",
                            public_flags: 0,
                            bot: true,
                            flags: 0
                        },
                        content: "",
                        embeds: [embed]
                    });
                    
                    sendBotMessage(ctx.channel.id, {
                        content: "✅ Purchase notification spoofed!",
                        ephemeral: true
                    });
                } catch (error) {
                    sendBotMessage(ctx.channel.id, {
                        content: `❌ Error: ${error}`,
                        ephemeral: true
                    });
                }
            }
        },
        
        {
            name: "spoofvoicemessage",
            description: "Spoof a voice message notification",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    type: ApplicationCommandOptionType.USER,
                    name: "user",
                    description: "User who sent voice message",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.CHANNEL,
                    name: "channel",
                    description: "Channel to send in",
                    required: false
                },
                {
                    type: ApplicationCommandOptionType.INTEGER,
                    name: "duration",
                    description: "Duration in seconds",
                    required: false,
                    min_value: 1,
                    max_value: 300
                },
                {
                    type: ApplicationCommandOptionType.ATTACHMENT,
                    name: "waveform",
                    description: "Waveform image (optional)",
                    required: false
                }
            ],
            execute: async (args, ctx) => {
                try {
                    const channelId = args.find(x => x.name === "channel")?.value ?? ctx.channel.id;
                    const userId = args.find(x => x.name === "user")?.value as string;
                    const duration = args.find(x => x.name === "duration")?.value as number || 30;
                    const waveform = args.find(x => x.name === "waveform")?.value;
                    
                    const user = UserStore.getUser(userId);
                    
                    dispatchMessage(channelId, {
                        type: MessageType.DEFAULT,
                        author: {
                            id: userId,
                            username: user?.username || "Unknown",
                            avatar: user?.avatar || null,
                            discriminator: user?.discriminator || "0000",
                            public_flags: user?.publicFlags || 0,
                            bot: false,
                            flags: 0
                        },
                        content: `🎤 Voice Message (${duration}s)`,
                        flags: 8192, // Voice message flag
                        attachments: waveform ? [{
                            id: generateSnowflake(),
                            filename: "voice-message-waveform.png",
                            size: 512,
                            url: waveform,
                            proxy_url: waveform,
                            content_type: "image/png",
                            waveform: "data:audio/waveform;base64," + btoa("waveform_data")
                        }] : []
                    });
                    
                    sendBotMessage(ctx.channel.id, {
                        content: "✅ Voice message spoofed!",
                        ephemeral: true
                    });
                } catch (error) {
                    sendBotMessage(ctx.channel.id, {
                        content: `❌ Error: ${error}`,
                        ephemeral: true
                    });
                }
            }
        },
        
        {
            name: "spoofmedia",
            description: "Spoof any media message with custom attachments",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    type: ApplicationCommandOptionType.USER,
                    name: "user",
                    description: "User who sent media",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.CHANNEL,
                    name: "channel",
                    description: "Channel to send in",
                    required: false
                },
                {
                    type: ApplicationCommandOptionType.STRING,
                    name: "caption",
                    description: "Caption for media",
                    required: false
                },
                {
                    type: ApplicationCommandOptionType.ATTACHMENT,
                    name: "media1",
                    description: "Media attachment 1",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.ATTACHMENT,
                    name: "media2",
                    description: "Media attachment 2",
                    required: false
                },
                {
                    type: ApplicationCommandOptionType.ATTACHMENT,
                    name: "media3",
                    description: "Media attachment 3",
                    required: false
                },
                {
                    type: ApplicationCommandOptionType.ATTACHMENT,
                    name: "media4",
                    description: "Media attachment 4",
                    required: false
                },
                {
                    type: ApplicationCommandOptionType.STRING,
                    name: "type",
                    description: "Media type",
                    required: false,
                    choices: [
                        { label: "Image", value: "image" },
                        { label: "Video", value: "video" },
                        { label: "Audio", value: "audio" },
                        { label: "File", value: "file" }
                    ]
                }
            ],
            execute: async (args, ctx) => {
                try {
                    const channelId = args.find(x => x.name === "channel")?.value ?? ctx.channel.id;
                    const userId = args.find(x => x.name === "user")?.value as string;
                    const caption = args.find(x => x.name === "caption")?.value as string;
                    const mediaType = args.find(x => x.name === "type")?.value as string || "image";
                    
                    const user = UserStore.getUser(userId);
                    const attachments = [];
                    
                    for (let i = 1; i <= 4; i++) {
                        const media = args.find(x => x.name === `media${i}`);
                        if (media?.value) {
                            attachments.push({
                                id: generateSnowflake(),
                                filename: `${mediaType}_${i}.${mediaType === 'image' ? 'png' : mediaType === 'video' ? 'mp4' : 'bin'}`,
                                size: 1024 * 1024,
                                url: media.value,
                                proxy_url: media.value,
                                content_type: mediaType === 'image' ? 'image/png' : 
                                            mediaType === 'video' ? 'video/mp4' : 
                                            mediaType === 'audio' ? 'audio/mpeg' : 'application/octet-stream',
                                width: mediaType === 'image' ? 1280 : null,
                                height: mediaType === 'image' ? 720 : null
                            });
                        }
                    }
                    
                    dispatchMessage(channelId, {
                        type: MessageType.DEFAULT,
                        author: {
                            id: userId,
                            username: user?.username || "Unknown",
                            avatar: user?.avatar || null,
                            discriminator: user?.discriminator || "0000",
                            public_flags: user?.publicFlags || 0,
                            bot: false,
                            flags: 0
                        },
                        content: caption || "",
                        attachments: attachments
                    });
                    
                    sendBotMessage(ctx.channel.id, {
                        content: `✅ ${attachments.length} media file(s) spoofed!`,
                        ephemeral: true
                    });
                } catch (error) {
                    sendBotMessage(ctx.channel.id, {
                        content: `❌ Error: ${error}`,
                        ephemeral: true
                    });
                }
            }
        }
    ]
});