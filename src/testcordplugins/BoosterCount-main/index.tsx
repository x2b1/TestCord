/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import ErrorBoundary from "@components/ErrorBoundary";
import { Flex } from "@components/Flex";
import { openUserProfile } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { closeModal, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalRoot, ModalSize, openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import { findByPropsLazy, findComponentByCodeLazy } from "@webpack";
import { FluxDispatcher, GuildMemberStore, Menu, PresenceStore, ScrollerThin, Text, useEffect, UserStore, useStateFromStores } from "@webpack/common";
import { cl } from "plugins/memberCount";

const logger = new Logger("showBoostCounts");
const { getToken } = findByPropsLazy("setToken");
async function openViewBoosters(guild: string) {
    logger.info("Viewing boosters for guild", guild);
    const boosters = await fetchBoosters(getToken(), guild);
    logger.info(boosters);
    const key = openModal(props => (
        <ErrorBoundary>
            <ModalRoot {...props} size={ModalSize.LARGE}>
                <ModalHeader>
                    <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Boosters</Text>
                    <ModalCloseButton onClick={() => closeModal(key)} />
                </ModalHeader>
                <ModalContent>
                    <UserList guildId={guild} boosters={boosters} />
                </ModalContent >
                <ModalFooter>
                    <Flex cellSpacing={10}>
                    </Flex>
                </ModalFooter>
            </ModalRoot >
        </ErrorBoundary >
    ));
}

function MakeContextCallback(): NavContextMenuPatchCallback {
    return (children, props) => {
        const { guild } = props;
        if (!guild) return;

        const lastChild = children.at(-1);
        if (lastChild?.key === "developer-actions") {
            const p = lastChild.props;
            if (!Array.isArray(p.children))
                p.children = [p.children];

            children = p.children;
        }

        children.splice(-1, 0,
            <Menu.MenuItem
                id={"vc-view-boosts"}
                label="View Boosters"
                action={async () => await openViewBoosters(guild.id)}
                icon={BoostIcon}
            />
        );
    };
}

export default definePlugin({
    name: "BoostCounts",
    description: "Shows all the boosters in the server and the number of boosts for each booster.",
    dependencies: ["MessagePopoverAPI"],
    authors: [{
        name: "Raf", id: 121253596753952768n
    }],
    contextMenus: {
        "guild-context": MakeContextCallback()
    }
});

async function fetchBoosters(authorization: string, guildId: string) {
    const response = await fetch(`https://discord.com/api/v9/guilds/${guildId}/premium/subscriptions`, {
        "headers": {
            "accept": "*/*",
            "accept-language": "fr,en-US;q=0.9,hy;q=0.8,ru;q=0.7",
            "authorization": authorization,
            "priority": "u=1, i",
            "sec-ch-ua": "\"Not;A=Brand\";v=\"24\", \"Chromium\";v=\"128\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-debug-options": "bugReporterEnabled",
            "x-discord-locale": "en-GB",
            "x-discord-timezone": "Europe/Paris",
            "x-super-properties": "eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiRGlzY29yZCBDbGllbnQiLCJyZWxlYXNlX2NoYW5uZWwiOiJzdGFibGUiLCJjbGllbnRfdmVyc2lvbiI6IjEuMC45MTY4Iiwib3NfdmVyc2lvbiI6IjEwLjAuMjI2MzEiLCJvc19hcmNoIjoieDY0IiwiYXBwX2FyY2giOiJ4NjQiLCJzeXN0ZW1fbG9jYWxlIjoiZnIiLCJicm93c2VyX3VzZXJfYWdlbnQiOiJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCAxMC4wOyBXaW42NDsgeDY0KSBBcHBsZVdlYktpdC81MzcuMzYgKEtIVE1MLCBsaWtlIEdlY2tvKSBkaXNjb3JkLzEuMC45MTY4IENocm9tZS8xMjguMC42NjEzLjM2IEVsZWN0cm9uLzMyLjAuMCBTYWZhcmkvNTM3LjM2IiwiYnJvd3Nlcl92ZXJzaW9uIjoiMzIuMC4wIiwib3Nfc2RrX3ZlcnNpb24iOiIyMjYzMSIsImNsaWVudF9idWlsZF9udW1iZXIiOjMzOTIyMSwibmF0aXZlX2J1aWxkX251bWJlciI6NTQwMzksImNsaWVudF9ldmVudF9zb3VyY2UiOm51bGx9"
        },
        "body": null,
        "method": "GET",
        "mode": "cors",
        "credentials": "include"
    });

    const boosts = await response.json();
    const boosters = {};
    for (const boost of boosts) {
        if (boost.user.id in boosters)
            boosters[boost.user.id] += 1;
        else
            boosters[boost.user.id] = 1;
    }
    logger.info(boosters);
    return boosters;
}

const FriendRow = findComponentByCodeLazy(".listName,discriminatorClass");


function UserList({ guildId, boosters }: { guildId: string, boosters: any; }) {
    const missing = [] as string[];
    const members = [] as string[];

    for (const id of Object.keys(boosters)) {
        if (GuildMemberStore.isMember(guildId, id))
            members.push(id);
        else
            missing.push(id);
    }

    // Used for side effects (rerender on member request success)
    useStateFromStores(
        [GuildMemberStore],
        () => GuildMemberStore.getMemberIds(guildId),
        null,
        (old, curr) => old.length === curr.length
    );

    useEffect(() => {
        FluxDispatcher.dispatch({
            type: "GUILD_MEMBERS_REQUEST",
            guildIds: [guildId],
            userIds: missing
        });
    }, []);

    return (
        <ScrollerThin fade className={cl("scroller")}>
            {members.map(id =>
                <Flex style={{ alignItems: "center" }}>
                    <Text>{boosters[id]}</Text>
                    <FriendRow
                        user={UserStore.getUser(id)}
                        status={PresenceStore.getStatus(id) || "offline"}
                        onSelect={() => openUserProfile(id)}
                        onContextMenu={() => { }}
                    />
                </Flex>
            )}
        </ScrollerThin >
    );
}

function BoostIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="white" stroke="white" width="18" height="18" viewBox="0 0 24 24" id="level-2-discord-boost">
            <path fill="#000" fill-rule="evenodd" d="M11.68 1.616a.5.5 0 0 1 .64 0l6 5A.5.5 0 0 1 18.5 7v10a.5.5 0 0 1-.18.384l-6 5a.5.5 0 0 1-.64 0l-6-5A.5.5 0 0 1 5.5 17V7a.5.5 0 0 1 .18-.384l6-5ZM6.5 7.234v9.532l5.5 4.583 5.5-4.583V7.234L12 2.651 6.5 7.234Z" clip-rule="evenodd"></path>
            <path fill="#000" fill-rule="evenodd" d="M11.662 5.631a.5.5 0 0 1 .676 0l3 2.75a.5.5 0 0 1 .162.369v6.5a.5.5 0 0 1-.162.369l-3 2.75a.5.5 0 0 1-.676 0l-3-2.75a.5.5 0 0 1-.162-.369v-6.5a.5.5 0 0 1 .162-.369l3-2.75ZM9.5 8.97v6.06l2.5 2.292 2.5-2.292V8.97L12 6.678 9.5 8.97Z" clip-rule="evenodd"></path>
            <path fill="#000" fill-rule="evenodd" d="M12.5 2.5V6h-1V2.5h1ZM6.224 6.553l3 1.5-.448.894-3-1.5.448-.894Zm12 .894-3 1.5-.448-.894 3-1.5.448.894ZM5.776 16.553l3-1.5.448.894-3 1.5-.448-.894Zm12 .894-3-1.5.448-.894 3 1.5-.448.894ZM11.5 21.5V18h1v3.5h-1Z" clip-rule="evenodd"></path>
        </svg>
    );
}
