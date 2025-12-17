/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  findGroupChildrenByChildId,
  NavContextMenuPatchCallback,
} from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { showNotification } from "@api/Notifications";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, Menu, RestAPI, UserStore } from "@webpack/common";
import { Channel } from "discord-types/general";

// State of locked groups
const lockedGroups = new Set<string>();

const settings = definePluginSettings({
  showNotifications: {
    type: OptionType.BOOLEAN,
    description: "Show notifications for actions",
    default: true,
  },
  debugMode: {
    type: OptionType.BOOLEAN,
    description: "Debug mode (detailed logs)",
    default: false,
  },
});

// Log function with prefix
function log(message: string, level: "info" | "warn" | "error" = "info") {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = `[LockGroup ${timestamp}]`;

  switch (level) {
    case "warn":
      console.warn(prefix, message);
      break;
    case "error":
      console.error(prefix, message);
      break;
    default:
      console.log(prefix, message);
  }
}

// Debug function
function debugLog(message: string) {
  if (settings.store.debugMode) {
    log(`🔍 DEBUG: ${message}`);
  }
}

// Intercept member addition attempts
function interceptAddMember(originalMethod: any) {
  return function (this: any, ...args: any[]) {
    const [requestData] = args;

    // Check if it's a request to add a member to a group
    // Format: PUT /channels/{channelId}/recipients/{userId}
    if (requestData?.url?.match(/^\/channels\/\d+\/recipients\/\d+$/)) {
      const urlParts = requestData.url.split("/");
      const channelId = urlParts[2]; // /channels/{channelId}/recipients/{userId}
      const targetUserId = urlParts[4];

      // Check if the group is locked
      if (lockedGroups.has(channelId)) {
        const channel = ChannelStore.getChannel(channelId);
        const currentUserId = UserStore.getCurrentUser()?.id;

        debugLog(`Detection of addition in locked group:
- Channel: ${channelId}
- Target user: ${targetUserId}
- Group locked: YES
- Channel owner: ${channel?.ownerId}
- Current user: ${currentUserId}`);

        // Check if it's a DM group and if the current user is the owner
        if (
          channel &&
          channel.type === 3 &&
          channel.ownerId === currentUserId
        ) {
          const channelName = channel.name || "Unnamed group";

          // Allow owner to add members
          debugLog(`✅ Owner authorized to add members to "${channelName}"`);

          if (settings.store.showNotifications && settings.store.debugMode) {
            showNotification({
              title: "🔒 LockGroup - Addition authorized",
              body: `Owner authorized to add a member to "${channelName}"`,
              icon: undefined,
            });
          }

          // Let the owner's request through
          return originalMethod.apply(this, args);
        }

        // If it's not the owner, schedule the kick
        if (channel && channel.type === 3) {
          const channelName = channel.name || "Unnamed group";
          log(
            `🚫 Unauthorized addition detected in "${channelName}" - Auto-kick scheduled`
          );

          // Schedule kick after 100ms
          setTimeout(async () => {
            try {
              debugLog(`🦶 Attempting automatic kick of ${targetUserId}`);

              await RestAPI.del({
                url: `/channels/${channelId}/recipients/${targetUserId}`,
              });

              log(
                `✅ User ${targetUserId} automatically kicked from locked group`
              );

              if (settings.store.showNotifications) {
                showNotification({
                  title: "🔒 LockGroup - Auto-kick",
                  body: `Unauthorized member removed from locked group "${channelName}"`,
                  icon: undefined,
                });
              }
            } catch (error) {
              log(`❌ Error during automatic kick: ${error}`, "error");
            }
          }, 100);

          if (settings.store.showNotifications) {
            showNotification({
              title: "🔒 LockGroup - Unauthorized addition",
              body: `Unauthorized addition detected in "${channelName}" - Auto-kick in progress...`,
              icon: undefined,
            });
          }
        }
      }
    }

    return originalMethod.apply(this, args);
  };
}

// Function to enable/disable group locking
function toggleGroupLock(channelId: string) {
  const channel = ChannelStore.getChannel(channelId);
  const currentUserId = UserStore.getCurrentUser()?.id;

  if (!channel) {
    log("Channel not found", "error");
    return;
  }

  if (channel.type !== 3) {
    // 3 = GROUP_DM
    log("This is not a DM group", "error");
    return;
  }

  if (!currentUserId) {
    log("Unable to get current user ID", "error");
    return;
  }

  const channelName = channel.name || "Unnamed group";

  // Check if user is the group owner
  if (channel.ownerId !== currentUserId) {
    log("❌ Only the group owner can use this function", "error");

    if (settings.store.showNotifications) {
      showNotification({
        title: "❌ LockGroup",
        body: "Only the group owner can lock/unlock the group",
        icon: undefined,
      });
    }
    return;
  }

  const isCurrentlyLocked = lockedGroups.has(channelId);

  if (isCurrentlyLocked) {
    // Unlock the group
    lockedGroups.delete(channelId);
    log(`🔓 Group "${channelName}" unlocked`);

    if (settings.store.showNotifications) {
      showNotification({
        title: "🔓 LockGroup",
        body: `Group "${channelName}" unlocked - Member addition allowed`,
        icon: undefined,
      });
    }
  } else {
    // Lock the group
    lockedGroups.add(channelId);
    log(`🔒 Group "${channelName}" locked`);

    if (settings.store.showNotifications) {
      showNotification({
        title: "🔒 LockGroup",
        body: `Group "${channelName}" locked - Member addition blocked`,
        icon: undefined,
      });
    }
  }

  debugLog(`Locked groups state: ${Array.from(lockedGroups).join(", ")}`);
}

