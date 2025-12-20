/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MagnifyingGlassIcon } from "@components/Icons";
import SettingsPlugin from "@plugins/_core/settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { StartAt } from "@utils/types";
import { LazyComponentWebpack, openUserSettingsPanel } from "@webpack/common";

export default definePlugin({
    name: "IconViewer",
    description: "Adds a new tab to settings to preview all icons.",
    authors: [EquicordDevs.iamme],
    dependencies: ["Settings"],
    startAt: StartAt.WebpackReady,
    toolboxActions: {
        "Open Icons Tab"() {
            openUserSettingsPanel("equicord_icon_viewer");
        },
    },
    settingsAboutComponent: LazyComponentWebpack(() => import("./components/Modals").then(m => m.SettingsAbout)),
    start() {
        const { customEntries, customSections } = SettingsPlugin;

        customEntries.push({
            key: "equicord_icon_viewer",
            title: "Icon Finder",
            Component: LazyComponentWebpack(() => import("./components/IconsTab").then(m => m.default)),
            Icon: MagnifyingGlassIcon
        });

        customSections.push(() => ({
            section: "EquicordDiscordIcons",
            label: "Icon Finder",
            element: LazyComponentWebpack(() => import("./components/IconsTab").then(m => m.default)),
            className: "vc-discord-icons",
            id: "IconViewer"
        }));
    },
    stop() {
        const { customEntries, customSections } = SettingsPlugin;
        const entryIdx = customEntries.findIndex(e => e.key === "equicord_icon_viewer");
        const sectionIdx = customSections.findIndex(s => s({} as any).id === "IconViewer");
        if (entryIdx !== -1) customEntries.splice(entryIdx, 1);
        if (sectionIdx !== -1) customSections.splice(sectionIdx, 1);
    },
});
