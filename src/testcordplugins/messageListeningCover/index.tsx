/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 nin0
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { ActivityType } from "@vencord/discord-types/enums";
import { findComponentByCodeLazy } from "@webpack";
import { Popout, PresenceStore, useRef, UserStore, useStateFromStores } from "@webpack/common";

const ActivityCard = findComponentByCodeLazy(".USER_PROFILE_LIVE_ACTIVITY_CARD),{themeType:");

export default definePlugin({
    name: "MessageListeningCover",
    description: "Shows listened-to album covers next to messages",
    authors: [Devs.nin0dev],
    renderMessageDecoration: props => {
        const ract = useStateFromStores([PresenceStore], () => PresenceStore.getActivities(props.message.author.id));
        const activities = ract.filter(a => [ActivityType.LISTENING].includes(a.type));

        const ref = useRef(null);
        return <Popout
            position="top"
            renderPopout={() => <div style={{
                width: 267,
                height: 110
            }}>
                <ActivityCard activity={activities[0]} currentUser={UserStore.getCurrentUser()} user={props.message.author} />
            </div>}
            targetElementRef={ref}
        >
            {popoutProps => activities.length > 0 && <div ref={ref} style={{
                width: 20,
                height: 20
            }} {...popoutProps}>
                {
                    (() => {
                        const activity = activities[0];
                        if (!activity.assets?.large_image) return null;
                        const largeImage = activity.assets.large_image;

                        const url = largeImage.startsWith("spotify:")
                            ? largeImage.replace("spotify:", "https://i.scdn.co/image/")
                            : largeImage.replace("mp:", "https://media.discordapp.net/");
                        return <img src={url} style={{
                            width: 20,
                            height: 20,
                            borderRadius: 3
                        }} />;
                    })()
                }
            </div>
            }
        </Popout>;
    }
});
