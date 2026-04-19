/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { HeaderBarButton } from "@api/HeaderBar";
import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { TestcordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy, findComponentByCodeLazy } from "@webpack";
import { ContextMenuApi, Menu, RestAPI } from "@webpack/common";

import {
    Quest,
    QuestStatus
} from "../../equicordplugins/questify/utils/components";
import {
    fetchAndDispatchQuests,
    getQuestStatus,
    normalizeQuestName
} from "../../equicordplugins/questify/utils/misc";

const QuestsStore = findByPropsLazy("getQuest");
const QuestIcon = findComponentByCodeLazy("10.47a.76.76");
const log = new Logger("AutoQuestAccepter");

let claimInterval: NodeJS.Timeout | null = null;
let isClaiming = false;

const settings = definePluginSettings({
    autoAccept: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Automatically accept new quests on startup"
    },
    autoClaim: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Automatically claim completed quests one by one (waits for captcha)"
    }
});

// ---------------- ACCEPT ----------------

async function acceptQuest(quest: Quest) {
    const name = normalizeQuestName(quest.config.messages.questName);

    try {
        log.info(`Accepting quest: ${name}`);

        // Discord's enroll API requires a location field
        const res = await RestAPI.post({
            url: `/quests/${quest.id}/enroll`,
            body: {
                location: "QUEST_HOME"
            }
        });

        if (res?.status === 200 || res?.status === 204) {
            log.info(`Accepted quest: ${name}`);
            return;
        }

        log.warn(`Accept failed for ${name} (${res?.status}):`, JSON.stringify(res?.body));

    } catch (e) {
        log.error(`Accept error for ${name}`, e);
    }
}

async function autoAccept() {
    if (!settings.store.autoAccept) return;

    const quests = Array.from(QuestsStore.quests.values()) as Quest[];

    for (const quest of quests) {
        const status = getQuestStatus(quest, false);

        if (
            status === QuestStatus.Unclaimed &&
            !quest.userStatus?.enrolledAt &&
            new Date(quest.config.expiresAt) > new Date()
        ) {
            await acceptQuest(quest);
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    await fetchAndDispatchQuests("AutoQuestAccepter", log);
}

// ---------------- CLAIM ----------------

async function claimQuest(quest: Quest): Promise<boolean> {
    const name = normalizeQuestName(quest.config.messages.questName);

    try {
        const res = await RestAPI.put({
            url: `/quests/${quest.id}/claim-reward`,
            body: {}
        });

        if (res?.status === 200 || res?.status === 204) {
            log.info(`Claimed quest: ${name}`);
            showNotification({
                title: "Quest Claimed",
                body: name,
                dismissOnClick: true
            });
            return true;
        } else {
            log.warn(`Claim failed for ${name} (${res?.status})`);
            return false;
        }
    } catch (e) {
        log.error(`Claim error for ${name}`, e);
        return false;
    }
}

async function autoClaim() {
    if (!settings.store.autoClaim || isClaiming) return;

    isClaiming = true;

    try {
        const quests = Array.from(QuestsStore.quests.values()) as Quest[];

        for (const quest of quests) {
            if (
                quest.userStatus?.completedAt &&
                !quest.userStatus?.claimedAt &&
                new Date(quest.config.expiresAt) > new Date()
            ) {
                const success = await claimQuest(quest);

                if (success) {
                    // Wait for user to complete captcha before claiming next
                    await new Promise(r => setTimeout(r, 5000));

                    // Refresh quests to check if captcha was completed
                    await fetchAndDispatchQuests("AutoQuestAccepter", log);

                    // Break after one claim, let interval handle the rest
                    break;
                }
            }
        }
    } finally {
        isClaiming = false;
    }
}

// ---------------- MANUAL BUTTONS ----------------

async function acceptAllQuests(): Promise<void> {
    try {
        log.info("Accepting all available quests");

        const wasAutoAcceptEnabled = settings.store.autoAccept;
        settings.store.autoAccept = false;

        const quests = Array.from(QuestsStore.quests.values()) as Quest[];
        let totalAccepted = 0;

        for (const quest of quests) {
            const status = getQuestStatus(quest, false);

            if (
                status === QuestStatus.Unclaimed &&
                !quest.userStatus?.enrolledAt &&
                new Date(quest.config.expiresAt) > new Date()
            ) {
                await acceptQuest(quest);
                totalAccepted++;
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        await fetchAndDispatchQuests("AutoQuestAccepter - Manual Accept", log);
        settings.store.autoAccept = wasAutoAcceptEnabled;

        log.info(`Accepted ${totalAccepted} quests`);
    } catch (error) {
        log.error("Error accepting quests:", error);
        settings.store.autoAccept = true;
    }
}

async function claimAllQuests(): Promise<void> {
    try {
        log.info("Claiming all completed quests");

        const wasAutoClaimEnabled = settings.store.autoClaim;
        settings.store.autoClaim = false;

        const quests = Array.from(QuestsStore.quests.values()) as Quest[];
        let totalClaimed = 0;

        for (const quest of quests) {
            if (
                quest.userStatus?.completedAt &&
                !quest.userStatus?.claimedAt &&
                new Date(quest.config.expiresAt) > new Date()
            ) {
                const success = await claimQuest(quest);

                if (success) {
                    totalClaimed++;
                    await new Promise(r => setTimeout(r, 5000)); // Wait for captcha
                    await fetchAndDispatchQuests("AutoQuestAccepter - Manual Claim", log);
                }
            }
        }

        settings.store.autoClaim = wasAutoClaimEnabled;
        log.info(`Claimed ${totalClaimed} quests`);
    } catch (error) {
        log.error("Error claiming quests:", error);
        settings.store.autoClaim = true;
    }
}

function QuestButton() {
    function handleClick(event: React.MouseEvent<Element>) {
        if (event.type === "mousedown" && event.button !== 2) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        ContextMenuApi.openContextMenu(event, () => (
            <Menu.Menu
                navId="auto-quest-button-context-menu"
                onClose={ContextMenuApi.closeContextMenu}
                aria-label="Auto Quest Button Menu"
            >
                <Menu.MenuItem
                    id="accept-all-quests-option"
                    label="Accept All Quests"
                    action={acceptAllQuests}
                />
                <Menu.MenuItem
                    id="claim-all-quests-option"
                    label="Claim All Quests"
                    action={claimAllQuests}
                />
            </Menu.Menu>
        ));
    }

    return (
        <HeaderBarButton
            tooltip="Auto Quest Actions"
            position="bottom"
            className="vc-auto-quest-button"
            icon={QuestIcon}
            onClick={handleClick}
            onContextMenu={handleClick}
        />
    );
}

// ---------------- PLUGIN ----------------

export default definePlugin({
    name: "AutoQuestAccepter",
    description: "Auto-accepts quests, then auto-claims them one by one after completion (captcha handled manually). Uses questify for completion.",
    tags: ["Utility", "Servers"],
    authors: [TestcordDevs.x2b],
    settings,

    headerBarButton: {
        icon: QuestIcon,
        render: QuestButton
    },

    async start() {
        log.info("Plugin started");

        await fetchAndDispatchQuests("AutoQuestAccepter", log);

        // Auto-accept on start
        autoAccept();

        // Auto-claim interval (one at a time)
        claimInterval = setInterval(autoClaim, 10_000);
    },

    stop() {
        if (claimInterval) clearInterval(claimInterval);
        isClaiming = false;
        log.info("Plugin stopped");
    }
});
