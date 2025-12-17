import definePlugin, { OptionType } from "@utils/types";
import {
  NavContextMenuPatchCallback,
  addContextMenuPatch,
  removeContextMenuPatch,
} from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { showNotification } from "@api/Notifications";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { Menu, React, FluxDispatcher } from "@webpack/common";
import { Channel, User } from "discord-types/general";

const VoiceActions = findByPropsLazy("leaveChannel");
const VoiceStateStore = findStoreLazy("VoiceStateStore");
const UserStore = findStoreLazy("UserStore");
const SelectedChannelStore = findStoreLazy("SelectedChannelStore");

const settings = definePluginSettings({
  enabled: {
    type: OptionType.BOOLEAN,
    default: true,
    description: "Enable AutoDeco",
  },
});

let targetUserId: string | null = null;
let lastProcessedStates: Map<string, string | null> = new Map();

const UserContextMenuPatch: NavContextMenuPatchCallback = (
  children,
  { user }: { user: User }
) => {
  const currentUser = UserStore.getCurrentUser();
  if (!user || user.id === currentUser.id) return;
  const [checked, setChecked] = React.useState(targetUserId === user.id);
  children.push(
    React.createElement(Menu.MenuSeparator, {}),
    React.createElement(Menu.MenuCheckboxItem, {
      id: "autodeco-context",
      label: checked ? "Disable AutoDeco" : "Enable AutoDeco",
      checked,
      action: () => {
        if (checked) {
          targetUserId = null;
          setChecked(false);
          showNotification({
            title: "AutoDeco",
            body: `AutoDeco disabled for ${user.username}`,
          });
        } else {
          targetUserId = user.id;
          setChecked(true);
          showNotification({
            title: "AutoDeco",
            body: `AutoDeco enabled for ${user.username}`,
          });
        }
      },
    })
  );
};

export default definePlugin({
  name: "AutoDeco",
  description:
    "Automatically disconnects from voice channel when a specific user joins",
  authors: [{ name: "Bash", id: 1327483363518582784n }, TestcordDevs.x2b],
  settings,
  contextMenus: {
    "user-context": UserContextMenuPatch,
  },
  flux: {
    async VOICE_STATE_UPDATES({ voiceStates }) {
      if (!targetUserId || !settings.store.enabled) return;
      const currentUserId = UserStore.getCurrentUser().id;
      const currentChannelId = SelectedChannelStore.getVoiceChannelId();

      for (const state of voiceStates) {
        if (state.userId === targetUserId) {
          const previousChannelId = lastProcessedStates.get(state.userId);

          // Check if the user just joined our voice channel
          if (
            state.channelId &&
            currentChannelId &&
            state.channelId === currentChannelId &&
            previousChannelId !== currentChannelId
          ) {
            // Target user just joined the same voice channel as us
            console.log("AutoDeco: Automatic disconnection triggered", {
              targetUser: state.user?.username,
              channelId: state.channelId,
              currentChannelId,
              previousChannelId,
            });

            // Use FluxDispatcher to disconnect (more reliable)
            FluxDispatcher.dispatch({
              type: "VOICE_CHANNEL_SELECT",
              channelId: null,
            });
            showNotification({
              title: "AutoDeco",
              body: `Automatic disconnection: ${
                state.user?.username || "User"
              } joined your voice channel`,
            });
          }

          // Update previous state
          lastProcessedStates.set(state.userId, state.channelId);
        }
      }
    },
  },
  start() {},
  stop() {
    targetUserId = null;
    lastProcessedStates.clear();
  },
});




