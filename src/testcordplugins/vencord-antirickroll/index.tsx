/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addMessageAccessory, removeMessageAccessory } from "@api/MessageAccessories";
import { definePluginSettings } from "@api/Settings";
import { getUserSettingLazy } from "@api/UserSettings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Devs, TestcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import type { Message } from "@vencord/discord-types";
import { React, Text } from "@webpack/common";

import { knownHosts } from "./knownHosts";
import { knownVideoIds } from "./knownVideoIDs";
const MessageDisplayCompact = getUserSettingLazy("textAndImages", "messageDisplayCompact")!;

const settings = definePluginSettings({
    customLinks: {
        description: "Custom links to check for (separated by commas)",
        type: OptionType.STRING,
        default: "",
        restartNeeded: true
    },
    customVideoIds: {
        description: "Custom YouTube video IDs to check for (separated by commas)",
        type: OptionType.STRING,
        default: "",
        restartNeeded: true
    }
});

function isPotentialRickroll(url: string): boolean {
    try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname.replace("www.", "");

        const customLinks = settings.store.customLinks.split(",").map(s => s.trim()).filter(Boolean);
        const customVideoIDs = settings.store.customVideoIds.split(",").map(s => s.trim()).filter(Boolean);

        if (customLinks.some(link => parsedUrl.href.includes(link))) {
            return true;
        }

        if (hostname === "youtube.com" || hostname === "youtu.be") {
            let videoID = "";

            if (hostname === "youtube.com") {
                videoID = parsedUrl.searchParams.get("v") || "";
            } else if (hostname === "youtu.be") {
                videoID = parsedUrl.pathname.slice(1);
            }

            const knownVideoIDs = [...knownVideoIds, ...customVideoIDs];

            if (knownVideoIDs.includes(videoID)) {
                return true;
            }
        }

        if (knownHosts.includes(hostname)) {
            return true;
        }

    } catch (e) {
        // Invalid URL, ignore :trolley:
    }
    return false;
}

function extractUrls(content: string): string[] {
    const urls: string[] = [];
    const markdownLinkRegex = /\[.*?\]\((<)?(https?:\/\/[^\s>]+)(>)?\)/g;
    const urlRegex = /https?:\/\/[^\s<]+/g;
    const maskedUrlRegex = /<(https?:\/\/[^\s>]+)>/g;

    let match: RegExpExecArray | null;

    while ((match = markdownLinkRegex.exec(content)) !== null) {
        urls.push(match[2]);
    }

    while ((match = urlRegex.exec(content)) !== null) {
        urls.push(match[0]);
    }

    while ((match = maskedUrlRegex.exec(content)) !== null) {
        urls.push(match[1]);
    }

    return urls;
}

function RickrollWarningAccessory({ message }: { message: Message; }) {
    const urls = extractUrls(message.content);
    if (urls.length === 0) return null;

    for (const url of urls) {
        const isCustom = isCustomRickroll(url);
        if (isPotentialRickroll(url) || isCustom) {
            return (
                <ErrorBoundary>
                    <RickrollWarning message={message} isCustom={isCustom} />
                </ErrorBoundary>
            );
        }
    }

    return null;
}

function isCustomRickroll(url: string): boolean {
    try {
        const parsedUrl = new URL(url);
        const customLinks = settings.store.customLinks.split(",").map(s => s.trim()).filter(Boolean);
        const customVideoIDs = settings.store.customVideoIds.split(",").map(s => s.trim()).filter(Boolean);

        if (customLinks.some(link => parsedUrl.href.includes(link))) {
            return true;
        }

        const hostname = parsedUrl.hostname.replace("www.", "");
        if (hostname === "youtube.com" || hostname === "youtu.be") {
            let videoID = "";
            if (hostname === "youtube.com") {
                videoID = parsedUrl.searchParams.get("v") || "";
            } else if (hostname === "youtu.be") {
                videoID = parsedUrl.pathname.slice(1);
            }

            if (customVideoIDs.includes(videoID)) {
                return true;
            }
        }
    } catch (e) {
        // Invalid URL, ignore :trolley: (could probably merge this)
    }
    return false;
}

function RickrollWarning({ message, isCustom }: { message: Message; isCustom: boolean; }) {
    const compact = MessageDisplayCompact.useSetting();

    return (
        <div>
            <Text color="text-danger" variant="text-xs/semibold">
                ⚠️ This link is {isCustom ? "matching one of your filters for rickrolls." : "a known rickroll."}
            </Text>

        </div>
    );
}

export default definePlugin({
    name: "AntiRickroll",
    description: "Warns you of potential Rickrolls in messages, including masked links (supports custom rules)",
    authors: [Devs.ryanamay, TestcordDevs.x2b],
    dependencies: ["MessageAccessoriesAPI", "UserSettingsAPI"],

    settings,

    start() {
        addMessageAccessory("rickrollWarning", (props: Record<string, any>) => {
            return (
                <RickrollWarningAccessory message={props.message as Message} />
            );
        }, 4);
    },

    stop() {
        removeMessageAccessory("rickrollWarning");
    },
});


