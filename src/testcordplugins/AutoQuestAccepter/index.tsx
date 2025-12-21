/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { HeaderBarButton } from "@api/HeaderBar";
import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { Devs, TestcordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy, findComponentByCodeLazy } from "@webpack";
import { ContextMenuApi, FluxDispatcher, Menu, RestAPI } from "@webpack/common";

import { Quest, QuestStatus } from "../../equicordplugins/questify/utils/components";
import { fetchAndDispatchQuests, getQuestStatus, normalizeQuestName, refreshQuest, reportPlayGameQuestProgress, reportVideoQuestProgress, waitUntilEnrolled } from "../../equicordplugins/questify/utils/misc";
import { activeQuestIntervals } from "../../equicordplugins/questify/index";

const QuestsStore = findByPropsLazy("getQuest");
const QuestIcon = findComponentByCodeLazy("10.47a.76.76");
const AutoQuestLogger = new Logger("AutoQuestAccepter");

let autoAcceptInterval: NodeJS.Timeout | null = null;
let autoCompleteInterval: NodeJS.Timeout | null = null;

const settings = definePluginSettings({
    autoAcceptEnabled: {
        type: OptionType.BOOLEAN,
        description: "Automatically accept new quests when they become available",
        default: true,
    },
    autoCompleteEnabled: {
        type: OptionType.BOOLEAN,
        description: "Automatically complete accepted quests in the background",
        default: true,
    },
    checkInterval: {
        type: OptionType.NUMBER,
        description: "How often to check for new quests (in seconds)",
        default: 30,
    },
    disableNotifications: {
        type: OptionType.BOOLEAN,
        description: "Disable notifications when quests are auto-accepted or completed",
        default: false,
    },
});

async function acceptQuest(quest: Quest): Promise<boolean> {
    const questName = normalizeQuestName(quest.config.messages.questName);

    try {
        AutoQuestLogger.info(`[${new Date().toLocaleString()}] Making API call to enroll in quest: ${questName} (ID: ${quest.id})`);

        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('API call timeout')), 10000)
        );

        const apiPromise = RestAPI.post({
            url: `/quests/${quest.id}/enroll`,
            body: {}
        });

        const response = await Promise.race([apiPromise, timeoutPromise]) as any;

        AutoQuestLogger.info(`[${new Date().toLocaleString()}] API response for ${questName}: status=${response?.status}, body=`, response?.body);

        if (response?.status === 200 || response?.status === 204) {
            AutoQuestLogger.info(`[${new Date().toLocaleString()}] Successfully accepted quest: ${questName}`);

            if (!settings.store.disableNotifications) {
                showNotification({
                    title: "Quest Auto-Accepted",
                    body: `Accepted quest: ${questName}`,
                    dismissOnClick: true,
                });
            }

            // Trigger quest fetch to update the store
            await fetchAndDispatchQuests("AutoQuestAccepter", AutoQuestLogger);

            // Refresh the quest to ensure userStatus is updated
            quest = refreshQuest(quest);

            // Start completion if auto-complete is enabled and quest is enrolled
            if (settings.store.autoCompleteEnabled && quest.userStatus?.enrolledAt) {
                // Determine quest type and start appropriate completion
                const hasVideoTask = quest.config.taskConfigV2?.tasks.WATCH_VIDEO ||
                    quest.config.taskConfigV2?.tasks.WATCH_VIDEO_ON_MOBILE;
                const hasPlayTask = quest.config.taskConfigV2?.tasks.PLAY_ON_DESKTOP ||
                    quest.config.taskConfigV2?.tasks.PLAY_ON_XBOX ||
                    quest.config.taskConfigV2?.tasks.PLAY_ON_PLAYSTATION ||
                    quest.config.taskConfigV2?.tasks.PLAY_ACTIVITY;

                if (hasVideoTask) {
                    await startVideoQuestCompletion(quest);
                } else if (hasPlayTask) {
                    await startPlayQuestCompletion(quest);
                } else {
                    AutoQuestLogger.warn(`[${new Date().toLocaleString()}] Unsupported quest type for: ${questName}`);
                }
            }

            return true;
        } else {
            AutoQuestLogger.warn(`[${new Date().toLocaleString()}] Unexpected response status for ${questName}: ${response?.status}`);
            return false;
        }
    } catch (error) {
        AutoQuestLogger.error(`[${new Date().toLocaleString()}] Failed to accept quest ${questName}:`, error);
        return false;
    }
}