// Group context menu patch
const GroupContextMenuPatch: NavContextMenuPatchCallback = (
  children,
  { channel }: { channel: Channel }
) => {
  if (!channel || channel.type !== 3) return; // 3 = GROUP_DM

  const currentUserId = UserStore.getCurrentUser()?.id;
  const isOwner = channel.ownerId === currentUserId;

  // Don't show the option if user is not owner
  if (!isOwner) return;

  const isLocked = lockedGroups.has(channel.id);
  const group = findGroupChildrenByChildId("leave-channel", children);

  if (group) {
    const menuItems = [<Menu.MenuSeparator key="separator" />];

    // Option to lock (only if not locked)
    if (!isLocked) {
      menuItems.push(
        <Menu.MenuItem
          key="lock-group"
          id="vc-lock-group"
          label="🔒 Lock the group"
          color="danger"
          action={() => toggleGroupLock(channel.id)}
          icon={() => (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h2c0-1.66 1.34-3 3-3s3 1.34 3 3v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2z" />
            </svg>
          )}
        />
      );
    }

    // Option to unlock (only if locked)
    if (isLocked) {
      menuItems.push(
        <Menu.MenuItem
          key="unlock-group"
          id="vc-unlock-group"
          label="🔓 Unlock the group"
          color="brand"
          action={() => toggleGroupLock(channel.id)}
          icon={() => (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z" />
            </svg>
          )}
        />
      );
    }

    group.push(...menuItems);
  }
};

// Variable to store the original method
let originalPutMethod: any = null;

export default definePlugin({
  name: "LockGroup",
  description:
    "Allows locking/unlocking groups via context menu (prevents adding members)",
  authors: [
    {
      name: "Bash",
      id: 1327483363518582784n,
    },
  , TestcordDevs.x2b],
  dependencies: ["ContextMenuAPI"],
  settings,

  contextMenus: {
    "gdm-context": GroupContextMenuPatch,
  },

  flux: {
    // Monitor messages to detect member additions
    MESSAGE_CREATE(event: { message: any }) {
      const { message } = event;
      const currentUserId = UserStore.getCurrentUser()?.id;

      // Check if it's a member addition message (type 1)
      if (message && message.type === 1) {
        // RECIPIENT_ADD
        const channelId = message.channel_id;

        if (lockedGroups.has(channelId)) {
          const channel = ChannelStore.getChannel(channelId);

          if (
            channel &&
            channel.type === 3 &&
            channel.ownerId === currentUserId
          ) {
            const channelName = channel.name || "Unnamed group";
            const addedUserId = message.mentions?.[0]?.id;
            const addedByUserId = message.author?.id;

            log(`📨 Addition message detected in "${channelName}"`);
            debugLog(
              `Added by: ${addedByUserId}, User added: ${addedUserId}, Owner: ${currentUserId}`
            );

            // If addition was done by owner, don't kick
            if (addedByUserId === currentUserId) {
              debugLog(`✅ Addition made by owner - Authorized`);

              if (
                settings.store.showNotifications &&
                settings.store.debugMode
              ) {
                showNotification({
                  title: "🔒 LockGroup - Owner addition",
                  body: `Member added by owner in "${channelName}" - Authorized`,
                  icon: undefined,
                });
              }
              return;
            }

            // If someone else added, kick
            if (addedUserId && addedByUserId !== currentUserId) {
              debugLog(
                `🚫 Unauthorized addition by ${addedByUserId} - Kick scheduled`
              );

              // Security kick for unauthorized additions
              setTimeout(async () => {
                try {
                  await RestAPI.del({
                    url: `/channels/${channelId}/recipients/${addedUserId}`,
                  });
                  log(
                    `🔒 Security kick performed for ${addedUserId} (added by ${addedByUserId})`
                  );
                } catch (error) {
                  debugLog(`Security kick error: ${error}`);
                }
              }, 150);

              if (settings.store.showNotifications) {
                showNotification({
                  title: "🔒 LockGroup - Unauthorized addition",
                  body: `Member added without authorization in "${channelName}" then removed`,
                  icon: undefined,
                });
              }
            }
          }
        }
      }
    },
  },

  start() {
    log("🚀 LockGroup plugin started");
    debugLog(`Current configuration:
- Notifications: ${settings.store.showNotifications ? "ON" : "OFF"}
- Debug: ${settings.store.debugMode ? "ON" : "OFF"}`);

    // Intercept REST API methods
    if (RestAPI && RestAPI.put) {
      originalPutMethod = RestAPI.put;
      RestAPI.put = interceptAddMember(originalPutMethod);
      debugLog("REST API interception configured");
    }

    if (settings.store.showNotifications) {
      showNotification({
        title: "🔒 LockGroup enabled",
        body: "Right-click on a group to lock/unlock it",
        icon: undefined,
      });
    }
  },

  stop() {
    log("🛑 LockGroup plugin stopped");

    // Restore original method
    if (originalPutMethod && RestAPI) {
      RestAPI.put = originalPutMethod;
      originalPutMethod = null;
      debugLog("REST API interception restored");
    }

    // Clean up state
    lockedGroups.clear();

    if (settings.store.showNotifications) {
      showNotification({
        title: "🔒 LockGroup disabled",
        body: "All locks have been removed",
        icon: undefined,
      });
    }
  },
});


