import definePlugin, { OptionType } from "@utils/types";
import { Toasts, FluxDispatcher, UserStore, ChannelStore } from "@webpack/common";
import { definePluginSettings } from "@api/Settings";
import { findStoreLazy, findByPropsLazy } from "@webpack";
import { Menu, React } from "@webpack/common";
import { ModalContent, ModalFooter, ModalHeader, ModalProps, ModalSize, ModalRoot, openModal } from "@utils/modal";
import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { getCurrentGuild } from "@utils/discord";
import { Button, TextInput, Forms } from "@webpack/common";

const Flex = ({ children, style, ...props }: React.PropsWithChildren<{ style?: React.CSSProperties; }>) => (
    <div style={{ display: "flex", ...style }} {...props}>{children}</div>
);

const vc = findStoreLazy("VoiceStateStore");
const voiceshit = findByPropsLazy("getVoiceChannelId");
let veryimportantmap = new Set<string>();

const settings = definePluginSettings({
    guildidetectionslol: {
        description: "Guild detection data",
        type: OptionType.STRING,
        default: "",
    },
    amivcowner: {
        description: "Am I the VC owner",
        type: OptionType.BOOLEAN,
        default: false,
    },
});

function checkvcownerlol(guildId: string, channelId?: string) {
    if (!guildId || !channelId) {
        Toasts.show({
            message: "No guild or channel found!",
            id: `atticus-error-${Date.now()}`,
            type: Toasts.Type.FAILURE,
            options: {
                position: Toasts.Position.BOTTOM,
                duration: 2000
            }
        });
        return;
    }

    const guildDetectionSettings = isValidJson(settings.store.guildidetectionslol) as guildidetectionslol[];
    const guildSetting = guildDetectionSettings.find(g => g.name === guildId);

    if (!guildSetting) {
        Toasts.show({
            message: "This guild is not configured for VC owner detection!",
            id: `atticus-not-configured-${Date.now()}`,
            type: Toasts.Type.MESSAGE,
            options: {
                position: Toasts.Position.BOTTOM,
                duration: 2000
            }
        });
        return;
    }

    const channel = ChannelStore.getChannel(channelId);
    if (!channel?.permissionOverwrites) {
        Toasts.show({
            message: "No permission overwrites found in this channel!",
            id: `atticus-no-perms-${Date.now()}`,
            type: Toasts.Type.MESSAGE,
            options: {
                position: Toasts.Position.BOTTOM,
                duration: 2000
            }
        });
        return;
    }

    const permissions = Object.values(channel.permissionOverwrites);
    const currentUserId = UserStore.getCurrentUser().id;
    const permRequirement = guildSetting.permrequirements;
    let ownerFound = false;
    let ownerName = "";

    permissions.forEach((perm: any) => {
        const { id, allow } = perm;

        try {
            const allowBigInt = toBigIntSafe(allow);
            const reqBigInt = toBigIntSafe(permRequirement);

            if (allowBigInt === reqBigInt) {
                const user = UserStore.getUser(id);
                if (user) {
                    ownerFound = true;

                    // Try to get guild member info for server nickname
                    const guild = getCurrentGuild();
                    let memberInfo = null;
                    if (guild) {
                        try {
                            // Try to get guild member store
                            const GuildMemberStore = findStoreLazy("GuildMemberStore");
                            memberInfo = GuildMemberStore?.getMember(guild.id, id);
                        } catch (e) {
                            console.log("Could not get guild member info");
                        }
                    }

                    // Priority: server nickname > global display name > username
                    ownerName = (memberInfo?.nick) || user.globalName || user.displayName || user.username || "Unknown User";

                    const cleanId = id.toString().replace(/[^0-9]/g, "");
                    veryimportantmap.add(cleanId);

                    if (id === currentUserId) {
                        settings.store.amivcowner = true;
                    }

                    Toasts.show({
                        message: `Current VC Owner: ${ownerName}`,
                        id: `atticus-owner-found-${Date.now()}`,
                        type: Toasts.Type.SUCCESS,
                        options: {
                            position: Toasts.Position.BOTTOM,
                            duration: 2000
                        }
                    });
                }
            }
        } catch (e) {
            console.error("Permission conversion error:", e);
        }
    });

    if (!ownerFound) {
        Toasts.show({
            message: "No VC owner found with the configured permissions!",
            id: `atticus-no-owner-${Date.now()}`,
            type: Toasts.Type.MESSAGE,
            options: {
                position: Toasts.Position.BOTTOM,
                duration: 2000
            }
        });
    }
}

