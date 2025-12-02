/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandOptionType, sendBotMessage } from "@api/Commands";
import { ApplicationCommandInputType } from "@api/Commands/types";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { FluxDispatcher, UserStore } from "@webpack/common";

const CLYDE_USER_ID = "1081004946872352958";
const DISCORD_SYSTEM_USER_ID = "643945264868098049"; // Fixed Discord user ID

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
    const timestamp = Date.now() - 1420070400000;
    const random = Math.floor(Math.random() * 4096);
    return ((timestamp << 22) | random).toString();
}

function createOfficialNitroGiftEmbed(gifterId: string) {
    const gifter = UserStore.getUser(gifterId);
    const gifterName = gifter ? `<@${gifter.id}>` : "Someone";
    
    return {
        type: "rich",
        color: 0x5865F2,
        author: {
            name: "Discord",
            icon_url: "https://cdn.discordapp.com/emojis/1159627219011190824.png"
        },
        description: `${gifterName}, you have a gift!`,
        thumbnail: {
            url: "https://cdn.discordapp.com/emojis/1159627219011190824.png"
        },
        fields: [
            {
                name: "Expires in",
                value: "47 hours",
                inline: true
            }
        ],
        footer: {
            text: "NITRO • GET CHAT PERKS + 2 BOOSTS"
        },
        timestamp: new Date().toISOString()
    };
}

function createServerBoostEmbed(boostTier: number = 1, boosterId?: string) {
    const booster = boosterId ? UserStore.getUser(boosterId) : null;
    const boosterName = booster ? `<@${booster.id}>` : "Someone";
    const levelEmoji = ["✨", "🌟", "💫"][boostTier - 1] || "✨";
    
    return {
        type: "rich",
        title: `${levelEmoji} Server Boosted!`,
        description: `${boosterName} just boosted the server!`,
        color: 0xFF73FA,
        thumbnail: {
            url: "https://cdn.discordapp.com/emojis/1159626882694783036.png"
        },
        fields: [
            {
                name: "Server Level",
                value: `Level ${boostTier}`,
                inline: true
            },
            {
                name: "Benefits Unlocked",
                value: `${boostTier >= 1 ? "✓ 50 Emoji Slots\n" : ""}${boostTier >= 2 ? "✓ 100 Emoji Slots\n" : ""}${boostTier >= 3 ? "✓ Animated Server Icon\n" : ""}`,
                inline: true
            }
        ],
        footer: {
            text: "Thank you for boosting!"
        },
        timestamp: new Date().toISOString()
    };
}

function createClydeEmbed(message: string) {
    return {
        type: "rich",
        description: message,
        color: 0x2F3136,
        author: {
            name: "Clyde",
            icon_url: "https://cdn.discordapp.com/embed/avatars/0.png"
        },
        timestamp: new Date().toISOString()
    };
}

