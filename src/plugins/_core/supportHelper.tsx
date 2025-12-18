/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { existsSync, readdirSync } from "fs";
import { join, parse } from "path";

import { sendBotMessage } from "@api/Commands";
import { isPluginEnabled } from "@api/PluginManager";
import { definePluginSettings, Settings } from "@api/Settings";
import { getUserSettingLazy } from "@api/UserSettings";
import { BaseText } from "@components/BaseText";
import { Card } from "@components/Card";
import ErrorBoundary from "@components/ErrorBoundary";
import { Flex } from "@components/Flex";
import { Link } from "@components/Link";
import { Paragraph } from "@components/Paragraph";
import { openSettingsTabModal, UpdaterTab } from "@components/settings";
import { platformName } from "@equicordplugins/equicordHelper/utils";
import { gitHash, gitHashShort } from "@shared/vencordUserAgent";
import { CONTRIB_ROLE_ID, Devs, DONOR_ROLE_ID, EQUIBOP_CONTRIB_ROLE_ID, EQUICORD_TEAM, GUILD_ID, SUPPORT_CHANNEL_ID, SUPPORT_CHANNEL_IDS, VC_CONTRIB_ROLE_ID, VC_DONOR_ROLE_ID, VC_GUILD_ID, VC_REGULAR_ROLE_ID, VENCORD_CONTRIB_ROLE_ID } from "@utils/constants";
import { sendMessage } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { Margins } from "@utils/margins";
import { isAnyPluginDev, isSupportChannel, isTestCordGuild, tryOrElse } from "@utils/misc";
import { relaunch } from "@utils/native";
import { onlyOnce } from "@utils/onlyOnce";
import { makeCodeblock } from "@utils/text";
import definePlugin from "@utils/types";
import { checkForUpdates, isOutdated, update } from "@utils/updater";
import { Alerts, Button, ChannelStore, GuildMemberStore, Parser, PermissionsBits, PermissionStore, RelationshipStore, SelectedChannelStore, showToast, Toasts, UserStore } from "@webpack/common";
import { JSX } from "react";

import plugins, { PluginMeta } from "~plugins";

import SettingsPlugin from "./settings";

const CodeBlockRe = /```snippet\n(.+?)```/s;

const TrustedRolesIds = [
    VC_CONTRIB_ROLE_ID, // Vencord Contributor
    VC_REGULAR_ROLE_ID, // Vencord Regular
    VC_DONOR_ROLE_ID, // Vencord Donor
    EQUICORD_TEAM, // Equicord Team
    DONOR_ROLE_ID, // Equicord Donor
    CONTRIB_ROLE_ID, // Equicord Contributor
    EQUIBOP_CONTRIB_ROLE_ID, // Equibop Contributor
    VENCORD_CONTRIB_ROLE_ID, // Vencord Contributor
];

const AsyncFunction = async function () { }.constructor;

const ShowCurrentGame = getUserSettingLazy<boolean>("status", "showCurrentGame")!;
const ShowEmbeds = getUserSettingLazy<boolean>("textAndImages", "renderEmbeds")!;

interface clientData {
    name: string;
    version?: string | null | undefined;
    info?: string | boolean | null | undefined;
    spoofed?: string | null | undefined;
    shortHash?: string | null | undefined;
    hash?: string | null | undefined;
    dev?: boolean | null | undefined;
}

async function forceUpdate() {
    const outdated = await checkForUpdates();
    if (outdated) {
        await update();
        relaunch();
    }

    return outdated;
}

