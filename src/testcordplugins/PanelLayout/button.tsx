/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { UserAreaButton, UserAreaRenderProps } from "@api/UserArea";
import { openModal } from "@utils/modal";
import { React } from "@webpack/common";

// ─── Layout Icon ─────────────────────────────────────────────────────────────

function LayoutIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
    return (
        <svg className={className} style={style} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
    );
}

// ─── Panel Layout Button ─────────────────────────────────────────────────────

function PanelLayoutButton({ iconForeground, hideTooltips, nameplate }: UserAreaRenderProps) {
    return (
        <UserAreaButton
            tooltipText={hideTooltips ? void 0 : "Cora's ModMenu"}
            icon={<LayoutIcon className={iconForeground} />}
            role="button"
            plated={nameplate != null}
            onClick={() => openModal(modalProps => <PanelLayoutModal modalProps={modalProps} />)}
        />
    );
}

// Note: PanelLayoutModal needs to be imported or defined elsewhere.
// For this button to work, the modal component must be available.

export { PanelLayoutButton, LayoutIcon };