/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { UserAreaButton, UserAreaRenderProps } from "@api/UserArea";
import { ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { Button, React, Select } from "@webpack/common";

// ─── Settings ─────────────────────────────────────────────────────────────────

const settings = definePluginSettings({
    // Layout
    userPanelLayout: {
        type: OptionType.SELECT,
        description: "Layout for user panel buttons",
        options: [
            { label: "Default", value: "default", default: true },
            { label: "2-column grid", value: "grid2" },
            { label: "3-column grid", value: "grid3" },
            { label: "Vertical stack", value: "vertical" },
            { label: "Plugins Top (Row)", value: "split_row" },
            { label: "Plugins Top (2-col Grid)", value: "split_grid2" },
            { label: "Plugins Top (3-col Grid)", value: "split_grid3" },
            { label: "Plugins Top (4-col Grid)", value: "split_grid4" },
            { label: "All Buttons Top", value: "all_top" },
            { label: "Hidden", value: "hidden" },
        ],
        onChange: () => apply()
    },
    callControlsLayout: {
        type: OptionType.SELECT,
        description: "Layout for call control buttons",
        options: [
            { label: "Default", value: "default", default: true },
            { label: "2-column grid", value: "grid2" },
            { label: "Vertical stack", value: "vertical" },
            { label: "Hidden", value: "hidden" },
        ],
        onChange: () => apply()
    },
    // Sizing
    iconSize: { type: OptionType.SLIDER, description: "Icon size (px)", default: 20, markers: [12, 14, 16, 18, 20, 24, 28], stickToMarkers: false, onChange: () => apply() },
    buttonContainerSize: { type: OptionType.SLIDER, description: "Button overall size (px)", default: 36, markers: [24, 28, 32, 36, 40, 48], stickToMarkers: false, onChange: () => apply() },
    buttonGap: { type: OptionType.SLIDER, description: "Gap between buttons (px)", default: 6, markers: [0, 2, 4, 6, 8, 12], stickToMarkers: true, onChange: () => apply() },
    panelOpacity: { type: OptionType.SLIDER, description: "Panel buttons opacity (0-100)", default: 100, markers: [10, 25, 50, 75, 100], stickToMarkers: false, onChange: () => apply() },
    // Button styling
    buttonStyle: {
        type: OptionType.SELECT,
        description: "Visual style of panel buttons",
        options: [
            { label: "Default (no background)", value: "default", default: true },
            { label: "Rounded filled", value: "filled" },
            { label: "Outlined", value: "outlined" },
            { label: "Pill", value: "pill" },
            { label: "Square filled", value: "square" },
        ],
        onChange: () => apply()
    },
    hoverEffect: {
        type: OptionType.SELECT,
        description: "Hover effect on panel buttons",
        options: [
            { label: "Default", value: "default", default: true },
            { label: "Scale up", value: "scale" },
            { label: "Glow", value: "glow" },
            { label: "Bright", value: "bright" },
            { label: "None", value: "none" },
        ],
        onChange: () => apply()
    },
    panelBackgroundColor: { type: OptionType.STRING, description: "Panel background color", default: "#0e1852", onChange: () => apply() },
    colorfulActiveButtons: { type: OptionType.BOOLEAN, default: true, description: "Use distinct colored blobs for active plugin buttons", onChange: () => apply() },
    // Chevrons
    hideChevrons: { type: OptionType.BOOLEAN, default: false, description: "Hide dropdown chevrons next to Mute and Deafen", onChange: () => apply() },
    // Call controls
    callCompact: { type: OptionType.BOOLEAN, default: false, description: "Compact mode for call control buttons", onChange: () => apply() },
    hideDisconnect: { type: OptionType.BOOLEAN, default: false, description: "Hide the disconnect button", onChange: () => apply() },
    hideVoiceStatus: { type: OptionType.BOOLEAN, default: false, description: "Hide the 'Voice Connected' status text and channel name", onChange: () => apply() },
    hidePingIcon: { type: OptionType.BOOLEAN, default: false, description: "Hide the ping/connection quality icon", onChange: () => apply() },
    // Per-button visibility
    hideMute: { type: OptionType.BOOLEAN, default: false, description: "Hide Mute button", onChange: () => apply() },
    hideDeafen: { type: OptionType.BOOLEAN, default: false, description: "Hide Deafen button", onChange: () => apply() },
    hideSettings: { type: OptionType.BOOLEAN, default: false, description: "Hide User Settings button", onChange: () => apply() },
    hideCamera: { type: OptionType.BOOLEAN, default: false, description: "Hide camera button in call controls", onChange: () => apply() },
    hideScreenShare: { type: OptionType.BOOLEAN, default: false, description: "Hide screen share button in call controls", onChange: () => apply() },
    hideActivity: { type: OptionType.BOOLEAN, default: false, description: "Hide activity button in call controls", onChange: () => apply() },
});

// ─── Selectors ────────────────────────────────────────────────────────────────

const S = {
    panelContainer: ".container__37e49",
    panelButtons:   ".buttons__37e49",
    panelButton:    ".button__201d5",
    audioParent:    ".audioButtonParent__5e764",
    chevron:        ".buttonChevron__5e764",
    callContainer:  ".container_e131a9",
    callControls:   ".actionButtons_e131a9",
    callButton:     ".button_e131a9",
    voiceStatus:    ".rtcConnectionStatus__06d62",
    pingIcon:       ".clickablePing__06d62",
    disconnect:     ".voiceButtonsContainer_e131a9",
    accountWrapper: ".accountPopoutButtonWrapper__37e49",
};

// ─── CSS Builder ──────────────────────────────────────────────────────────────

const STYLE_ID = "deracul-panel-layout";

function gridCSS(selector: string, cols: number, gap: number) {
    return `
        ${selector} {
            display: grid !important;
            grid-template-columns: repeat(${cols}, auto) !important;
            grid-auto-rows: auto !important;
            gap: ${gap}px !important;
            height: auto !important;
            width: auto !important;
            align-items: center !important;
            justify-content: start !important;
            flex-shrink: 0 !important;
        }
        ${selector} .audioButtonParent__5e764 {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            grid-column: span 1 !important;
        }
    `;
}

function verticalCSS(selector: string, gap: number, audioParent: string, button: string) {
    return `
        ${selector} {
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: ${gap}px !important;
            height: auto !important;
            flex-shrink: 0 !important;
            overflow: visible !important;
        }
        ${selector} ${audioParent} {
            display: flex !important;
            flex-direction: row !important;
            width: 100% !important;
            flex-shrink: 0 !important;
        }
        ${selector} ${audioParent} ${button} {
            flex: 1 !important;
            justify-content: center !important;
            min-width: 0 !important;
        }
    `;
}

function buildCSS(): string {
    const st = settings.store;
    const gap = st.buttonGap ?? 4;
    const lines: string[] = [];

    // ── Base Container tweaks ──
    lines.push(`${S.panelContainer} { height: auto !important; min-height: unset !important; }`);

    // ── User panel layout ──
    switch (st.userPanelLayout) {
        case "grid2":    lines.push(gridCSS(S.panelButtons, 2, gap)); break;
        case "grid3":    lines.push(gridCSS(S.panelButtons, 3, gap)); break;
        case "vertical":
            lines.push(verticalCSS(S.panelButtons, gap, S.audioParent, S.panelButton));
            lines.push(`${S.panelContainer} { flex-wrap: wrap !important; align-items: flex-start !important; padding-bottom: 6px !important; }`);
            break;
        case "split_row":
        case "split_grid2":
        case "split_grid3":
        case "split_grid4":
            let flexSize = "1 1 auto";
            if (st.userPanelLayout === "split_grid2") flexSize = `0 0 calc(50% - (${gap}px / 2))`;
            if (st.userPanelLayout === "split_grid3") flexSize = `0 0 calc(33.333% - (${gap}px * 2 / 3))`;
            if (st.userPanelLayout === "split_grid4") flexSize = `0 0 calc(25% - (${gap}px * 3 / 4))`;

            lines.push(`
                ${S.panelContainer} {
                    display: flex !important; flex-wrap: wrap !important; gap: ${gap}px !important;
                    height: auto !important; padding: 8px !important; align-items: center !important;
                }
                ${S.panelContainer}::before {
                    content: "" !important; order: 2 !important; width: 100% !important;
                    height: 1px !important; background: var(--background-modifier-accent) !important; margin: 2px 0 !important;
                }
                ${S.accountWrapper} {
                    order: 3 !important; flex: 1 1 auto !important; min-width: 0 !important; margin-right: auto !important;
                }
                ${S.panelButtons} { display: contents !important; }
                ${S.panelButtons} > *:not(${S.audioParent}):not([aria-label="User Settings"]) {
                    order: 1 !important; display: flex !important; justify-content: center !important; align-items: center !important; flex: ${flexSize} !important;
                }
                ${S.panelButtons} > *:not(${S.audioParent}):not([aria-label="User Settings"]) > button {
                    width: 100% !important; display: flex !important; justify-content: center !important; align-items: center !important;
                }
                ${S.panelButtons} > ${S.audioParent},
                ${S.panelButtons} > [aria-label="User Settings"] {
                    order: 4 !important; margin: 0 !important;
                }
            `);
            break;
        case "all_top":
            lines.push(`
                ${S.panelContainer} { display: flex !important; flex-wrap: wrap !important; gap: ${gap}px !important; height: auto !important; padding: 8px !important; }
                ${S.panelContainer}::before { content: "" !important; flex-basis: 100% !important; order: 2 !important; height: 0 !important; margin: 0 !important; }
                ${S.accountWrapper} { order: 3 !important; flex: 1 1 auto !important; min-width: 0 !important; margin-right: auto !important; }
                ${S.panelButtons} { display: flex !important; flex-wrap: wrap !important; order: 1 !important; gap: ${gap}px !important; width: 100% !important; }
            `);
            break;
        case "hidden":   lines.push(`${S.panelButtons} { display: none !important; }`); break;
        default:
            if (gap !== 4) lines.push(`${S.panelButtons} { gap: ${gap}px !important; }`);
            break;
    }

    // ── Call controls layout ──
    switch (st.callControlsLayout) {
        case "grid2":    lines.push(gridCSS(S.callControls, 2, gap)); break;
        case "vertical":
            lines.push(`
                ${S.callControls} { display: flex !important; flex-direction: column !important; gap: ${gap}px !important; height: auto !important; align-items: stretch !important; }
                ${S.callContainer} { height: auto !important; align-items: flex-start !important; flex-wrap: wrap !important; }
            `);
            break;
        case "hidden":   lines.push(`${S.callControls} { display: none !important; }`); break;
        default:
            if (gap !== 4) lines.push(`${S.callControls} { gap: ${gap}px !important; }`);
            break;
    }

    // ── Icon & Button size ──
    if (st.iconSize !== 20) {
        lines.push(`${S.panelButtons} ${S.panelButton} svg, ${S.panelButtons} ${S.panelButton} .lottieIcon__5eb9b { width: ${st.iconSize}px !important; height: ${st.iconSize}px !important; }`);
    }
    if (st.buttonContainerSize !== 32) {
        lines.push(`
            ${S.panelButtons} ${S.panelButton} {
                width: ${st.buttonContainerSize}px !important; height: ${st.buttonContainerSize}px !important;
                min-width: unset !important; min-height: unset !important; padding: 0 !important;
                display: flex !important; align-items: center !important; justify-content: center !important;
            }
            ${S.panelButtons} ${S.panelButton} .contents__201d5 { display: flex !important; align-items: center !important; justify-content: center !important; }
        `);
    }

    // ── Base Button style ──
    switch (st.buttonStyle) {
        case "filled":
            lines.push(`${S.panelButtons} ${S.panelButton} { background: var(--background-modifier-hover) !important; border-radius: 8px !important; }
                        ${S.panelButtons} ${S.panelButton}:hover { background: var(--background-modifier-active) !important; }`);
            break;
        case "outlined":
            lines.push(`${S.panelButtons} ${S.panelButton} { border: 1.5px solid var(--background-modifier-accent) !important; border-radius: 8px !important; }
                        ${S.panelButtons} ${S.panelButton}:hover { border-color: var(--interactive-normal) !important; background: var(--background-modifier-hover) !important; }`);
            break;
        case "pill":
            lines.push(`${S.panelButtons} ${S.panelButton} { background: var(--background-modifier-hover) !important; border-radius: 20px !important; }
                        ${S.panelButtons} ${S.panelButton}:hover { background: var(--background-modifier-active) !important; }`);
            break;
        case "square":
            lines.push(`${S.panelButtons} ${S.panelButton} { background: var(--background-modifier-hover) !important; border-radius: 2px !important; }
                        ${S.panelButtons} ${S.panelButton}:hover { background: var(--background-modifier-active) !important; }`);
            break;
    }

    // ── Colorful Active Buttons (Blobs) ──
    if (st.colorfulActiveButtons) {
        lines.push(`
            /* Base Switch Plugin State (Blurple fallback) */
            ${S.panelButtons} button[role="switch"][aria-checked="true"] {
                background-color: var(--brand-experiment, #5865F2) !important; color: white !important;
                border-radius: 10px !important; /* Force nice blob shape */
            }
            ${S.panelButtons} button[role="switch"][aria-checked="true"] svg { fill: white !important; color: white !important; }

            /* Game Activity & VC Ban (Red) */
            ${S.panelButtons} button[aria-label*="Game Activity"][aria-checked="true"],
            ${S.panelButtons} button[aria-label*="Ban all in VC"] {
                background-color: var(--status-danger, #DA373C) !important; color: white !important;
                border-radius: 10px !important;
            }
            ${S.panelButtons} button[aria-label*="Game Activity"][aria-checked="true"] svg,
            ${S.panelButtons} button[aria-label*="Ban all in VC"] svg { color: white !important; fill: white !important; }

            /* Fake States (Green) */
            ${S.panelButtons} button[aria-label*="Fake States"][aria-checked="true"] {
                background-color: var(--status-positive, #23A559) !important; color: white !important;
                border-radius: 10px !important;
            }
            ${S.panelButtons} button[aria-label*="Fake States"][aria-checked="true"] svg { color: white !important; fill: white !important; }

            /* Prevent default mute/deafen from turning blurple if they overlap the "switch" role */
            ${S.panelButtons} button[aria-label="Mute"][role="switch"][aria-checked="true"],
            ${S.panelButtons} button[aria-label="Deafen"][role="switch"][aria-checked="true"] {
                background-color: transparent !important; color: var(--status-danger, #DA373C) !important;
            }
        `);
    }

    // ── Opacity & Hover ──
    if (st.panelOpacity !== 100) {
        lines.push(`${S.panelButtons} { opacity: ${st.panelOpacity / 100} !important; transition: opacity 0.2s !important; }`);
        lines.push(`${S.panelButtons}:hover { opacity: 1 !important; }`);
    }

    // ── Panel background color ──
    if (st.panelBackgroundColor) {
        lines.push(`${S.panelContainer} { background-color: ${st.panelBackgroundColor} !important; }`);
    }

    switch (st.hoverEffect) {
        case "scale":
            lines.push(`${S.panelButtons} ${S.panelButton}:hover { transform: scale(1.15) !important; transition: transform 0.15s ease !important; }`);
            break;
        case "glow":
            lines.push(`${S.panelButtons} ${S.panelButton}:hover { filter: drop-shadow(0 0 6px var(--brand-experiment, #5865f2)) !important; transition: filter 0.15s ease !important; }`);
            break;
        case "bright":
            lines.push(`${S.panelButtons} ${S.panelButton}:hover { filter: brightness(1.3) !important; transition: filter 0.15s ease !important; }`);
            break;
    }

    // ── Toggles & Hiding ──
    if (st.hideChevrons) lines.push(`${S.panelButtons} ${S.chevron} { display: none !important; }`);
    if (st.hideDisconnect) lines.push(`${S.disconnect} { display: none !important; }`);
    if (st.hideVoiceStatus) lines.push(`${S.voiceStatus} { display: none !important; }`);
    if (st.hidePingIcon) lines.push(`${S.pingIcon} { display: none !important; }`);

    // Call controls — compact
    if (st.callCompact) {
        lines.push(`
            ${S.callControls} ${S.callButton} { min-width: unset !important; padding: 4px 8px !important; flex: unset !important; }
            ${S.callControls} ${S.callButton} .lottieIcon__5eb9b, ${S.callControls} ${S.callButton} svg { width: 18px !important; height: 18px !important; }
        `);
    }

    // Per-button hide
    if (st.hideMute)        lines.push(`[aria-label="Mute"] { display: none !important; }`);
    if (st.hideDeafen)      lines.push(`[aria-label="Deafen"] { display: none !important; }`);
    if (st.hideSettings)    lines.push(`[aria-label="User Settings"] { display: none !important; }`);
    if (st.hideCamera)      lines.push(`[aria-label="Turn On Camera"] { display: none !important; }`);
    if (st.hideScreenShare) lines.push(`[aria-label="Share Your Screen"] { display: none !important; }`);
    if (st.hideActivity)    lines.push(`[aria-label="Start An Activity"] { display: none !important; }`);

    return lines.join("\n");
}

function apply() {
    document.getElementById(STYLE_ID)?.remove();
    const css = buildCSS();
    if (!css.trim()) return;
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = css;
    document.head.appendChild(el);
}

// ─── Native Modal UI Components ───────────────────────────────────────────────

const PANEL_LAYOUTS = [
    { value: "default", label: "Default" },
    { value: "grid2",   label: "2-Column Grid" },
    { value: "grid3",   label: "3-Column Grid" },
    { value: "vertical", label: "Vertical Stack" },
    { value: "split_row", label: "Plugins Top (Row)" },
    { value: "split_grid2", label: "Plugins Top (2-Col Grid)" },
    { value: "split_grid3", label: "Plugins Top (3-Col Grid)" },
    { value: "split_grid4", label: "Plugins Top (4-Col Grid)" },
    { value: "all_top", label: "All Buttons Top" },
    { value: "hidden",  label: "Hidden" },
];
const CALL_LAYOUTS = [
    { value: "default",  label: "Default" },
    { value: "grid2",    label: "2-Column Grid" },
    { value: "vertical", label: "Vertical Stack" },
    { value: "hidden",   label: "Hidden" },
];
const BUTTON_STYLES = [
    { value: "default",  label: "Default (None)" },
    { value: "filled",   label: "Rounded Filled" },
    { value: "outlined", label: "Outlined" },
    { value: "pill",     label: "Pill Shape" },
    { value: "square",   label: "Square Filled" },
];
const HOVER_EFFECTS = [
    { value: "default", label: "Default" },
    { value: "scale",   label: "Scale Up" },
    { value: "glow",    label: "Color Glow" },
    { value: "bright",  label: "Brighten" },
    { value: "none",    label: "None" },
];

const C = {
    text: "#dbdee1",
    textMuted: "#949ba4",
    header: "#f2f3f5",
    cardBg: "#2b2d31",
    brand: "#5865f2",
    green: "#23a559",
    border: "rgba(255,255,255,0.06)"
};

function SectionLabel({ children }: { children: string; }) {
    return <h3 style={{ color: C.textMuted, fontSize: "12px", fontWeight: 700, textTransform: "uppercase", margin: "0 0 8px 0", letterSpacing: "0.02em" }}>{children}</h3>;
}

function Card({ children }: { children: React.ReactNode; }) {
    return <div style={{ backgroundColor: C.cardBg, borderRadius: "8px", border: `1px solid ${C.border}`, padding: "16px", display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>{children}</div>;
}

function SliderRow({ label, value, min, max, step, unit = "px", onChange }: {
    label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void;
}) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "15px", fontWeight: 500, color: C.text }}>{label}</span>
                <span style={{ fontSize: "14px", fontWeight: 600, color: C.text }}>{value}{unit}</span>
            </div>
            <input type="range" min={min} max={max} step={step} value={value}
                onChange={e => onChange(Number(e.target.value))}
                style={{ width: "100%", accentColor: C.brand, cursor: "pointer", height: "4px" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "12px", color: C.textMuted, fontWeight: 600 }}>{min}{unit}</span>
                <span style={{ fontSize: "12px", color: C.textMuted, fontWeight: 600 }}>{max}{unit}</span>
            </div>
        </div>
    );
}