export function detectClient(): clientData {
    if (IS_DISCORD_DESKTOP) {
        return {
            name: "Discord Desktop",
            version: DiscordNative.app.getVersion(),
        };
    }
    if (IS_VESKTOP) return {
        name: "Vesktop",
        version: VesktopNative.app.getVersion(),
    };

    if (IS_EQUIBOP) {
        const equibopGitHash = tryOrElse(() => VesktopNative.app.getGitHash?.(), null);
        const spoofInfo = tryOrElse(() => VesktopNative.app.getPlatformSpoofInfo?.(), null);
        const isDevBuild = tryOrElse(() => VesktopNative.app.isDevBuild?.(), false);
        const shortHash = equibopGitHash?.slice(0, 7);
        return {
            name: "Equibop",
            version: VesktopNative.app.getVersion(),
            spoofed: spoofInfo?.spoofed ? `${platformName()} (spoofed from ${spoofInfo.originalPlatform})` : null,
            dev: isDevBuild,
            shortHash: shortHash,
            hash: equibopGitHash,
        };
    }

    if ("legcord" in window) return {
        name: "LegCord",
        version: window.legcord.version,
    };

    if ("goofcord" in window) return {
        name: "GoofCord",
        version: window.goofcord.version,
    };

    const name = typeof unsafeWindow !== "undefined" ? "UserScript" : "Web";
    return {
        name: name,
        info: navigator.userAgent
    };
}

