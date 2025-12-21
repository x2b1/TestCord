/*
 * AutoQuestAccepter – fixed version
 */

import { HeaderBarButton } from "@api/HeaderBar";
import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy, findComponentByCodeLazy } from "@webpack";
import { ContextMenuApi, Menu, RestAPI } from "@webpack/common";
import { TestcordDevs } from "@utils/constants";

import {
    Quest,
    QuestStatus
} from "../../equicordplugins/questify/utils/components";

import {
    fetchAndDispatchQuests,
    getQuestStatus,
    normalizeQuestName,
    reportVideoQuestProgress,
    reportPlayGameQuestProgress
} from "../../equicordplugins/questify/utils/misc";

const QuestsStore = findByPropsLazy("getQuest");
const QuestIcon = findComponentByCodeLazy("10.47a.76.76");
const log = new Logger("AutoQuestAccepter");

let acceptInterval: NodeJS.Timeout | null = null;
let completeInterval: NodeJS.Timeout | null = null;
let completionTimeouts: Map<string, NodeJS.Timeout> = new Map();

const settings = definePluginSettings({
    autoAccept: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Automatically accept new quests"
    },
    autoComplete: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Automatically complete quests (video, activity)"
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
            url: `/quests/${quest.id}/enroll`,
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
            await new Promise(r => setTimeout(r, 2000));
            await new Promise(r => setTimeout(r, 3000)); // Additional delay between quests
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
                const res = await RestAPI.put({
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

// ---------------- COMPLETE ----------------

async function completeQuest(quest: Quest) {
    const name = normalizeQuestName(quest.config.messages.questName);
    const questId = quest.id;

    // Skip if already being completed
    if (completionTimeouts.has(questId)) {
        log.debug(`Quest ${name} is already being completed`);
        return;
    }

    // Determine quest type
    const taskName = ["WATCH_VIDEO", "PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP", "PLAY_ACTIVITY", "WATCH_VIDEO_ON_MOBILE", "ACHIEVEMENT_IN_ACTIVITY"].find(x => quest.config.taskConfigV2?.tasks[x] != null);

    if (!taskName) {
        log.debug(`Unknown quest type for ${name}, skipping auto completion`);
        return;
    }

    const secondsNeeded = quest.config.taskConfigV2.tasks[taskName].target;
    const currentProgress = quest.userStatus?.progress?.[taskName]?.value ?? 0;

    if (currentProgress >= secondsNeeded) {
        log.debug(`Quest ${name} is already completed (${currentProgress}/${secondsNeeded})`);
        return;
    }

    log.info(`Starting auto completion for ${name} (${taskName})`);

    if (taskName === "WATCH_VIDEO" || taskName === "WATCH_VIDEO_ON_MOBILE") {
        // Video quest completion
        const timeout = setTimeout(async () => {
            try {
                const success = await reportVideoQuestProgress(quest, secondsNeeded, log);
                if (success) {
                    log.info(`Successfully completed video quest: ${name}`);
                } else {
                    log.warn(`Failed to complete video quest: ${name}`);
                }
            } catch (error) {
                log.error(`Error completing video quest ${name}:`, error);
            } finally {
                completionTimeouts.delete(questId);
            }
        }, 1000); // Start after 1 second

        completionTimeouts.set(questId, timeout);

    } else if (taskName === "PLAY_ACTIVITY") {
        // Activity quest completion
        const timeout = setTimeout(async () => {
            try {
                const result = await reportPlayGameQuestProgress(quest, false, log);
                if (result.progress !== null) {
                    log.info(`Successfully started activity quest completion: ${name}`);
                } else {
                    log.warn(`Failed to start activity quest completion: ${name}`);
                }
            } catch (error) {
                log.error(`Error starting activity quest completion ${name}:`, error);
            } finally {
                completionTimeouts.delete(questId);
            }
        }, 1000); // Start after 1 second

        completionTimeouts.set(questId, timeout);

    } else {
        log.debug(`Quest type ${taskName} not supported for auto completion: ${name}`);
    }
}

async function autoComplete() {
    if (!settings.store.autoComplete) return;

    const quests = Array.from(QuestsStore.quests.values()) as Quest[];

    for (const q of quests) {
        if (
            q.userStatus?.enrolledAt &&
            !q.userStatus?.completedAt &&
            new Date(q.config.expiresAt) > new Date()
        ) {
            await completeQuest(q);
            await new Promise(r => setTimeout(r, 500)); // Small delay between quests
        }
    }
}


// ---------------- MANUAL BUTTONS ----------------

async function acceptAllQuests(): Promise<void> {
    try {
        log.info(`Starting acceptAllQuests - using DOM click simulation with RestAPI fallback`);

        // Temporarily disable auto-accept to avoid conflicts
        const wasAutoAcceptEnabled = settings.store.autoAccept;
        settings.store.autoAccept = false;

        // Wait a bit before starting to ensure page is ready
        await new Promise(resolve => setTimeout(resolve, 3000));

        let totalAccepted = 0;
        let attempts = 0;
        const maxAttempts = 10; // Reduced attempts since we have fallback

        while (attempts < maxAttempts) {
            // Scroll to load more quests if possible
            window.scrollTo(0, document.body.scrollHeight);
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Find all quest accept buttons - more specific selectors
            const acceptButtons = Array.from(document.querySelectorAll('[role="button"], button, [data-testid*="button"], [class*="button"]'))
                .filter(btn => {
                    const button = btn as HTMLElement;
                    const buttonText = button.textContent?.toLowerCase() || '';
                    const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
                    const dataTestId = button.getAttribute('data-testid')?.toLowerCase() || '';
                    const className = (typeof button.className === 'string' ? button.className.toLowerCase() : '') || '';

                    // Check if button is visible and enabled
                    const rect = button.getBoundingClientRect();
                    const isVisible = rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.left >= 0 && rect.top < window.innerHeight;
                    const isEnabled = !button.hasAttribute('disabled') && !button.getAttribute('aria-disabled');

                    // More specific conditions for quest accept buttons
                    const isAcceptButton = (
                        (buttonText.includes('accept') && buttonText.includes('quest')) ||
                        (ariaLabel.includes('accept') && ariaLabel.includes('quest')) ||
                        buttonText.includes('enroll') ||
                        buttonText.includes('start quest') ||
                        dataTestId.includes('accept') ||
                        dataTestId.includes('enroll') ||
                        (className.includes('accept') && className.includes('quest')) ||
                        (className.includes('enroll') && className.includes('quest'))
                    );

                    return isVisible && isEnabled && isAcceptButton;
                }) as HTMLElement[];

            log.info(`Found ${acceptButtons.length} potential accept buttons on attempt ${attempts + 1}`);

            if (acceptButtons.length === 0) {
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 4000));
                continue;
            }

            for (const button of acceptButtons) {
                const buttonText = button.textContent?.toLowerCase() || '';
                log.info(`Attempting to accept quest via button: "${buttonText}"`);

                try {
                    // Try DOM click first
                    button.focus();
                    await new Promise(resolve => setTimeout(resolve, 500));

                    button.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                    await new Promise(resolve => setTimeout(resolve, 200));
                    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                    await new Promise(resolve => setTimeout(resolve, 100));
                    button.click();
                    await new Promise(resolve => setTimeout(resolve, 100));
                    button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                    await new Promise(resolve => setTimeout(resolve, 200));
                    button.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

                    log.info(`Successfully clicked accept button for quest`);
                    totalAccepted++;

                    // Wait between clicks
                    const delay = 6000 + Math.random() * 3000; // 6-9 seconds
                    log.info(`Waiting ${Math.round(delay / 1000)}s before next action`);
                    await new Promise(resolve => setTimeout(resolve, delay));

                } catch (clickError) {
                    log.warn(`DOM click failed, attempting RestAPI fallback:`, clickError);

                    // Fallback: Try to find quest ID from nearby elements and use RestAPI
                    const questContainer = button.closest('[data-quest-id], [class*="quest"], [class*="card"]');
                    if (questContainer) {
                        const questId = questContainer.getAttribute('data-quest-id') ||
                            questContainer.getAttribute('data-id') ||
                            questContainer.id;

                        if (questId) {
                            try {
                                const res = await RestAPI.post({
                                    url: `/quests/${questId}/enroll`,
                                    body: {}
                                });

                                if (res?.status === 200 || res?.status === 204) {
                                    log.info(`Accepted quest ${questId} via RestAPI fallback`);
                                    totalAccepted++;
                                } else {
                                    log.warn(`RestAPI fallback failed for quest ${questId}: ${res?.status}`);
                                }
                            } catch (apiError) {
                                log.error(`RestAPI fallback error for quest ${questId}:`, apiError);
                            }
                        }
                    }
                }
            }

            attempts++;
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        // Force refresh quests to update UI
        await fetchAndDispatchQuests("AutoQuestAccepter - Manual Accept", log);

        // Re-enable auto-accept if it was enabled
        settings.store.autoAccept = wasAutoAcceptEnabled;

        log.info(`Finished acceptAllQuests - accepted ${totalAccepted} quests total`);
    } catch (error) {
        log.error(`Error in acceptAllQuests:`, error);
        settings.store.autoAccept = true;
    }
}

async function claimAllQuests(): Promise<void> {
    try {
        log.info(`Starting claimAllQuests - using RestAPI`);

        // Temporarily disable auto-claim to avoid conflicts
        const wasAutoClaimEnabled = settings.store.autoClaim;
        settings.store.autoClaim = false;

        let totalClaimed = 0;

        // Get all available quests
        const quests = Array.from(QuestsStore.quests.values()) as Quest[];

        for (const q of quests) {
            if (
                q.userStatus?.completedAt &&
                !q.userStatus?.claimedAt &&
                new Date(q.config.expiresAt) > new Date()
            ) {
                const name = normalizeQuestName(q.config.messages.questName);

                try {
                    log.info(`Claiming quest: ${name}`);

                    const res = await RestAPI.put({
                        url: `/quests/${q.id}/claim-reward`,
                        body: { signature: "test" }
                    });

                    if (res?.status === 200 || res?.status === 204) {
                        log.info(`Claimed quest: ${name}`);
                        totalClaimed++;
                        showNotification({
                            title: "Quest Claimed",
                            body: name,
                            dismissOnClick: true
                        });
                    } else {
                        log.warn(`Claim failed for ${name} (${res?.status})`);
                    }

                    // Wait between claims
                    await new Promise(r => setTimeout(r, 1000));

                } catch (e) {
                    log.error(`Claim error for ${name}`, e);
                }
            }
        }

        // Force refresh quests to update UI
        await fetchAndDispatchQuests("AutoQuestAccepter - Manual Claim", log);

        // Re-enable auto-claim if it was enabled
        settings.store.autoClaim = wasAutoClaimEnabled;

        log.info(`Finished claimAllQuests - claimed ${totalClaimed} quests total`);
    } catch (error) {
        log.error(`Error in claimAllQuests:`, error);
        settings.store.autoClaim = true;
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


// ---------------- PLUGIN ----------------

export default definePlugin({
    name: "AutoQuestAccepter",
    description: "Automatically accepts, completes (where possible), and claims Discord quests",
    authors: [TestcordDevs.x2b],
    settings,

    headerBarButton: {
        icon: QuestIcon,
        render: QuestButton
    },

    async start() {
        log.info("Plugin started");

        await fetchAndDispatchQuests("AutoQuestAccepter", log);

        acceptInterval = setInterval(autoAccept, 20_000);
        completeInterval = setInterval(() => {
            autoComplete();
            autoClaim();
        }, 60_000);
    },

    stop() {
        if (acceptInterval) clearInterval(acceptInterval);
        if (completeInterval) clearInterval(completeInterval);

        // Clear all completion timeouts
        for (const timeout of completionTimeouts.values()) {
            clearTimeout(timeout);
        }
        completionTimeouts.clear();

        log.info("Plugin stopped");
    }
});
