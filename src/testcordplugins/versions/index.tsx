/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

import gitRemote from "~git-remote";

export default definePlugin({
    name: "Versions",
    description: "Adds extra information to the version info",
    authors: [Devs.ImLvna],
    enabledByDefault: true,

    patches: [
        {
            find: ".versionHash",
            replacement: [
                {
                    match: /\[\(0,.{1,3}\.jsxs?\)\((.{1,10}),(\{[^{}}]+\{.{0,20}.versionHash,.+?\})\)," "/,
                    replace: (m, component, props) => {
                        props = props.replace(/children:\[.+\]/, "");
                        return `${m},Vencord.Plugins.plugins.Versions.makeInfoElements(${component}, ${props})`;
                    }
                }
            ]
        }
    ],

    makeInfoElements(Component: React.ComponentType<React.PropsWithChildren>, props: React.PropsWithChildren) {
        const versions = VencordNative.native.getVersions();
        return (
            <>
                {versions.node && <Component {...props}>Node {versions.node}</Component>}
                <Component {...props}>{gitRemote}</Component>
            </>
        );
    }
});
