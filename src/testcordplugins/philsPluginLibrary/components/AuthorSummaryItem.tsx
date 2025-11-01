/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { PluginAuthor } from "@utils/types";
import { useEffect, UserUtils, useState } from "@webpack/common";
import { User } from "discord-types/general";
import React from "react";

import { createDummyUser, types, UserSummaryItem } from "../../philsPluginLibrary";

export interface AuthorUserSummaryItemProps extends Partial<React.ComponentProps<types.UserSummaryItem>> {
    authors: PluginAuthor[];
}

export const AuthorUserSummaryItem = (props: AuthorUserSummaryItemProps) => {
    const [users, setUsers] = useState<Partial<User>[]>([]);

    useEffect(() => {
        (async () => {
            props.authors.forEach(author =>
                UserUtils.getUser(`${author.id}`)
                    .then(user => setUsers(users => [...users, user]))
                    .catch(() => setUsers(users => [...users, createDummyUser({
                        username: author.name,
                        id: `${author.id}`,
                        bot: true,
                    })]))
            );
        })();
    }, []);

    return (
        <UserSummaryItem
            users={users as User[]}
            guildId={undefined}
            renderIcon={false}
            showDefaultAvatarsForNullUsers
            showUserPopout
            {...props}
        />
    );
};
