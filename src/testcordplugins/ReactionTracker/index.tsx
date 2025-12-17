import { DataStore } from "@api/index";
import { definePluginSettings } from "@api/Settings";
import { Devs, TestcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { cache } from "@webpack";
import { Button, Constants, Forms, MessageStore, Parser, RestAPI, Toasts, useEffect, UserStore, useState } from "@webpack/common";
import { Message } from "discord-types/general";

const DATA_STORE_KEY = "huskchart";
type Husk = {
    userId: string;
    channelId: string;
    messageId: string;
};
type SortedHusk = {
    id: string;
    count: number;
};
const messageCache = new Map<string, {
    message?: Message;
    fetched: boolean;
}>();

async function getMessage(channelId: string, messageId: string): Promise<Message | undefined> {
    const cached = messageCache.get(messageId);
    if (cached) return cached?.message;

    const storeMessage = MessageStore.getMessage(channelId, messageId);
    if (storeMessage) {
        messageCache.set(storeMessage.id, {
            message: storeMessage,
            fetched: false
        });
        return storeMessage;
    }

    const apiMessage = await RestAPI.get({
        url: Constants.Endpoints.MESSAGES(channelId),
        query: {
            limit: 1,
            around: messageId
        },
        retries: 2
    }).catch(() => null);
    if (apiMessage) {
        messageCache.set(apiMessage.body[0].id, {
            message: apiMessage,
            fetched: true
        });
        return apiMessage.body[0];
    }
}
const UserData = () => {
    const [data, setData] = useState([]);
    const [collapsed, collapse] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            const rawHusks: Husk[] = await DataStore.get(DATA_STORE_KEY) || [];
            const unsortedHuskCountPerUser: SortedHusk[] = [];
            for (const husk of rawHusks) {
                let shouldAddInitialHusk = true;
                for (const [i, hc] of unsortedHuskCountPerUser.entries()) {
                    const unsortedHusker: SortedHusk = hc;
                    if (unsortedHusker.id == husk.userId) {
                        unsortedHuskCountPerUser[i].count++;
                        shouldAddInitialHusk = false;
                    }
                }
                if (!shouldAddInitialHusk) continue;
                unsortedHuskCountPerUser.push({ id: husk.userId, count: 1 });
            }
            const sortedHuskers = unsortedHuskCountPerUser.sort((a, b) => b.count - a.count);
            // @ts-ignore EXPLODEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE
            setData(sortedHuskers);
        };
        fetchData();
    }, []);

    return (
        <>
            <Forms.FormText style={{ fontSize: "1.07rem", fontWeight: "500" }}>User stats {data.length > 6 && <a onClick={() => { collapsed ? collapse(false) : collapse(true); }}>[{collapsed ? "View all" : "Collapse"}]</a>}</Forms.FormText>
            <div style={{ display: "grid", gridTemplateColumns: "auto auto" }}>
                {
                    data.length === 0 && <Forms.FormText style={{ marginTop: "7px" }}>Nothing to see here.</Forms.FormText>
                }
                {
                    data && data.map(user => <>
                        {
                            collapsed && <>
                                {
                                    data.indexOf(user) < 6 &&
                                    <div style={{ marginTop: data.indexOf(user) < 2 ? "0" : "7px" }}>
                                        {/* @ts-ignore */}
                                        {Parser.parse(`<@${user.id}>`)} <Forms.FormText style={{ marginTop: "4px" }}>with {user.count} {user.count > 1 ? "husks" : "husk"}</Forms.FormText>
                                    </div>
                                }
                            </>
                        }
                        {
                            !collapsed && <>
                                {
                                    <div style={{ marginTop: data.indexOf(user) < 2 ? "0" : "7px" }}>
                                        {/* @ts-ignore */}
                                        {Parser.parse(`<@${user.id}>`)} <Forms.FormText style={{ marginTop: "4px" }}>with {user.count} {user.count > 1 ? "husks" : "husk"}</Forms.FormText>
                                    </div>
                                }
                            </>
                        }
                    </>)
                }
            </div>
        </>
    );
};
const ChannelData = () => {
    const [data, setData] = useState([]);
    const [collapsed, collapse] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            const rawHusks: Husk[] = await DataStore.get(DATA_STORE_KEY) || [];
            const unsortedHuskCountPerChannel: SortedHusk[] = [];
            for (const husk of rawHusks) {
                let shouldAddInitialHusk = true;
                for (const [i, hc] of unsortedHuskCountPerChannel.entries()) {
                    const unsortedHusker: SortedHusk = hc;
                    if (unsortedHusker.id == husk.channelId) {
                        unsortedHuskCountPerChannel[i].count++;
                        shouldAddInitialHusk = false;
                    }
                }
                if (!shouldAddInitialHusk) continue;
                unsortedHuskCountPerChannel.push({ id: husk.channelId, count: 1 });
            }
            const sortedHuskers = unsortedHuskCountPerChannel.sort((a, b) => b.count - a.count);
            // @ts-ignore EXPLODEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE
            setData(sortedHuskers);
        };
        fetchData();
    }, []);

    return (
        <>
            <Forms.FormText style={{ fontSize: "1.07rem", fontWeight: "500" }}>Channel stats {data.length > 6 && <a onClick={() => { collapsed ? collapse(false) : collapse(true); }}>[{collapsed ? "View all" : "Collapse"}]</a>}</Forms.FormText>
            <div style={{ display: "grid", gridTemplateColumns: "auto auto" }}>
                {
                    data.length === 0 && <Forms.FormText style={{ marginTop: "7px" }}>Nothing to see here.</Forms.FormText>
                }
                {
                    data && data.map(channel => <>
                        {
                            collapsed && <>
                                {
                                    data.indexOf(channel) < 6 &&
                                    <div style={{ marginTop: data.indexOf(channel) < 2 ? "0" : "7px" }}>
                                        {/* @ts-ignore */}
                                        {Parser.parse(`<#${channel.id}>`)} <Forms.FormText style={{ marginTop: "4px" }}>with {channel.count} {channel.count > 1 ? "husks" : "husk"}</Forms.FormText>
                                    </div>
                                }
                            </>
                        }
                        {
                            !collapsed && <>
                                {
                                    <div style={{ marginTop: data.indexOf(channel) < 2 ? "0" : "7px" }}>
                                        {/* @ts-ignore */}
                                        {Parser.parse(`<#${channel.id}>`)} <Forms.FormText style={{ marginTop: "4px" }}>with {channel.count} {channel.count > 1 ? "husks" : "husk"}</Forms.FormText>
                                    </div>
                                }
                            </>
                        }
                    </>)
                }
            </div>
        </>
    );
};
export default definePlugin({
    name: "ReactionTracker",
    description: "See how much you've been reacted with a specific emoji, and by who",
    authors: [TestcordDevs.x2b],
    flux: {
        async MESSAGE_REACTION_ADD(event) {
            try {
                const msg = await getMessage(event.channelId, event.messageId);
                if (msg!.author.id !== UserStore.getCurrentUser().id) return;
                if (!event.emoji.name.includes("husk")) return;
                let husks: Husk[] = await DataStore.get(DATA_STORE_KEY) || [];
                husks.push({
                    userId: event.userId,
                    channelId: event.channelId,
                    messageId: event.messageId
                });
                DataStore.set(DATA_STORE_KEY, husks);
            }
            catch {
                // explode
            }
        }
    },
    settings: definePluginSettings({
        emojiToTrack: {
            type: OptionType.STRING,
            description: "The emoji to track (type its name, any emoji containing that name will be tracked)",
            default: "husk",
            placeholder: "emojiname (no :)"
        },
        buttons: {
            type: OptionType.COMPONENT,
            description: "stats",
            component: () => (
                <>
                    <UserData />
                    <ChannelData />
                </>
            )
        },
        clearAll: {
            type: OptionType.COMPONENT,
            description: "clear",
            component: () => (
                <Button color={Button.Colors.RED} onClick={() => {
                    DataStore.set(DATA_STORE_KEY, []); Toasts.show({
                        id: Toasts.genId(),
                        message: "Cleared all data, reopen settings to see changes",
                        type: Toasts.Type.SUCCESS,
                        options: {
                            position: Toasts.Position.BOTTOM, // NOBODY LIKES TOASTS AT THE TOP
                        },
                    });
                }}>
                    Clear all data
                </Button>
            )
        }
    })
});