async function checkAndAcceptQuests(): Promise<void> {
    if (!settings.store.autoAcceptEnabled) return;

    try {
        const quests = Array.from(QuestsStore.quests.values()) as Quest[];

        for (const quest of quests) {
            const questStatus = getQuestStatus(quest, false);

            // Check if quest is available to accept (not claimed, not completed, not expired, not already enrolled)
            if (questStatus === QuestStatus.Unclaimed &&
                !quest.userStatus?.enrolledAt &&
                !quest.userStatus?.completedAt &&
                new Date(quest.config.expiresAt) > new Date()) {

                const accepted = await acceptQuest(quest);
                if (accepted) {
                    // Wait a bit before processing the next quest
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
    } catch (error) {
        AutoQuestLogger.error(`[${new Date().toLocaleString()}] Error in checkAndAcceptQuests:`, error);
    }
}

async function startVideoQuestCompletion(quest: Quest): Promise<void> {
    const questName = normalizeQuestName(quest.config.messages.questName);
    const questDuration = quest.config.taskConfigV2?.tasks.WATCH_VIDEO?.target ||
        quest.config.taskConfigV2?.tasks.WATCH_VIDEO_ON_MOBILE?.target || 0;

    if (!questDuration) {
        AutoQuestLogger.warn(`[${new Date().toLocaleString()}] Could not find duration for video quest: ${questName}`);
        return;
    }

    if (activeQuestIntervals.has(quest.id)) {
        return; // Already being processed
    }

    const enrolledAt = quest.userStatus?.enrolledAt ? new Date(quest.userStatus.enrolledAt) : new Date();
    const initialProgress = Math.floor((Date.now() - enrolledAt.getTime()) / 1000) || 1;

    let currentProgress = initialProgress;
    const reportEverySec = 10;

    const progressInterval = setInterval(async () => {
        try {
            if (currentProgress >= questDuration) {
                clearInterval(progressInterval);
                activeQuestIntervals.delete(quest.id);

                const success = await reportVideoQuestProgress(quest, questDuration, AutoQuestLogger);
                if (success) {
                    AutoQuestLogger.info(`[${new Date().toLocaleString()}] Quest ${questName} completed.`);

                    if (!settings.store.disableNotifications) {
                        showNotification({
                            title: "Quest Auto-Completed!",
                            body: `The ${questName} Quest has completed.`,
                            dismissOnClick: true,
                        });
                    }
                }
                return;
            }

            await reportVideoQuestProgress(quest, currentProgress, AutoQuestLogger);
            currentProgress += reportEverySec;
        } catch (error) {
            AutoQuestLogger.error(`[${new Date().toLocaleString()}] Error reporting progress for ${questName}:`, error);
            clearInterval(progressInterval);
            activeQuestIntervals.delete(quest.id);
        }
    }, reportEverySec * 1000);

    activeQuestIntervals.set(quest.id, {
        progressTimeout: progressInterval,
        rerenderTimeout: null as any,
        progress: initialProgress,
        duration: questDuration,
        type: "watch"
    });

    AutoQuestLogger.info(`[${new Date().toLocaleString()}] Started auto-completion for video quest: ${questName} (${questDuration}s)`);
}

async function startPlayQuestCompletion(quest: Quest): Promise<void> {
    const questName = normalizeQuestName(quest.config.messages.questName);
    const playType = quest.config.taskConfigV2?.tasks.PLAY_ON_DESKTOP ||
        quest.config.taskConfigV2?.tasks.PLAY_ON_XBOX ||
        quest.config.taskConfigV2?.tasks.PLAY_ON_PLAYSTATION ||
        quest.config.taskConfigV2?.tasks.PLAY_ACTIVITY;

    if (!playType) {
        AutoQuestLogger.warn(`[${new Date().toLocaleString()}] Could not find play type for quest: ${questName}`);
        return;
    }

    const questDuration = playType.target;
    if (!questDuration) {
        AutoQuestLogger.warn(`[${new Date().toLocaleString()}] Could not find duration for play quest: ${questName}`);
        return;
    }

    if (activeQuestIntervals.has(quest.id)) {
        return; // Already being processed
    }

    const initialProgress = quest.userStatus?.progress?.[playType.type]?.value || 0;
    let currentProgress = initialProgress;
    const heartbeatInterval = 20; // Heartbeats every 20 seconds

    const progressInterval = setInterval(async () => {
        try {
            const result = await reportPlayGameQuestProgress(quest, false, AutoQuestLogger, { attempts: 3, delay: 2500 });

            if (result.progress === null) {
                clearInterval(progressInterval);
                activeQuestIntervals.delete(quest.id);
                AutoQuestLogger.error(`[${new Date().toLocaleString()}] Failed to send heartbeat for ${questName}`);
                return;
            }

            currentProgress = result.progress;

            if (currentProgress >= questDuration) {
                clearInterval(progressInterval);
                activeQuestIntervals.delete(quest.id);

                const success = await reportPlayGameQuestProgress(quest, true, AutoQuestLogger, { attempts: 3, delay: 2500 });
                if (success) {
                    AutoQuestLogger.info(`[${new Date().toLocaleString()}] Quest ${questName} completed.`);

                    if (!settings.store.disableNotifications) {
                        showNotification({
                            title: "Quest Auto-Completed!",
                            body: `The ${questName} Quest has completed.`,
                            dismissOnClick: true,
                        });
                    }
                }
                return;
            }
        } catch (error) {
            AutoQuestLogger.error(`[${new Date().toLocaleString()}] Error in heartbeat for ${questName}:`, error);
            clearInterval(progressInterval);
            activeQuestIntervals.delete(quest.id);
        }
    }, heartbeatInterval * 1000);

    activeQuestIntervals.set(quest.id, {
        progressTimeout: progressInterval,
        rerenderTimeout: null as any,
        progress: initialProgress,
        duration: questDuration,
        type: "play"
    });

    AutoQuestLogger.info(`[${new Date().toLocaleString()}] Started auto-completion for play quest: ${questName} (${questDuration}s)`);
}

async function checkAndCompleteQuests(): Promise<void> {
    if (!settings.store.autoCompleteEnabled) return;

    try {
        const quests = Array.from(QuestsStore.quests.values()) as Quest[];

        for (const quest of quests) {
            // Check if quest is enrolled but not completed
            if (quest.userStatus?.enrolledAt &&
                !quest.userStatus?.completedAt &&
                new Date(quest.config.expiresAt) > new Date() &&
                !activeQuestIntervals.has(quest.id)) {

                // Determine quest type and start appropriate completion
                const hasVideoTask = quest.config.taskConfigV2?.tasks.WATCH_VIDEO ||
                    quest.config.taskConfigV2?.tasks.WATCH_VIDEO_ON_MOBILE;
                const hasPlayTask = quest.config.taskConfigV2?.tasks.PLAY_ON_DESKTOP ||
                    quest.config.taskConfigV2?.tasks.PLAY_ON_XBOX ||
                    quest.config.taskConfigV2?.tasks.PLAY_ON_PLAYSTATION ||
                    quest.config.taskConfigV2?.tasks.PLAY_ACTIVITY;

                if (hasVideoTask) {
                    await startVideoQuestCompletion(quest);
                } else if (hasPlayTask) {
                    await startPlayQuestCompletion(quest);
                } else {
                    AutoQuestLogger.warn(`[${new Date().toLocaleString()}] Unsupported quest type for: ${normalizeQuestName(quest.config.messages.questName)}`);
                }

                // Small delay between processing quests
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    } catch (error) {
        AutoQuestLogger.error(`[${new Date().toLocaleString()}] Error in checkAndCompleteQuests:`, error);
    }
}

function startAutoAccepting(): void {
    if (autoAcceptInterval) return;

    const intervalMs = (settings.store.checkInterval || 30) * 1000;

    autoAcceptInterval = setInterval(() => {
        checkAndAcceptQuests();
    }, intervalMs);

    AutoQuestLogger.info(`[${new Date().toLocaleString()}] Started auto-accepting quests (checking every ${settings.store.checkInterval}s)`);
}

function stopAutoAccepting(): void {
    if (autoAcceptInterval) {
        clearInterval(autoAcceptInterval);
        autoAcceptInterval = null;
        AutoQuestLogger.info(`[${new Date().toLocaleString()}] Stopped auto-accepting quests`);
    }
}

function startAutoCompleting(): void {
    if (autoCompleteInterval) return;

    // Check for completable quests every 60 seconds
    autoCompleteInterval = setInterval(() => {
        checkAndCompleteQuests();
    }, 60000);

    AutoQuestLogger.info(`[${new Date().toLocaleString()}] Started auto-completing quests`);
}

function stopAutoCompleting(): void {
    if (autoCompleteInterval) {
        clearInterval(autoCompleteInterval);
        autoCompleteInterval = null;
        AutoQuestLogger.info(`[${new Date().toLocaleString()}] Stopped auto-completing quests`);
    }
}

async function acceptAllQuests(): Promise<void> {
    try {
        const quests = Array.from(QuestsStore.quests.values()) as Quest[];
        AutoQuestLogger.info(`[${new Date().toLocaleString()}] Starting acceptAllQuests with ${quests.length} quests`);

        for (const quest of quests) {
            const questStatus = getQuestStatus(quest, false);
            const questName = normalizeQuestName(quest.config.messages.questName);

            AutoQuestLogger.info(`[${new Date().toLocaleString()}] Checking quest: ${questName}, status: ${questStatus}, enrolled: ${!!quest.userStatus?.enrolledAt}, completed: ${!!quest.userStatus?.completedAt}, expired: ${new Date(quest.config.expiresAt) <= new Date()}`);

            // Check if quest is available to accept (not claimed, not completed, not expired, not already enrolled)
            if (questStatus === QuestStatus.Unclaimed &&
                !quest.userStatus?.enrolledAt &&
                !quest.userStatus?.completedAt &&
                new Date(quest.config.expiresAt) > new Date()) {

                AutoQuestLogger.info(`[${new Date().toLocaleString()}] Accepting quest: ${questName}`);
                const accepted = await acceptQuest(quest);
                if (accepted) {
                    AutoQuestLogger.info(`[${new Date().toLocaleString()}] Successfully accepted quest: ${questName}`);
                    // Wait 1000ms before processing the next quest
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    AutoQuestLogger.warn(`[${new Date().toLocaleString()}] Failed to accept quest: ${questName}`);
                }
            } else {
                AutoQuestLogger.info(`[${new Date().toLocaleString()}] Skipping quest: ${questName} - not eligible`);
            }
        }
        AutoQuestLogger.info(`[${new Date().toLocaleString()}] Finished acceptAllQuests`);
    } catch (error) {
        AutoQuestLogger.error(`[${new Date().toLocaleString()}] Error in acceptAllQuests:`, error);
    }
}

async function claimAllQuests(): Promise<void> {
    try {
        const quests = Array.from(QuestsStore.quests.values()) as Quest[];

        for (const quest of quests) {
            const questStatus = getQuestStatus(quest, false);

            // Check if quest is completed and can be claimed
            if (questStatus === QuestStatus.Unclaimed &&
                quest.userStatus?.completedAt &&
                !quest.userStatus?.claimedAt &&
                new Date(quest.config.expiresAt) > new Date()) {

                const questName = normalizeQuestName(quest.config.messages.questName);

                try {
                    const response = await RestAPI.post({
                        url: `/quests/${quest.id}/claim-reward`,
                        body: {}
                    });

                    if (response?.status === 200 || response?.status === 204) {
                        AutoQuestLogger.info(`[${new Date().toLocaleString()}] Successfully claimed quest: ${questName}`);

                        if (!settings.store.disableNotifications) {
                            showNotification({
                                title: "Quest Auto-Claimed",
                                body: `Claimed quest: ${questName}`,
                                dismissOnClick: true,
                            });
                        }

                        // Trigger quest fetch to update the store
                        await fetchAndDispatchQuests("AutoQuestAccepter", AutoQuestLogger);
                    }
                } catch (error) {
                    AutoQuestLogger.error(`[${new Date().toLocaleString()}] Failed to claim quest ${questName}:`, error);
                }

                // Wait 1000ms before processing the next quest
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    } catch (error) {
        AutoQuestLogger.error(`[${new Date().toLocaleString()}] Error in claimAllQuests:`, error);
    }
}

function QuestButton() {
    function handleClick(event: React.MouseEvent<Element>) {
        // ListItem does not support onAuxClick, so we have to listen for mousedown events.
        // Ignore left and right clicks sent via mousedown events to prevent double events.
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



export default definePlugin({
    name: "AutoQuestAccepter",
    description: "Automatically accepts and completes Discord quests in the background using existing quest mechanics",
    authors: [TestcordDevs.x2b],
    settings,

    start() {
        // Initial quest fetch
        fetchAndDispatchQuests("AutoQuestAccepter", AutoQuestLogger);

        // Start auto-accepting if enabled
        if (settings.store.autoAcceptEnabled) {
            startAutoAccepting();
        }

        // Start auto-completing if enabled
        if (settings.store.autoCompleteEnabled) {
            startAutoCompleting();
        }

        AutoQuestLogger.info(`[${new Date().toLocaleString()}] AutoQuestAccepter plugin started`);
    },

    stop() {
        stopAutoAccepting();
        stopAutoCompleting();

        AutoQuestLogger.info(`[${new Date().toLocaleString()}] AutoQuestAccepter plugin stopped`);
    },

    headerBarButton: {
        icon: QuestIcon,
        render: QuestButton
    },

    flux: {
        // Listen for quest updates and check for new quests
        QUESTS_FETCH_CURRENT_QUESTS_SUCCESS() {
            if (settings.store.autoAcceptEnabled) {
                // Small delay to ensure store is updated
                setTimeout(() => checkAndAcceptQuests(), 1000);
            }
        },

        QUESTS_ENROLL_SUCCESS() {
            if (settings.store.autoCompleteEnabled) {
                // Small delay to ensure enrollment is processed
                setTimeout(() => checkAndCompleteQuests(), 2000);
            }
        },

        // Re-check settings when they change
        VEN_SETTINGS_UPDATE(data) {
            if (data.key === "autoAcceptEnabled") {
                if (settings.store.autoAcceptEnabled) {
                    startAutoAccepting();
                } else {
                    stopAutoAccepting();
                }
            }

            if (data.key === "autoCompleteEnabled") {
                if (settings.store.autoCompleteEnabled) {
                    startAutoCompleting();
                } else {
                    stopAutoCompleting();
                }
            }

            if (data.key === "checkInterval" && settings.store.autoAcceptEnabled) {
                stopAutoAccepting();
                startAutoAccepting();
            }
        }
    }
});
