/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { LogIcon } from "@components/Icons";
import { getIntlMessage } from "@utils/discord";
import { Guild } from "@vencord/discord-types";
import { findByPropsLazy, findComponentByCodeLazy } from "@webpack";
import { NavigationRouter } from "@webpack/common";

const ChannelRow = findComponentByCodeLazy(".basicChannelRowLink,");
const Routes = findByPropsLazy("INDEX", "FRIENDS", "ME");

export default function AuditLogChannelRow(props: { guild: Guild, selected: boolean; }) {
    return <ChannelRow
        id={`audit-log-${props.guild.id}`}
        renderIcon={(className: string) => <LogIcon className={className} />}
        text={getIntlMessage("AUDIT_LOG")}
        selected={props.selected}
        showUnread={false}
        onClick={() => {
            NavigationRouter.transitionTo(Routes.CHANNEL(props.guild.id, "audit-log"));
        }}
    />;
}

