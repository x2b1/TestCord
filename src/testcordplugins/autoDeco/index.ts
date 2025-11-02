import definePlugin, { OptionType } from "@utils/types";
import { NavContextMenuPatchCallback, addContextMenuPatch, removeContextMenuPatch } from "@api/ContextMenu";
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
        description: "Activer AutoDeco"
    }
});

let targetUserId: string | null = null;
let lastProcessedStates: Map<string, string | null> = new Map();

const UserContextMenuPatch: NavContextMenuPatchCallback = (children, { user }: { user: User; }) => {
    const currentUser = UserStore.getCurrentUser();
    if (!user || user.id === currentUser.id) return;
    const [checked, setChecked] = React.useState(targetUserId === user.id);
    children.push(
        React.createElement(Menu.MenuSeparator, {}),
        React.createElement(Menu.MenuCheckboxItem, {
            id: "autodeco-context",
            label: checked ? "Désactiver AutoDeco" : "Activer AutoDeco",
            checked,
            action: () => {
                if (checked) {
                    targetUserId = null;
                    setChecked(false);
                    showNotification({ title: "AutoDeco", body: `AutoDeco désactivé pour ${user.username}` });
                } else {
                    targetUserId = user.id;
                    setChecked(true);
                    showNotification({ title: "AutoDeco", body: `AutoDeco activé pour ${user.username}` });
                }
            }
        })
    );
};

export default definePlugin({
    name: "AutoDeco",
    description: "Se déconnecte automatiquement du canal vocal lorsqu'un utilisateur spécifique rejoint",
    authors: [{ name: "Bash", id: 1327483363518582784n }],
    settings,
    contextMenus: {
        "user-context": UserContextMenuPatch
    },
    flux: {
        async VOICE_STATE_UPDATES({ voiceStates }) {
            if (!targetUserId || !settings.store.enabled) return;
            const currentUserId = UserStore.getCurrentUser().id;
            const currentChannelId = SelectedChannelStore.getVoiceChannelId();

            for (const state of voiceStates) {
                if (state.userId === targetUserId) {
                    const previousChannelId = lastProcessedStates.get(state.userId);

                    // Vérifier si l'utilisateur vient de rejoindre notre canal vocal
                    if (
                        state.channelId &&
                        currentChannelId &&
                        state.channelId === currentChannelId &&
                        previousChannelId !== currentChannelId
                    ) {
                        // L'utilisateur cible vient de rejoindre le même canal vocal que nous
                        console.log("AutoDeco: Déconnexion automatique déclenchée", {
                            targetUser: state.user?.username,
                            channelId: state.channelId,
                            currentChannelId,
                            previousChannelId
                        });

                        // Utiliser FluxDispatcher pour se déconnecter (plus fiable)
                        FluxDispatcher.dispatch({
                            type: "VOICE_CHANNEL_SELECT",
                            channelId: null
                        });
                        showNotification({
                            title: "AutoDeco",
                            body: `Déconnexion automatique : ${state.user?.username || "Utilisateur"} a rejoint votre canal vocal`
                        });
                    }

                    // Mettre à jour l'état précédent
                    lastProcessedStates.set(state.userId, state.channelId);
                }
            }
        }
    },
    start() { },
    stop() {
        targetUserId = null;
        lastProcessedStates.clear();
    }
});