function Toggle({ label, desc, value, onChange }: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void; }) {
    return (
        <div onClick={() => onChange(!value)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", gap: "16px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "15px", color: C.text, fontWeight: 500 }}>{label}</div>
                {desc && <div style={{ fontSize: "13px", color: C.textMuted, marginTop: "4px", lineHeight: "1.3" }}>{desc}</div>}
            </div>
            <div style={{
                width: "40px", height: "24px", borderRadius: "12px", flexShrink: 0,
                backgroundColor: value ? C.green : "#80848e",
                position: "relative", transition: "background 0.2s ease-in-out"
            }}>
                <div style={{
                    position: "absolute", top: "3px", left: value ? "19px" : "3px", width: "18px", height: "18px",
                    borderRadius: "50%", backgroundColor: "white", transition: "left 0.2s ease-in-out",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                }} />
            </div>
        </div>
    );
}

function Dropdown({ label, options, value, onChange }: {
    label: string; options: { value: string; label: string; }[]; value: string; onChange: (v: string) => void;
}) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "15px", fontWeight: 500, color: C.text }}>{label}</span>
            <Select options={options} serialize={v => String(v)} select={onChange} isSelected={v => v === value} closeOnSelect={true} />
        </div>
    );
}

function ColorRow({ label, value, onChange }: {
    label: string; value: string; onChange: (v: string) => void;
}) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "15px", fontWeight: 500, color: C.text }}>{label}</span>
            <input type="color" value={value} onChange={e => onChange(e.target.value)}
                style={{ width: "100%", height: "40px", border: "none", borderRadius: "6px", cursor: "pointer" }}
            />
        </div>
    );
}

