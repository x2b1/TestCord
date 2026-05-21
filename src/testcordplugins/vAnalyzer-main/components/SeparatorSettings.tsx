/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Margins } from "@components/margins";
import { React } from "@webpack/common";
import { HeadingSecondary } from "@components/Heading";
import { Divider } from "@components/Divider";

export default function SeparatorSettings({ label }: { label: string; }) {
    return (
        <div className={Margins.top20}>
            <HeadingSecondary className={Margins.bottom8}>{label}</HeadingSecondary>
            <Divider className={Margins.bottom8} />
        </div>
    );
}