function toBigIntSafe(value: any): bigint {
    if (typeof value === "bigint") return value;
    if (typeof value === "number") return BigInt(value);
    if (typeof value === "string") return BigInt(value.replace(/n$/, "").trim());
    return BigInt(0);
}

function ChannelMenuItem(guildId: string, channelId?: string) {
    return (
        <Menu.MenuItem
            id="Check-Owner"
            label="Check VC Owner"
            color="brand"
            action={() => {
                checkvcownerlol(guildId, channelId);
            }}
        />
    );
}

function ChannelMakeContextMenuPatch(): NavContextMenuPatchCallback {
    return (children, props) => {
        if (!props?.guild?.id || !props?.channel?.id) return;

        const group = findGroupChildrenByChildId(["mark-channel-read"], children);
        if (!group) return;

        const vcownercheck = ChannelMenuItem(props.guild.id, props.channel.id);
        group.push(vcownercheck);
    };
}

function Kbind(e: KeyboardEvent) {
    if (e.altKey && e.key.toLowerCase() === 'v') {
        openModal(modalProps => <EncModals modalProps={modalProps} />);
    }
}

let clientOldChannelId: string | undefined;

export default definePlugin({
    name: "vcOwnerDetector",
    description: "Tools to detect the owner of VC",
    authors: [{ name: "dot", id: 1400610916285812776n }],
    settings,

    contextMenus: {
        "channel-context": ChannelMakeContextMenuPatch(),
    },

    start() {
        try {
            FluxDispatcher.subscribe("VOICE_STATE_UPDATES", this.handleVoiceStateUpdate);
            document.addEventListener('keydown', Kbind);
            this.initializePlugin();
        } catch (e) {
            console.error("Plugin start error:", e);
        }
    },

    stop() {
        try {
            FluxDispatcher.unsubscribe("VOICE_STATE_UPDATES", this.handleVoiceStateUpdate);
            document.removeEventListener('keydown', Kbind);
        } catch (e) {
            console.error("Plugin stop error:", e);
        }
    },

    handleVoiceStateUpdate({ voiceStates }: { voiceStates: any[]; }) {
        const clientUserId = UserStore.getCurrentUser().id;

        voiceStates.forEach(state => {
            const { userId, channelId, guildId } = state;
            let { oldChannelId } = state;

            if (userId === clientUserId && channelId !== clientOldChannelId) {
                oldChannelId = clientOldChannelId;
                clientOldChannelId = channelId;

                // User joined a new VC or switched channels - trigger owner check notification
                if (channelId && oldChannelId !== channelId) {
                    setTimeout(() => {
                        checkvcownerlol(guildId, channelId);
                    }, 1000); // Small delay to ensure everything is loaded
                }
            }

            if (oldChannelId === channelId) return;

            if (veryimportantmap.has(userId)) {
                veryimportantmap.delete(userId);
            }

            if ((oldChannelId && !channelId) && (userId === clientUserId)) {
                if (settings.store.amivcowner) {
                    console.log("You (owner) left VC");
                    settings.store.amivcowner = false;
                }
            }
        });
    },

    initializePlugin() {
        settings.store.amivcowner = false;

        // Add CSS for yellow username
        if (!document.getElementById('vc-owner-styles')) {
            const style = document.createElement('style');
            style.id = 'vc-owner-styles';
            style.textContent = `
                .vc-owner-yellow {
                    color: #fbbf24 !important;
                    font-weight: bold !important;
                }
            `;
            document.head.appendChild(style);
        }

        // Check VC ownership periodically (but don't show toasts)
        setInterval(() => {
            try {
                const guild = getCurrentGuild();
                if (!guild) return;

                const voiceState = vc?.getVoiceStateForUser?.(UserStore.getCurrentUser().id);
                if (!voiceState?.channelId) return;

                // Silent check - only update internal state, no toasts
                this.silentOwnerCheck(guild.id, voiceState.channelId);
            } catch (e) {
                console.error("Periodic check error:", e);
            }
        }, 2000);
    },

    silentOwnerCheck(guildId: string, channelId?: string) {
        if (!guildId || !channelId) return;

        const guildDetectionSettings = isValidJson(settings.store.guildidetectionslol) as guildidetectionslol[];
        const guildSetting = guildDetectionSettings.find(g => g.name === guildId);

        if (guildSetting) {
            const channel = ChannelStore.getChannel(channelId);
            if (!channel?.permissionOverwrites) return;

            const permissions = Object.values(channel.permissionOverwrites);
            const currentUserId = UserStore.getCurrentUser().id;
            const permRequirement = guildSetting.permrequirements;

            permissions.forEach((perm: any) => {
                const { id, allow } = perm;

                try {
                    const allowBigInt = toBigIntSafe(allow);
                    const reqBigInt = toBigIntSafe(permRequirement);

                    if (allowBigInt === reqBigInt) {
                        const cleanId = id.toString().replace(/[^0-9]/g, "");
                        veryimportantmap.add(cleanId);

                        if (id === currentUserId) {
                            settings.store.amivcowner = true;
                        }
                    }
                } catch (e) {
                    console.error("Permission conversion error:", e);
                }
            });
        }
    },

    patches: [
        {
            find: ".usernameSpeaking",
            replacement: {
                match: /(className:)([^,}]+)(username[^,}]*)/,
                replace: "$1$self.addOwnerClass($2$3)"
            }
        }
    ],

    addOwnerClass(originalClass: string) {
        const currentUser = UserStore.getCurrentUser();
        if (!currentUser) return originalClass;

        const isOwner = veryimportantmap.has(currentUser.id);
        return isOwner ? `${originalClass} vc-owner-yellow` : originalClass;
    }
});