function createDiscordSystemEmbed(title: string, message: string, systemType: string = "announcement") {
    const color = {
        announcement: 0x5865F2,
        warning: 0xFEE75C,
        update: 0x57F287,
        maintenance: 0xED4245
    }[systemType] || 0x5865F2;
    
    return {
        type: "rich",
        title: title,
        description: message,
        color: color,
        author: {
            name: "Discord",
            icon_url: "https://cdn.discordapp.com/emojis/1159627219011190824.png"
        },
        footer: {
            text: "System Message"
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
            text: "Discord AutoMod"
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
            text: "Discord Shop"
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

function createNitroComponents() {
    return [
        {
            type: 1,
            components: [
                {
                    type: 2,
                    style: 3,
                    label: "Accept",
                    custom_id: "accept_nitro_gift"
                }
            ]
        }
    ];
}

function createClydeComponents() {
    return [
        {
            type: 1,
            components: [
                {
                    type: 2,
                    style: 2,
                    label: "Dismiss message",
                    custom_id: "clyde_dismiss",
                    emoji: {
                        name: "👀",
                        id: "1159627544426946560"
                    }
                }
            ]
        }
    ];
}

export default definePlugin({
    name: "SpoofSystemV2",
    description: "Spoof official Discord system messages with realistic embeds",
    authors: [Devs.Ven],
    dependencies: ["CommandsAPI"],

    commands: [
        {
            name: "spoofnitro",
            description: "Spoof an official Discord Nitro gift notification",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    type: ApplicationCommandOptionType.USER,
                    name: "gifter",
                    description: "User who sent the gift",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.CHANNEL,
                    name: "channel",
                    description: "Channel to send in (defaults to current)",
                    required: false
                }
            ],
            execute: async (args, ctx) => {
                try {
                    const channelId = args.find(x => x.name === "channel")?.value ?? ctx.channel.id;
                    const gifterId = args.find(x => x.name === "gifter")?.value as string;
                    
                    const embed = createOfficialNitroGiftEmbed(gifterId);
                    
                    dispatchMessage(channelId, {
                        type: MessageType.DEFAULT,
                        author: {
                            id: DISCORD_SYSTEM_USER_ID,
                            username: "Discord",
                            avatar: "f78426a064bc9dd24847519259bc42af",
                            discriminator: "0000",
                            public_flags: 1 << 17, // Official Discord System
                            bot: false,
                            flags: 0
                        },
                        content: "",
                        embeds: [embed],
                        components: createNitroComponents()
                    });
                    
                    sendBotMessage(ctx.channel.id, {
                        content: "✅ Nitro gift spoofed!",
                        ephemeral: true
                    });
                } catch (error) {
                    console.error("Nitro spoof error:", error);
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
                        { name: "Tier 1", value: 1 },
                        { name: "Tier 2", value: 2 },
                        { name: "Tier 3", value: 3 }
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
                    const boostTier = args.find(x => x.name === "tier")?.value as number || 1;
                    const anonymous = args.find(x => x.name === "anonymous")?.value as boolean || false;
                    
                    const embed = createServerBoostEmbed(boostTier, anonymous ? undefined : boosterId);
                    
                    // For server boosts, the message should appear as if from the booster
                    const booster = UserStore.getUser(boosterId);
                    
                    dispatchMessage(channelId, {
                        type: MessageType.GUILD_BOOST,
                        author: {
                            id: DISCORD_SYSTEM_USER_ID,
                            username: "Discord",
                            avatar: "f78426a064bc9dd24847519259bc42af",
                            discriminator: "0000",
                            public_flags: 1 << 17,
                            bot: false,
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
                    console.error("Boost spoof error:", error);
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
                }
            ],
            execute: async (args, ctx) => {
                try {
                    const channelId = args.find(x => x.name === "channel")?.value ?? ctx.channel.id;
                    const message = args.find(x => x.name === "message")?.value as string;
                    
                    const embed = createClydeEmbed(message);
                    
                    dispatchMessage(channelId, {
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
                        embeds: [embed],
                        components: createClydeComponents()
                    });
                    
                    sendBotMessage(ctx.channel.id, {
                        content: "✅ Clyde message spoofed!",
                        ephemeral: true
                    });
                } catch (error) {
                    console.error("Clyde spoof error:", error);
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
                }
            ],
            execute: async (args, ctx) => {
                try {
                    const channelId = args.find(x => x.name === "channel")?.value ?? ctx.channel.id;
                    const userId = args.find(x => x.name === "user")?.value as string;
                    
                    const user = UserStore.getUser(userId);
                    const username = user ? `<@${user.id}>` : "Unknown User";
                    
                    dispatchMessage(channelId, {
                        type: MessageType.USER_JOIN,
                        author: {
                            id: DISCORD_SYSTEM_USER_ID,
                            username: "Discord",
                            avatar: "f78426a064bc9dd24847519259bc42af",
                            discriminator: "0000",
                            public_flags: 1 << 17,
                            bot: false,
                            flags: 0
                        },
                        content: `🎉 Welcome ${username} to the server! 🎉`
                    });
                    
                    sendBotMessage(ctx.channel.id, {
                        content: "✅ Join notification spoofed!",
                        ephemeral: true
                    });
                } catch (error) {
                    console.error("Join spoof error:", error);
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
                }
            ],
            execute: async (args, ctx) => {
                try {
                    const channelId = args.find(x => x.name === "channel")?.value ?? ctx.channel.id;
                    const userId = args.find(x => x.name === "user")?.value as string;
                    
                    const user = UserStore.getUser(userId);
                    const username = user ? `<@${user.id}>` : "Someone";
                    
                    dispatchMessage(channelId, {
                        type: MessageType.CHANNEL_PINNED_MESSAGE,
                        author: {
                            id: DISCORD_SYSTEM_USER_ID,
                            username: "Discord",
                            avatar: "f78426a064bc9dd24847519259bc42af",
                            discriminator: "0000",
                            public_flags: 1 << 17,
                            bot: false,
                            flags: 0
                        },
                        content: `${username} pinned a message to this channel. See all the pins.`
                    });
                    
                    sendBotMessage(ctx.channel.id, {
                        content: "✅ Pin notification spoofed!",
                        ephemeral: true
                    });
                } catch (error) {
                    console.error("Pin spoof error:", error);
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
                        { name: "Start Call", value: "start" },
                        { name: "End Call", value: "end" }
                    ]
                }
            ],
            execute: async (args, ctx) => {
                try {
                    const channelId = args.find(x => x.name === "channel")?.value ?? ctx.channel.id;
                    const userId = args.find(x => x.name === "user")?.value as string;
                    const action = args.find(x => x.name === "action")?.value as string;
                    
                    const user = UserStore.getUser(userId);
                    const username = user ? `<@${user.id}>` : "Someone";
                    
                    const content = action === "start" 
                        ? `${username} started a call.`
                        : `${username} ended the call.`;
                    
                    dispatchMessage(channelId, {
                        type: MessageType.CALL,
                        author: {
                            id: DISCORD_SYSTEM_USER_ID,
                            username: "Discord",
                            avatar: "f78426a064bc9dd24847519259bc42af",
                            discriminator: "0000",
                            public_flags: 1 << 17,
                            bot: false,
                            flags: 0
                        },
                        content: content
                    });
                    
                    sendBotMessage(ctx.channel.id, {
                        content: "✅ Call notification spoofed!",
                        ephemeral: true
                    });
                } catch (error) {
                    console.error("Call spoof error:", error);
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
                    name: "message",
                    description: "System message content",
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
                    const message = args.find(x => x.name === "message")?.value as string;
                    
                    dispatchMessage(channelId, {
                        type: MessageType.DEFAULT,
                        author: {
                            id: DISCORD_SYSTEM_USER_ID,
                            username: "Discord",
                            avatar: "f78426a064bc9dd24847519259bc42af",
                            discriminator: "0000",
                            public_flags: 1 << 17,
                            bot: false,
                            flags: 0
                        },
                        content: message
                    });
                    
                    sendBotMessage(ctx.channel.id, {
                        content: "✅ System message spoofed!",
                        ephemeral: true
                    });
                } catch (error) {
                    console.error("System spoof error:", error);
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
                    
                    const embed = createPurchaseNotificationEmbed(item, price, user ? `<@${user.id}>` : undefined);
                    
                    dispatchMessage(channelId, {
                        type: MessageType.PURCHASE_NOTIFICATION,
                        author: {
                            id: DISCORD_SYSTEM_USER_ID,
                            username: "Discord Shop",
                            avatar: "f78426a064bc9dd24847519259bc42af",
                            discriminator: "0000",
                            public_flags: 1 << 17,
                            bot: false,
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
                    console.error("Purchase spoof error:", error);
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
                        { name: "Block Message", value: "block" },
                        { name: "Send Alert", value: "alert" },
                        { name: "Timeout User", value: "timeout" }
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
                    
                    const embed = createAutoModEmbed(rule, actionText, user ? `<@${user.id}>` : undefined);
                    
                    dispatchMessage(channelId, {
                        type: MessageType.AUTO_MODERATION_ACTION,
                        author: {
                            id: DISCORD_SYSTEM_USER_ID,
                            username: "Discord AutoMod",
                            avatar: "f78426a064bc9dd24847519259bc42af",
                            discriminator: "0000",
                            public_flags: 1 << 17,
                            bot: false,
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
                    console.error("AutoMod spoof error:", error);
                    sendBotMessage(ctx.channel.id, {
                        content: `❌ Error: ${error}`,
                        ephemeral: true
                    });
                }
            }
        }
    ],

    start() {
        console.log("SpoofSystemV2 started");
    },

    stop() {
        console.log("SpoofSystemV2 stopped");
    }
});