async function generateDebugInfoMessage() {
    const { RELEASE_CHANNEL } = window.GLOBAL_ENV;

    const clientInfo = detectClient();
    let clientString = `${clientInfo.name}`;
    clientString += `${clientInfo.version ? ` v${clientInfo.version}` : ""}`;
    clientString += `${clientInfo.info ? ` • ${clientInfo.info}` : ""}`;
    clientString += `${clientInfo.shortHash ? ` • [${clientInfo.shortHash}](<https://github.com/Equicord/Equibop/commit/${clientInfo.hash}>)` : ""}`;

    const spoofInfo = IS_EQUIBOP ? tryOrElse(() => VesktopNative.app.getPlatformSpoofInfo?.(), null) : null;
    const platformDisplay = spoofInfo?.spoofed
        ? `${platformName()} (spoofed from ${spoofInfo.originalPlatform})`
        : platformName();

    const info = {
        Testcord:
            `v${VERSION} • [${gitHashShort}](<https://github.com/Equicord/Equicord/commit/${gitHash}>)` +
            `${IS_EQUIBOP ? "" : SettingsPlugin.getVersionInfo()} - ${Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(BUILD_TIMESTAMP)}`,
        Client: `${RELEASE_CHANNEL} ~ ${clientString}`,
        Platform: platformDisplay
    };

    if (IS_DISCORD_DESKTOP) {
        info["Last Crash Reason"] = (await tryOrElse(() => DiscordNative.processUtils.getLastCrash(), undefined))?.rendererCrashReason ?? "N/A";
    }

    const potentiallyProblematicPlugins = ([
        "NoRPC", "NoProfileThemes", "NoMosaic", "NoRoleHeaders", "NoSystemBadge",
        "AlwaysAnimate", "ClientTheme", "SoundTroll", "Ingtoninator", "NeverPausePreviews",
        "IdleAutoRestart",
    ].filter(Vencord.Plugins.isPluginEnabled) ?? []).sort();

    if (Vencord.Plugins.isPluginEnabled("CustomIdle") && Vencord.Settings.plugins.CustomIdle.idleTimeout === 0) {
        potentiallyProblematicPlugins.push("CustomIdle");
    }

    const potentiallyProblematicPluginsNote = "-# note, those plugins are just common issues and might not be the problem";

    const commonIssues = {
        "Activity Sharing Disabled": tryOrElse(() => !ShowCurrentGame.getSetting(), false),
        "Link Embeds Disabled": tryOrElse(() => !ShowEmbeds.getSetting(), false),
        "TestCord DevBuild": !IS_STANDALONE,
        "Equibop DevBuild": IS_EQUIBOP && tryOrElse(() => VesktopNative.app.isDevBuild?.(), false),
        "Platform Spoofed": spoofInfo?.spoofed ?? false,
        "Has UserPlugins": Object.values(PluginMeta).some(m => m.userPlugin),
        ">2 Weeks Outdated": BUILD_TIMESTAMP < Date.now() - 12096e5,
        [`Potentially Problematic Plugins: ${potentiallyProblematicPlugins.join(", ")}\n${potentiallyProblematicPluginsNote}`]: potentiallyProblematicPlugins.length
    };

    let content = `>>> ${Object.entries(info).map(([k, v]) => `**${k}**: ${v}`).join("\n")}`;
    content += "\n" + Object.entries(commonIssues)
        .filter(([, v]) => v).map(([k]) => `⚠️ ${k}`)
        .join("\n");

    return content.trim();
}

// Helper function to read plugin directories
function getPluginsFromDir(dirPath: string): string[] {
    try {
        if (!existsSync(dirPath)) {
            console.warn(`Plugin directory not found: ${dirPath}`);
            return [];
        }

        const items = readdirSync(dirPath, { withFileTypes: true });
        return items
            .filter(item => item.isDirectory() || (item.isFile() && (item.name.endsWith('.js') || item.name.endsWith('.ts') || item.name.endsWith('.tsx'))))
            .map(item => item.isFile() ? parse(item.name).name : item.name)
            .sort();
    } catch (error) {
        console.error(`Error reading plugin directory ${dirPath}:`, error);
        return [];
    }
}

function generatePluginList() {
    const isApiPlugin = (plugin: string) => plugin.endsWith("API") || plugins[plugin]?.required;

    // Get all enabled plugins from Settings.plugins
    const allEnabledPlugins = Object.keys(Settings.plugins).filter(p => isPluginEnabled(p) && !isApiPlugin(p));

    // Get plugins from directories
    const vencordPlugins = getPluginsFromDir(join(process.cwd(), "src", "plugins"));
    const equicordPlugins = getPluginsFromDir(join(process.cwd(), "src", "equicordplugins"));
    const testcordPlugins = getPluginsFromDir(join(process.cwd(), "src", "testcordplugins"));

    // Convert to Sets for faster lookups
    const vencordSet = new Set(vencordPlugins);
    const equicordSet = new Set(equicordPlugins);
    const testcordSet = new Set(testcordPlugins);

    // Categorize enabled plugins
    const enabledVencordPlugins = allEnabledPlugins.filter(p => vencordSet.has(p)).sort();
    const enabledEquicordPlugins = allEnabledPlugins.filter(p => equicordSet.has(p)).sort();
    const enabledTestcordPlugins = allEnabledPlugins.filter(p => testcordSet.has(p)).sort();

    const sections: string[] = [];

    // Helper to add section with splitting if needed
    const addSection = (title: string, pluginList: string[], maxLength: number = 2000) => {
        if (pluginList.length === 0) return;

        const content = `${title} (${pluginList.length}):\n\`\`\`\n${pluginList.join(", ")}\n\`\`\``;

        // Split if too large
        if (content.length <= maxLength) {
            sections.push(content);
            return;
        }

        // Split the plugins list into chunks
        const chunks: string[][] = [];
        let currentChunk: string[] = [];
        let currentLength = title.length + 15; // Base length with formatting

        for (const plugin of pluginList) {
            const pluginWithComma = plugin + ", ";
            if (currentLength + pluginWithComma.length > maxLength - 50) { // Reserve space for codeblock formatting
                if (currentChunk.length > 0) {
                    chunks.push([...currentChunk]);
                    currentChunk = [plugin];
                    currentLength = title.length + plugin.length + 15;
                } else {
                    // Single plugin is too long (unlikely), just add it
                    chunks.push([plugin]);
                }
            } else {
                currentChunk.push(plugin);
                currentLength += pluginWithComma.length;
            }
        }

        if (currentChunk.length > 0) {
            chunks.push(currentChunk);
        }

        // Add each chunk as a separate section
        chunks.forEach((chunk, index) => {
            const sectionTitle = chunks.length === 1 ? title : `${title} [Part ${index + 1}/${chunks.length}]`;
            sections.push(`${sectionTitle} (${chunk.length}/${pluginList.length}):\n\`\`\`\n${chunk.join(", ")}\n\`\`\``);
        });
    };

    // Add sections in order
    addSection("**Vencord plugins enabled**", enabledVencordPlugins);
    addSection("**Equicord plugins enabled**", enabledEquicordPlugins);
    addSection("**Testcord plugins enabled**", enabledTestcordPlugins);

    return sections;
}

const checkForUpdatesOnce = onlyOnce(checkForUpdates);

const settings = definePluginSettings({}).withPrivateSettings<{
    dismissedDevBuildWarning?: boolean;
}>();

export default definePlugin({
    name: "SupportHelper",
    required: true,
    description: "Helps us provide support to you",
    authors: [Devs.Ven],
    dependencies: ["UserSettingsAPI"],

    settings,

    patches: [{
        find: "#{intl::BEGINNING_DM}",
        replacement: {
            match: /#{intl::BEGINNING_DM},{.+?}\),(?=.{0,300}(\i)\.isMultiUserDM)/,
            replace: "$& $self.renderContributorDmWarningCard({ channel: $1 }),"
        }
    }],

    commands: [
        {
            name: "testcord-debug",
            description: "Send Testcord debug info",
            execute: async () => ({ content: await generateDebugInfoMessage() })
        },
        {
            name: "testcord-plugins",
            description: "Send Testcord plugin list",
            execute: async () => {
                const sections = generatePluginList();
                if (!Array.isArray(sections) || sections.length === 0) {
                    return { content: "Unable to generate plugin list." };
                }

                // Send each section (already split if necessary)
                for (const section of sections) {
                    await sendMessage(SelectedChannelStore.getChannelId(), { content: section });
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                return { content: "" }; // No response from the command itself
            }
        }
    ],

    flux: {
        async CHANNEL_SELECT({ channelId }) {
            const isSupportChannel = SUPPORT_CHANNEL_IDS.includes(channelId);
            if (!isSupportChannel) return;

            const selfId = UserStore.getCurrentUser()?.id;
            if (!selfId || isAnyPluginDev(selfId)) return;

            if (!IS_UPDATER_DISABLED) {
                await checkForUpdatesOnce().catch(() => { });

                if (isOutdated) {
                    return Alerts.show({
                        title: "Hold on!",
                        body: <div>
                            <Paragraph>You are using an outdated version of TestCord! Chances are, your issue is already fixed.</Paragraph>
                            <Paragraph className={Margins.top8}>
                                Please first update before asking for support!
                            </Paragraph>
                        </div>,
                        onCancel: () => openSettingsTabModal(UpdaterTab!),
                        cancelText: "View Updates",
                        confirmText: "Update & Restart Now",
                        onConfirm: forceUpdate,
                        secondaryConfirmText: "I know what I'm doing or I can't update"
                    });
                }
            }

            const roles = GuildMemberStore.getSelfMember(VC_GUILD_ID)?.roles || GuildMemberStore.getSelfMember(GUILD_ID)?.roles;
            if (!roles || TrustedRolesIds.some(id => roles.includes(id))) return;

            if (!IS_WEB && IS_UPDATER_DISABLED) {
                return Alerts.show({
                    title: "Hold on!",
                    body: <div>
                        <Paragraph>You are using an externally updated TestCord version, the ability to help you here may be limited.</Paragraph>
                        <Paragraph className={Margins.top8}>
                            Please join the <Link href="https://equicord.org/discord">TestCord Server</Link> for support,
                            or if this issue persists on Vencord, continue on.
                        </Paragraph>
                    </div>
                });
            }
        }
    },

    renderMessageAccessory(props) {
        const buttons = [] as JSX.Element[];

        const testCordSupport = isTestCordGuild(props.channel.id);

        const shouldAddUpdateButton =
            !IS_UPDATER_DISABLED
            && ((isSupportChannel(props.channel.id) && testCordSupport))
            && props.message.content?.includes("update");

        if (shouldAddUpdateButton) {
            buttons.push(
                <Button
                    key="vc-update"
                    color={Button.Colors.GREEN}
                    onClick={async () => {
                        try {
                            if (await forceUpdate())
                                showToast("Success! Restarting...", Toasts.Type.SUCCESS);
                            else
                                showToast("Already up to date!", Toasts.Type.MESSAGE);
                        } catch (e) {
                            new Logger(this.name).error("Error while updating:", e);
                            showToast("Failed to update :(", Toasts.Type.FAILURE);
                        }
                    }}
                >
                    Update Now
                </Button>
            );
        }

        if (isSupportChannel(props.channel.id) && PermissionStore.can(PermissionsBits.SEND_MESSAGES, props.channel) && testCordSupport) {
            if (props.message.content.includes("/testcord-debug") || props.message.content.includes("/testcord-plugins")) {
                buttons.push(
                    <Button
                        key="vc-dbg"
                        color={Button.Colors.PRIMARY}
                        onClick={async () => sendMessage(props.channel.id, { content: await generateDebugInfoMessage() })}
                    >
                        Run /testcord-debug
                    </Button>,
                    <Button
                        key="vc-plg-list"
                        color={Button.Colors.PRIMARY}
                        onClick={async () => {
                            const sections = generatePluginList();
                            if (!Array.isArray(sections) || sections.length === 0) return;
                            const fullContent = sections.join("\n\n");
                            if (fullContent.length <= 2000) {
                                sendMessage(props.channel.id, { content: fullContent });
                                return;
                            }
                            // Send each section separately, splitting if necessary
                            for (const section of sections) {
                                if (section.length <= 2000) {
                                    sendMessage(props.channel.id, { content: section });
                                    await new Promise(resolve => setTimeout(resolve, 100));
                                    continue;
                                }
                                // Split section if too long
                                const lines = section.split("\n");
                                const header = lines[0]; // **Category plugins enabled (count):**
                                const codeblock = lines.slice(1).join("\n"); // ```plugins```
                                const pluginsStr = codeblock.slice(3, -3); // remove ```
                                const plugins = pluginsStr.split(", ");
                                const mid = Math.ceil(plugins.length / 2);
                                const part1 = plugins.slice(0, mid).join(", ");
                                const part2 = plugins.slice(mid).join(", ");
                                const section1 = `${header} part 1**\n${makeCodeblock(part1)}`;
                                const section2 = `${header} part 2**\n${makeCodeblock(part2)}`;
                                sendMessage(props.channel.id, { content: section1 });
                                await new Promise(resolve => setTimeout(resolve, 100));
                                sendMessage(props.channel.id, { content: section2 });
                                await new Promise(resolve => setTimeout(resolve, 100));
                            }
                        }}
                    >
                        Run /testcord-plugins
                    </Button>
                );
            }

            if (testCordSupport) {
                const match = CodeBlockRe.exec(props.message.content || props.message.embeds[0]?.rawDescription || "");
                if (match) {
                    buttons.push(
                        <Button
                            key="vc-run-snippet"
                            onClick={async () => {
                                try {
                                    const result = await AsyncFunction(match[1])();
                                    const stringed = String(result);
                                    if (stringed) {
                                        await sendBotMessage(SelectedChannelStore.getChannelId(), {
                                            content: stringed
                                        });
                                    }

                                    showToast("Success!", Toasts.Type.SUCCESS);
                                } catch (e) {
                                    new Logger(this.name).error("Error while running snippet:", e);
                                    showToast("Failed to run snippet :(", Toasts.Type.FAILURE);
                                }
                            }}
                        >
                            Run Snippet
                        </Button>
                    );
                }
            }
        }

        return buttons.length
            ? <Flex>{buttons}</Flex>
            : null;
    },

    renderContributorDmWarningCard: ErrorBoundary.wrap(({ channel }) => {
        const userId = channel.getRecipientId();
        if (!isAnyPluginDev(userId)) return null;
        if (RelationshipStore.isFriend(userId) || isAnyPluginDev(UserStore.getCurrentUser()?.id)) return null;

        return (
            <Card variant="warning" className={Margins.top8} defaultPadding>
                Please do not private message Equicord & Vencord plugin developers for support!
                <br />
                Instead, use the support channel: {Parser.parse("https://discord.com/channels/1173279886065029291/1297590739911573585")}
                {!ChannelStore.getChannel(SUPPORT_CHANNEL_ID) && " (Click the link to join)"}
            </Card>
        );
    }, { noop: true }),
});
