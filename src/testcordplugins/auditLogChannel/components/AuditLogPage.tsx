/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { LogIcon } from "@components/Icons";
import { findByCodeLazy, findByPropsLazy, findComponentByCodeLazy, findLazy, findStoreLazy } from "@webpack";
import { GuildStore, UserStore, useStateFromStores } from "@webpack/common";

const PageWrapper = findComponentByCodeLazy("forumOrHome]:null");
const mainClasses = findByPropsLazy("chat", "threadSidebarOpen");
const headerClasses = findByPropsLazy("header", "innerHeader", "tabBar");

const { selectFilterPopout } = findByPropsLazy("selectFilterPopout");
const { elevationBorderHigh } = findByPropsLazy("elevationBorderHigh");

const { SearchableQuickSelect } = findByPropsLazy("SearchableQuickSelect");

const AuditLog = findByPropsLazy("vcAuditLogComponent").vcAuditLogComponent;

const GuildSettingsAuditLogStore = findStoreLazy("GuildSettingsAuditLogStore");
const ThemeStore = findStoreLazy("ThemeStore");
const StreamerModeStore = findStoreLazy("StreamerModeStore");

const logsParser = findByCodeLazy("AUTO_MODERATION_ADD_KEYWORDS:case");

const { Title, Icon } = findLazy(m => ["Icon", "Title", "Divider", "Caret"].every(i => Object.prototype.hasOwnProperty.call(m, i)));

export default function AuditLogPage({ guildId }: { guildId: string; }) {
    const guild = useStateFromStores([GuildStore], () => GuildStore.getGuild(guildId));

    const theme = useStateFromStores([ThemeStore], () => ThemeStore.theme);
    const streamerMode = useStateFromStores([StreamerModeStore], () => StreamerModeStore.enabled);
    const logs = useStateFromStores([GuildSettingsAuditLogStore], () => GuildSettingsAuditLogStore.logs);

    return <div className={mainClasses.chat}>
        <PageWrapper
            className={headerClasses.header}
            innerClassName={headerClasses.innerHeader}
            hideSearch={true}
            channelId="audit-log"
            guildId={guildId}
            toolbar={[
            ]}
        >
            <Icon icon={LogIcon} />
            <Title>Audit Log</Title>
        </PageWrapper>
        {/* <AuditLog /> */}
        <AuditLog
            guildId={guildId}
            guild={guild}
            moderators={GuildSettingsAuditLogStore.userIds.map(e => UserStore.getUser(e)).filter(i => i !== null)}
            isInitialLoading={GuildSettingsAuditLogStore.isInitialLoading}
            isLoading={GuildSettingsAuditLogStore.isLoading}
            isLoadingNextPage={GuildSettingsAuditLogStore.isLoadingNextPage}
            showLoadMore={GuildSettingsAuditLogStore.groupedFetchCount > 2}
            hasError={GuildSettingsAuditLogStore.hasError}
            hasOlderLogs={GuildSettingsAuditLogStore.hasOlderLogs}
            logs={logs !== null && guild !== null ? logsParser(logs, guild) : []}
            actionFilter={GuildSettingsAuditLogStore.actionFilter}
            userIdFilter={GuildSettingsAuditLogStore.userIdFilter}
            theme={theme}
            hide={streamerMode}
        />
    </div>;
}
