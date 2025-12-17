/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addProfileBadge, BadgePosition, ProfileBadge, removeProfileBadge } from "@api/Badges";
import { addMemberListDecorator, removeMemberListDecorator } from "@api/MemberListDecorators";
import { addMessageDecoration, removeMessageDecoration } from "@api/MessageDecorations";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Devs, EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { User } from "@vencord/discord-types";
import { SnowflakeUtils, Tooltip, UserStore } from "@webpack/common";



const getTimeDiff = (now: Date, user: Date) => {
    // Get days since creation
    return Math.floor(((now.getTime() - user.getTime()) / 1000) / 86400);
};

const checkUser = (user: User, indType: string) => {
    if (!user || user.bot) return null;
    const currentDate = new Date();
    const userCreatedDate = new Date(SnowflakeUtils.extractTimestamp(user.id));
    const diff = getTimeDiff(currentDate, userCreatedDate);
    const tooltip = `Account created ${diff} days ago`;
    const enabled = settings.store[indType] as Boolean;

    if (settings.store.days > diff && enabled) {
        return <Tooltip text={tooltip}>
            {(tooltipProps: any) => (
                <span {...tooltipProps} tabIndex={0}>❗</span>
            )}
        </Tooltip>;
    }
    return null;
};

const badge: ProfileBadge = {
    component: u => checkUser(UserStore.getUser(u.userId), "badges"),
    position: BadgePosition.START,
    shouldShow: _ => true,
    key: "newuser-indicator"
};


const settings = definePluginSettings({
    badges: {
        description: "Enable on badges.",
        type: OptionType.BOOLEAN,
        default: true,
    },
    decorators: {
        description: "Enable on member list.",
        type: OptionType.BOOLEAN,
        default: true,
    },
    decorations: {
        description: "Enable on messages.",
        type: OptionType.BOOLEAN,
        default: true,
    },
    days: {
        description: "Amount of days to trigger badge.",
        type: OptionType.NUMBER,
        default: 30,
    },
});

export default definePlugin({
    name: "NewUserIndicator",
    description: "Adds a indicator if users account is created recently",
    authors: [Devs.None,, EquicordDevs.x2b],
    patches: [],
    settings,
    start() {
        addProfileBadge(badge);
        addMessageDecoration("newuser-indicator", props =>
            <ErrorBoundary noop>
                {checkUser(props.message.author, "decorations")}
            </ErrorBoundary>
        );
        addMemberListDecorator("newuser-indicator", props =>
            <ErrorBoundary noop>
                {checkUser(props.user, "decorators")}
            </ErrorBoundary>
        );

    },
    stop() {
        removeMessageDecoration("newuser-indicator");
        removeMemberListDecorator("newuser-indicator");
        removeProfileBadge(badge);
    },

});