function isValidJson(data: string): any[] {
    try {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

interface guildidetectionslol {
    name: string;
    permrequirements: string;
}

function EncModals({ modalProps }: { modalProps: ModalProps; }) {
    const [guildidetectionslol, setguildidetectionslol] = React.useState<guildidetectionslol[]>(
        isValidJson(settings.store.guildidetectionslol)
    );
    const [guildids, setguildids] = React.useState("");
    const [permrequirements, setpermrequirements] = React.useState("");

    const handleAddGuild = () => {
        if (!guildids.trim()) return;

        const newGuild: guildidetectionslol = {
            name: guildids.trim(),
            permrequirements: permrequirements.trim()
        };

        const newList = [...guildidetectionslol, newGuild];
        setguildidetectionslol(newList);
        settings.store.guildidetectionslol = JSON.stringify(newList);
        setguildids("");
        setpermrequirements("");
    };

    const handleUpdateGuild = (index: number, field: keyof guildidetectionslol, value: string) => {
        const updatedList = [...guildidetectionslol];
        updatedList[index][field] = value;
        setguildidetectionslol(updatedList);
        settings.store.guildidetectionslol = JSON.stringify(updatedList);
    };

    const handleRemoveGuild = (index: number) => {
        const filteredList = guildidetectionslol.filter((_, i) => i !== index);
        setguildidetectionslol(filteredList);
        settings.store.guildidetectionslol = JSON.stringify(filteredList);
    };

    return (
        <ModalRoot {...modalProps} size={ModalSize.LARGE}>
            <ModalHeader>
                <Forms.FormTitle tag="h4">VC Owner Detection Settings</Forms.FormTitle>
            </ModalHeader>

            <ModalContent>
                <Flex style={{ gap: "10px", marginBottom: "20px", flexDirection: "column" }}>
                    <Forms.FormTitle tag="h5">Add New Guild</Forms.FormTitle>
                    <Flex style={{ gap: "10px", flexDirection: "row" }}>
                        <TextInput
                            value={guildids}
                            placeholder="Guild ID"
                            onChange={setguildids}
                        />
                        <TextInput
                            value={permrequirements}
                            placeholder="Permission Requirements"
                            onChange={setpermrequirements}
                        />
                        <Button onClick={handleAddGuild}>
                            Add Guild
                        </Button>
                    </Flex>
                </Flex>

                {guildidetectionslol.length > 0 && (
                    <Flex style={{ flexDirection: "column" }}>
                        <Forms.FormTitle tag="h5">Current Guilds</Forms.FormTitle>
                        {guildidetectionslol.map((guild, index) => (
                            <Flex key={index} style={{ gap: "10px", flexDirection: "row", marginBottom: "10px", alignItems: "center" }}>
                                <TextInput
                                    value={guild.name}
                                    placeholder="Guild ID"
                                    onChange={(value: string) => handleUpdateGuild(index, "name", value)}
                                />
                                <TextInput
                                    value={guild.permrequirements}
                                    placeholder="Permission Requirements"
                                    onChange={(value: string) => handleUpdateGuild(index, "permrequirements", value)}
                                />
                                <Button
                                    color={Button.Colors.RED}
                                    onClick={() => handleRemoveGuild(index)}
                                >
                                    Remove
                                </Button>
                            </Flex>
                        ))}
                    </Flex>
                )}
            </ModalContent>

            <ModalFooter>
                <Button
                    color={Button.Colors.GREEN}
                    onClick={modalProps.onClose}
                >
                    Close
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
}
