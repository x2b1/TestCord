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
    reportPlayGameQuestProgress,
    reportVideoQuestProgress
} from "../../equicordplugins/questify/utils/misc";

import { activeQuestIntervals } from "../../equicordplugins/questify/index";

const QuestsStore = findByPropsLazy("getQuest");
const QuestIcon = findComponentByCodeLazy("10.47a.76.76");
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


// ---------------- MANUAL BUTTONS ----------------

async function acceptAllQuests(): Promise<void> {
    try {
        log.info(`Starting acceptAllQuests - using DOM click simulation with extended delays`);

        // Temporarily disable auto-accept to avoid conflicts
        const wasAutoAcceptEnabled = settings.store.autoAccept;
        settings.store.autoAccept = false;

        // Wait a bit before starting to ensure page is ready
        await new Promise(resolve => setTimeout(resolve, 3000));

        let totalClicked = 0;
        let attempts = 0;
        const maxAttempts = 15; // Try more times to find all buttons

        while (attempts < maxAttempts) {
            // Scroll to load more quests if possible
            window.scrollTo(0, document.body.scrollHeight);
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Find all quest accept buttons - be more comprehensive
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

                    return isVisible && isEnabled && (
                        (buttonText.includes('accept') && buttonText.includes('quest')) ||
                        (ariaLabel.includes('accept') && ariaLabel.includes('quest')) ||
                        buttonText.includes('enroll') ||
                        buttonText.includes('start quest') ||
                        dataTestId.includes('accept') ||
                        dataTestId.includes('enroll') ||
                        className.includes('accept') ||
                        className.includes('enroll')
                    );
                }) as HTMLElement[];

            log.info(`Found ${acceptButtons.length} potential accept buttons on attempt ${attempts + 1}`);

            if (acceptButtons.length === 0) {
                attempts++;
                // Wait longer between attempts
                await new Promise(resolve => setTimeout(resolve, 4000));
                continue;
            }

            for (const button of acceptButtons) {
                const buttonText = button.textContent?.toLowerCase() || '';
                log.info(`Clicking accept button: "${buttonText}"`);

                // Simulate more realistic click with mouse events
                button.focus();
                await new Promise(resolve => setTimeout(resolve, 800));

                // Dispatch mouse events for more realistic interaction
                button.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                await new Promise(resolve => setTimeout(resolve, 200));
                button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                await new Promise(resolve => setTimeout(resolve, 100));
                button.click();
                await new Promise(resolve => setTimeout(resolve, 100));
                button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                await new Promise(resolve => setTimeout(resolve, 200));
                button.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

                totalClicked++;

                // Wait much longer between clicks to allow full UI updates and avoid rate limiting
                const delay = 8000 + Math.random() * 4000; // 8-12 seconds with randomization
                log.info(`Waiting ${Math.round(delay / 1000)}s before next click`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            // Check if we got all buttons or if we're done
            if (acceptButtons.length === 0) {
                break;
            }

            attempts++;
            // Wait between batches
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        // Re-enable auto-accept if it was enabled
        settings.store.autoAccept = wasAutoAcceptEnabled;

        log.info(`Finished acceptAllQuests - clicked ${totalClicked} accept buttons total`);
    } catch (error) {
        log.error(`Error in acceptAllQuests:`, error);
        // Make sure to re-enable auto-accept on error
        settings.store.autoAccept = true;
    }
}

async function claimAllQuests(): Promise<void> {
    try {
        log.info(`Starting claimAllQuests - using DOM click simulation with extended delays`);

        // Temporarily disable auto-claim to avoid conflicts
        const wasAutoClaimEnabled = settings.store.autoClaim;
        settings.store.autoClaim = false;

        // Wait a bit before starting to ensure page is ready
        await new Promise(resolve => setTimeout(resolve, 3000));

        let totalClicked = 0;
        let attempts = 0;
        const maxAttempts = 15; // Try more times to find all buttons

        while (attempts < maxAttempts) {
            // Scroll to load more quests if possible
            window.scrollTo(0, document.body.scrollHeight);
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Find all quest claim buttons - be more comprehensive
            const claimButtons = Array.from(document.querySelectorAll('[role="button"], button, [data-testid*="button"], [class*="button"]'))
                .filter(btn => {
                    const button = btn as HTMLElement;
                    const buttonText = button.textContent?.toLowerCase() || '';
                    const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
                    const dataTestId = button.getAttribute('data-testid')?.toLowerCase() || '';
                    const className = button.className?.toLowerCase() || '';

                    // Check if button is visible and enabled
                    const rect = button.getBoundingClientRect();
                    const isVisible = rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.left >= 0 && rect.top < window.innerHeight;
                    const isEnabled = !button.hasAttribute('disabled') && !button.getAttribute('aria-disabled');

                    return isVisible && isEnabled && (
                        (buttonText.includes('claim') && buttonText.includes('quest')) ||
                        (ariaLabel.includes('claim') && ariaLabel.includes('quest')) ||
                        buttonText.includes('collect reward') ||
                        buttonText.includes('claim reward') ||
                        dataTestId.includes('claim') ||
                        dataTestId.includes('collect') ||
                        className.includes('claim') ||
                        className.includes('collect')
                    );
                }) as HTMLElement[];

            log.info(`Found ${claimButtons.length} potential claim buttons on attempt ${attempts + 1}`);

            if (claimButtons.length === 0) {
                attempts++;
                // Wait longer between attempts
                await new Promise(resolve => setTimeout(resolve, 4000));
                continue;
            }

            for (const button of claimButtons) {
                const buttonText = button.textContent?.toLowerCase() || '';
                log.info(`Clicking claim button: "${buttonText}"`);

                // Simulate more realistic click with mouse events
                button.focus();
                await new Promise(resolve => setTimeout(resolve, 800));

                // Dispatch mouse events for more realistic interaction
                button.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                await new Promise(resolve => setTimeout(resolve, 200));
                button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                await new Promise(resolve => setTimeout(resolve, 100));
                button.click();
                await new Promise(resolve => setTimeout(resolve, 100));
                button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                await new Promise(resolve => setTimeout(resolve, 200));
                button.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

                totalClicked++;

                // Wait much longer between clicks to allow full UI updates and avoid rate limiting
                const delay = 8000 + Math.random() * 4000; // 8-12 seconds with randomization
                log.info(`Waiting ${Math.round(delay / 1000)}s before next click`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            // Check if we got all buttons or if we're done
            if (claimButtons.length === 0) {
                break;
            }

            attempts++;
            // Wait between batches
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        // Re-enable auto-claim if it was enabled
        settings.store.autoClaim = wasAutoClaimEnabled;

        log.info(`Finished claimAllQuests - clicked ${totalClicked} claim buttons total`);
    } catch (error) {
        log.error(`Error in claimAllQuests:`, error);
        // Make sure to re-enable auto-claim on error
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