// ─── Modal Implementation ─────────────────────────────────────────────────────

function PanelLayoutModal({ modalProps }: { modalProps: ModalProps; }) {
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);
    const [tab, setTab] = React.useState<"panel" | "call" | "style" | "colors" | "hide">("panel");

    function set<K extends keyof typeof settings.store>(key: K, val: (typeof settings.store)[K]) {
        settings.store[key] = val;
        forceUpdate();
    }

    const s = settings.store;

    const tabs: { id: typeof tab; label: string; }[] = [
        { id: "panel", label: "Panel" },
        { id: "call",  label: "Call Bar" },
        { id: "style", label: "Style" },
        { id: "colors", label: "Colors" },
        { id: "hide",  label: "Visibility" },
    ];

    return (
        <ModalRoot {...modalProps} size={ModalSize.SMALL}>
            <ModalHeader separator={false} style={{ flexDirection: "column", padding: "24px 24px 0 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
                    <LayoutIcon className="icon__201d5" style={{ color: C.header }} />
                    <span style={{ fontSize: "20px", fontWeight: 800, color: C.header, lineHeight: 1 }}>Panel Layout</span>
                </div>

                {/* Tab bar */}
                <div style={{ display: "flex", gap: "24px", marginTop: "24px", borderBottom: `1px solid ${C.border}`, width: "100%" }}>
                    {tabs.map(t => (
                        <div key={t.id} onClick={() => setTab(t.id)} style={{
                            paddingBottom: "12px", cursor: "pointer", fontSize: "14px", fontWeight: tab === t.id ? 600 : 500,
                            color: tab === t.id ? C.header : C.textMuted,
                            borderBottom: tab === t.id ? `2px solid ${C.brand}` : "2px solid transparent",
                            transition: "all 0.15s ease"
                        }}>
                            {t.label}
                        </div>
                    ))}
                </div>
            </ModalHeader>

            <ModalContent style={{ padding: "24px 24px 0 24px" }}>
                <div style={{ display: "flex", flexDirection: "column" }}>

                    {tab === "panel" && <>
                        <SectionLabel>Layout Structure</SectionLabel>
                        <Card>
                            <Dropdown label="User Panel Alignment" options={PANEL_LAYOUTS} value={s.userPanelLayout} onChange={v => set("userPanelLayout", v)} />
                        </Card>

                        <SectionLabel>Component Dimensions</SectionLabel>
                        <Card>
                            <SliderRow label="Button Box Size" value={s.buttonContainerSize} min={24} max={48} step={1} onChange={v => set("buttonContainerSize", v)} />
                            <SliderRow label="Vector Icon Size" value={s.iconSize} min={12} max={28} step={1} onChange={v => set("iconSize", v)} />
                            <SliderRow label="Margin / Gap" value={s.buttonGap} min={0} max={12} step={1} onChange={v => set("buttonGap", v)} />
                            <SliderRow label="Idle Opacity" value={s.panelOpacity} min={10} max={100} step={5} unit="%" onChange={v => set("panelOpacity", v)} />
                        </Card>

                        <SectionLabel>Extra Features</SectionLabel>
                        <Card>
                            <Toggle label="Hide Dropdown Chevrons" desc="Removes the tiny arrows next to Mute/Deafen." value={s.hideChevrons} onChange={v => set("hideChevrons", v)} />
                        </Card>
                    </>}

                    {tab === "call" && <>
                        <SectionLabel>Action Bar Layout</SectionLabel>
                        <Card>
                            <Dropdown label="Call Controls Alignment" options={CALL_LAYOUTS} value={s.callControlsLayout} onChange={v => set("callControlsLayout", v)} />
                        </Card>

                        <SectionLabel>Voice Settings</SectionLabel>
                        <Card>
                            <Toggle label="Compact Mode" desc="Reduces padding inside call buttons to save space." value={s.callCompact} onChange={v => set("callCompact", v)} />
                            <Toggle label="Hide Disconnect Button" value={s.hideDisconnect} onChange={v => set("hideDisconnect", v)} />
                            <Toggle label="Hide Voice Status Text" desc="Removes 'Voice Connected' and channel name details." value={s.hideVoiceStatus} onChange={v => set("hideVoiceStatus", v)} />
                            <Toggle label="Hide Network Ping Icon" value={s.hidePingIcon} onChange={v => set("hidePingIcon", v)} />
                        </Card>
                    </>}

                    {tab === "style" && <>
                        <SectionLabel>Aesthetics</SectionLabel>
                        <Card>
                            <Dropdown label="Button Base Style" options={BUTTON_STYLES} value={s.buttonStyle} onChange={v => set("buttonStyle", v)} />
                            <Dropdown label="Interaction Hover Effect" options={HOVER_EFFECTS} value={s.hoverEffect} onChange={v => set("hoverEffect", v)} />
                        </Card>

                        <SectionLabel>Colorful Plugins</SectionLabel>
                        <Card>
                            <Toggle label="Active Button Blobs" desc="Gives enabled plugins distinct colored rounded backgrounds (e.g. Red for Game Activity, Green for Fake States)." value={s.colorfulActiveButtons} onChange={v => set("colorfulActiveButtons", v)} />
                        </Card>
                    </>}

                    {tab === "colors" && <>
                        <SectionLabel>Panel Colors</SectionLabel>
                        <Card>
                            <ColorRow label="Panel Background Color" value={s.panelBackgroundColor} onChange={v => set("panelBackgroundColor", v)} />
                        </Card>
                    </>}

                    {tab === "hide" && <>
                        <SectionLabel>Standard Buttons</SectionLabel>
                        <Card>
                            <Toggle label="Hide Mute" value={s.hideMute} onChange={v => set("hideMute", v)} />
                            <Toggle label="Hide Deafen" value={s.hideDeafen} onChange={v => set("hideDeafen", v)} />
                            <Toggle label="Hide User Settings" value={s.hideSettings} onChange={v => set("hideSettings", v)} />
                        </Card>

                        <SectionLabel>Call Buttons</SectionLabel>
                        <Card>
                            <Toggle label="Hide Camera" value={s.hideCamera} onChange={v => set("hideCamera", v)} />
                            <Toggle label="Hide Screen Share" value={s.hideScreenShare} onChange={v => set("hideScreenShare", v)} />
                            <Toggle label="Hide Activity" value={s.hideActivity} onChange={v => set("hideActivity", v)} />
                        </Card>
                    </>}

                </div>
            </ModalContent>

            <ModalFooter style={{ padding: "16px 24px", backgroundColor: "transparent", borderTop: "none" }}>
                <Button color={Button.Colors.BRAND} onClick={() => modalProps.onClose()} style={{ width: "100%" }}>Done</Button>
            </ModalFooter>
        </ModalRoot>
    );
}

// ─── Panel Button ─────────────────────────────────────────────────────────────

function LayoutIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
    return (
        <svg className={className} style={style} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z" />
        </svg>
    );
}

function PanelLayoutButton({ iconForeground, hideTooltips, nameplate }: UserAreaRenderProps) {
    return (
        <UserAreaButton
            tooltipText={hideTooltips ? void 0 : "Panel Layout"}
            icon={<LayoutIcon className={iconForeground} />}
            role="button"
            plated={nameplate != null}
            onClick={() => openModal(modalProps => <PanelLayoutModal modalProps={modalProps} />)}
        />
    );
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default definePlugin({
    name: "deraculpanellayout",
    description: "Customize the layout, style, and visibility of panel and call buttons.",
    authors: [{ name: "deracul", id: 1454268753629024529n }],
    dependencies: ["UserSettingsAPI"],
    settings,

    userAreaButton: { icon: LayoutIcon, render: PanelLayoutButton },

    start() { apply(); },
    stop()  { document.getElementById(STYLE_ID)?.remove(); }
});
