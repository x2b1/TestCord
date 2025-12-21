/*
 * AutoQuestAccepter – fixed version
 */

import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { RestAPI } from "@webpack/common";
import { TestcordDevs } from "@utils/constants";

import {
    Quest,
    QuestStatus
} from "../../equicordplugins/questify/utils/components";

import {
    fetchAndDispatchQuests,
    getQuestStatus,
    normalizeQuestName,
    reportPlayGameQuestProgress,
    reportVideoQuestProgress
} from "../../equicordplugins/questify/utils/misc";

import { activeQuestIntervals } from "../../equicordplugins/questify/index";

const QuestsStore = findByPropsLazy("getQuest");
const log = new Logger("AutoQuestAccepter");

let acceptInterval: NodeJS.Timeout | null = null;
let completeInterval: NodeJS.Timeout | null = null;

const settings = definePluginSettings({
    autoAccept: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Automatically accept new quests"
    },
    autoComplete: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Automatically complete supported quests"
    },
    autoClaim: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Automatically claim completed quests"
    }
});


// ---------------- ACCEPT ----------------

async function acceptQuest(quest: Quest) {
    const name = normalizeQuestName(quest.config.messages.questName);

    try {
        log.info(`Accepting quest: ${name}`);

        const res = await RestAPI.post({
            url: `/quests/${quest.id}/accept`,
            body: {}
        });

        if (res?.status !== 200 && res?.status !== 204) {
            log.warn(`Accept failed for ${name} (${res?.status})`);
            return;
        }

        await fetchAndDispatchQuests("AutoQuestAccepter", log);
        log.info(`Accepted quest: ${name}`);

    } catch (e) {
        log.error(`Accept error for ${name}`, e);
    }
}

async function autoAccept() {
    if (!settings.store.autoAccept) return;

    const quests = Array.from(QuestsStore.quests.values()) as Quest[];

    for (const q of quests) {
        const status = getQuestStatus(q, false);

        if (
            status === QuestStatus.Unclaimed &&
            !q.userStatus?.enrolledAt &&
            new Date(q.config.expiresAt) > new Date()
        ) {
            await acceptQuest(q);
            await new Promise(r => setTimeout(r, 1500));
        }
    }
}


// ---------------- COMPLETE ----------------

async function startVideoQuest(quest: Quest) {
    if (activeQuestIntervals.has(quest.id)) return;

    const task =
        quest.config.taskConfigV2?.tasks.WATCH_VIDEO ??
        quest.config.taskConfigV2?.tasks.WATCH_VIDEO_ON_MOBILE;

    if (!task) return;

    let progress = quest.userStatus?.progress?.WATCH_VIDEO?.value ?? 0;
    const target = task.target;

    log.info(`Starting video quest: ${normalizeQuestName(quest.config.messages.questName)}`);

    const interval = setInterval(async () => {
        if (progress >= target) {
            clearInterval(interval);
            activeQuestIntervals.delete(quest.id);
            return;
        }

        await reportVideoQuestProgress(quest, progress + 10, log);
        progress += 10;

    }, 10_000);

    activeQuestIntervals.set(quest.id, {
        progressTimeout: interval,
        rerenderTimeout: null as any,
        progress,
        duration: target,
        type: "watch"
    });
}

async function startPlayQuest(quest: Quest) {
    if (activeQuestIntervals.has(quest.id)) return;

    log.info(`Starting play quest: ${normalizeQuestName(quest.config.messages.questName)}`);

    const interval = setInterval(async () => {
        await reportPlayGameQuestProgress(quest, false, log);
    }, 20_000);

    activeQuestIntervals.set(quest.id, {
        progressTimeout: interval,
        rerenderTimeout: null as any,
        progress: 0,
        duration: 0,
        type: "play"
    });
}

async function autoComplete() {
    if (!settings.store.autoComplete) return;

    const quests = Array.from(QuestsStore.quests.values()) as Quest[];

    for (const q of quests) {
        if (
            q.userStatus?.enrolledAt &&
            !q.userStatus?.completedAt &&
            !activeQuestIntervals.has(q.id)
        ) {
            const tasks = q.config.taskConfigV2?.tasks;
            if (!tasks) continue;

            if (tasks.WATCH_VIDEO || tasks.WATCH_VIDEO_ON_MOBILE) {
                await startVideoQuest(q);
            } else if (
                tasks.PLAY_ON_DESKTOP ||
                tasks.PLAY_ACTIVITY
            ) {
                await startPlayQuest(q);
            }
        }
    }
}


// ---------------- CLAIM ----------------

async function autoClaim() {
    if (!settings.store.autoClaim) return;

    const quests = Array.from(QuestsStore.quests.values()) as Quest[];

    for (const q of quests) {
        if (
            q.userStatus?.completedAt &&
            !q.userStatus?.claimedAt &&
            new Date(q.config.expiresAt) > new Date()
        ) {
            const name = normalizeQuestName(q.config.messages.questName);

            try {
                const res = await RestAPI.post({
                    url: `/quests/${q.id}/claim-reward`,
                    body: {}
                });

                if (res?.status === 200 || res?.status === 204) {
                    log.info(`Claimed quest: ${name}`);
                    showNotification({
                        title: "Quest Claimed",
                        body: name,
                        dismissOnClick: true
                    });
                }
            } catch (e) {
                log.error(`Claim failed: ${name}`, e);
            }

            await new Promise(r => setTimeout(r, 1000));
        }
    }
}


// ---------------- PLUGIN ----------------

export default definePlugin({
    name: "AutoQuestAccepter",
    description: "Automatically accepts, completes (where possible), and claims Discord quests",
    authors: [TestcordDevs.x2b],
    settings,

    async start() {
        log.info("Plugin started");

        await fetchAndDispatchQuests("AutoQuestAccepter", log);

        acceptInterval = setInterval(autoAccept, 30_000);
        completeInterval = setInterval(() => {
            autoComplete();
            autoClaim();
        }, 60_000);
    },

    stop() {
        if (acceptInterval) clearInterval(acceptInterval);
        if (completeInterval) clearInterval(completeInterval);
        log.info("Plugin stopped");
    }
});
