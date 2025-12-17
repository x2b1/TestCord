/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs, TestcordDevs } from "@utils/constants";
import definePlugin from "@utils/types"; // Function to register the plugin in Vencord
import { findByProps, findComponentByCodeLazy } from "@webpack"; // Helpers to find internal modules
import { React } from "@webpack/common"; // React used to create components

let originalVoiceStateUpdate: any; // Stores the original voiceStateUpdate method
let fakeDeafenEnabled = false; // Flag that indicates if "fake deafen" is active

// Generic Button component obtained via code search
const Button = findComponentByCodeLazy(".NONE,disabled:", ".PANEL_BUTTON");

/** Icon that changes color when fake deafen is enabled/disabled */
function FakeDeafenIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      {/* Hat */}
      <rect
        x="6"
        y="8"
        width="20"
        height="4"
        rx="2"
        fill={fakeDeafenEnabled ? "#fff" : "#888"}
      />
      <rect
        x="11"
        y="3"
        width="10"
        height="8"
        rx="3"
        fill={fakeDeafenEnabled ? "#fff" : "#888"}
      />
      {/* Glasses */}
      <circle
        cx="10"
        cy="21"
        r="4"
        stroke={fakeDeafenEnabled ? "#fff" : "#888"}
        strokeWidth="2"
        fill="none"
      />
      <circle
        cx="22"
        cy="21"
        r="4"
        stroke={fakeDeafenEnabled ? "#fff" : "#888"}
        strokeWidth="2"
        fill="none"
      />
      {/* Bridge of glasses */}
      <path
        d="M14 21c1 1 3 1 4 0"
        stroke={fakeDeafenEnabled ? "#fff" : "#888"}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Button component that enables/disables fake deafen */
function FakeDeafenButton() {
  return (
    <Button
      tooltipText={
        fakeDeafenEnabled ? "Disable Fake Deafen" : "Enable Fake Deafen"
      }
      icon={FakeDeafenIcon}
      role="switch"
      aria-checked={fakeDeafenEnabled}
      redGlow={fakeDeafenEnabled}
      onClick={() => {
        // Toggle state
        fakeDeafenEnabled = !fakeDeafenEnabled;

        // Get necessary stores
        const ChannelStore = findByProps("getChannel", "getDMFromUserId");
        const SelectedChannelStore = findByProps("getVoiceChannelId");
        const GatewayConnection = findByProps(
          "voiceStateUpdate",
          "voiceServerPing"
        );
        const MediaEngineStore = findByProps("isDeaf", "isMute");

        if (
          ChannelStore &&
          SelectedChannelStore &&
          GatewayConnection &&
          typeof GatewayConnection.voiceStateUpdate === "function"
        ) {
          const channelId = SelectedChannelStore.getVoiceChannelId?.();
          const channel = channelId
            ? ChannelStore.getChannel?.(channelId)
            : null;

          if (channel) {
            if (fakeDeafenEnabled) {
              // When enabling, force fake mute+deaf
              GatewayConnection.voiceStateUpdate({
                channelId: channel.id,
                guildId: channel.guild_id,
                selfMute: true,
                selfDeaf: true,
              });
            } else {
              // When disabling, restore user's real state
              const selfMute = MediaEngineStore?.isMute?.() ?? false;
              const selfDeaf = MediaEngineStore?.isDeaf?.() ?? false;
              GatewayConnection.voiceStateUpdate({
                channelId: channel.id,
                guildId: channel.guild_id,
                selfMute,
                selfDeaf,
              });
            }
          }
        }
      }}
    />
  );
}

// Plugin registration
export default definePlugin({
  name: "FakeDeafen",
  description: "Fake deafen - no need to explain much, just open and try it.",
  authors: [Devs.feelslove, TestcordDevs.x2b],
  patches: [
    {
      // Inject button into "speaking while muted" UI
      find: "#{intl::ACCOUNT_SPEAKING_WHILE_MUTED}",
      replacement: {
        match: /className:\i\.buttons,.{0,50}children:\[/,
        replace: "$&$self.FakeDeafenButton(),",
      },
    },
  ],
  FakeDeafenButton, // Expose component for patch
  start() {
    // On start, override voiceStateUpdate to always apply fakeDeafenEnabled
    const GatewayConnection = findByProps(
      "voiceStateUpdate",
      "voiceServerPing"
    );
    if (
      !GatewayConnection ||
      typeof GatewayConnection.voiceStateUpdate !== "function"
    ) {
      console.warn("[FakeDeafen] GatewayConnection.voiceStateUpdate not found");
    } else {
      originalVoiceStateUpdate = GatewayConnection.voiceStateUpdate;
      GatewayConnection.voiceStateUpdate = function (args) {
        if (fakeDeafenEnabled && args && typeof args === "object") {
          args.selfMute = true;
          args.selfDeaf = true;
        }
        return originalVoiceStateUpdate.apply(this, arguments);
      };
    }
  },
  stop() {
    // On stop, restore original method
    const GatewayConnection = findByProps(
      "voiceStateUpdate",
      "voiceServerPing"
    );
    if (GatewayConnection && originalVoiceStateUpdate) {
      GatewayConnection.voiceStateUpdate = originalVoiceStateUpdate;
    }
  },
});


