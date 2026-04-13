/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { TestcordDevs } from "@utils/constants";
import { openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, Menu, React, UserStore, Forms, TextInput, Button, showToast, Toasts, RestAPI } from "@webpack/common";

interface UserReactRule {
    userId: string;
    username: string;
    reactions: { name: string; id: string | null; animated: boolean; }[];
}

const settings = definePluginSettings({
    rules: {
        type: OptionType.STRING,
        description: "User reaction rules (JSON format)",
        default: "[]",
    },
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Enable UserReact functionality",
        default: true,
    },
});

function emojiToString(emoji: { name: string; id: string | null; animated: boolean; }): string {
    if (emoji.id) {
        return `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`;
    }
    return emoji.name;
}

function parseRules(rulesStr: string): UserReactRule[] {
    try {
        const parsed = JSON.parse(rulesStr);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveRules(rules: UserReactRule[]) {
    settings.store.rules = JSON.stringify(rules);
}

async function addReactionsSequentially(
    channelId: string,
    messageId: string,
    reactions: UserReactRule["reactions"]
) {
    for (const emoji of reactions) {
        try {
            const delay = Math.floor(Math.random() * 2000) + 1;
            await new Promise(resolve => setTimeout(resolve, delay));

            let emojiStr: string;
            if (emoji.id) {
                emojiStr = `${emoji.animated ? "a:" : ""}${emoji.name}:${emoji.id}`;
            } else {
                emojiStr = encodeURIComponent(emoji.name);
            }

            await RestAPI.put({
                url: `/channels/${channelId}/messages/${messageId}/reactions/${emojiStr}/@me`
            });
        } catch (e: any) {
            if (e?.status !== 404) {
                console.error("[UserReact] Failed to add reaction:", e);
            }
        }
    }
}

function handleMessageCreate(data: any) {
    const { message } = data;
    if (!message) return;

    if (!settings.store.enabled) return;

    // Ignore own messages
    if (message.author?.id === UserStore.getCurrentUser().id) return;

    const rules = parseRules(settings.store.rules);
    if (rules.length === 0) return;

    const channelId = message.channel_id;
    const messageId = message.id;

    if (!channelId || !messageId) return;

    // Find rule for this user
    const rule = rules.find(r => r.userId === message.author?.id);
    if (!rule || rule.reactions.length === 0) return;

    addReactionsSequentially(channelId, messageId, rule.reactions);
}

// Emoji Picker Modal Component
function EmojiPickerModal({ userId, username, onClose }: { userId: string; username: string; onClose: () => void; }) {
    const [selectedEmojis, setSelectedEmojis] = React.useState<{ name: string; id: string | null; animated: boolean; }[]>([]);
    const [inputValue, setInputValue] = React.useState("");

    const rules = parseRules(settings.store.rules);
    const existingRule = rules.find(r => r.userId === userId);

    React.useEffect(() => {
        if (existingRule) {
            setSelectedEmojis([...existingRule.reactions]);
        }
    }, []);

    const handleEmojiSelect = (emoji: any) => {
        const newEmoji = {
            name: emoji.name || emoji.surrogates || emoji.optionValue,
            id: emoji.id ? String(emoji.id) : null,
            animated: emoji.animated || false
        };

        // Check if already selected
        if (!selectedEmojis.find(e => e.name === newEmoji.name && e.id === newEmoji.id)) {
            setSelectedEmojis([...selectedEmojis, newEmoji]);
        }
    };

    const removeEmoji = (index: number) => {
        setSelectedEmojis(selectedEmojis.filter((_, i) => i !== index));
    };

    const saveRule = () => {
        const rules = parseRules(settings.store.rules);
        const existingIndex = rules.findIndex(r => r.userId === userId);

        if (selectedEmojis.length === 0) {
            // Remove rule if no emojis
            if (existingIndex !== -1) {
                rules.splice(existingIndex, 1);
            }
        } else {
            const newRule: UserReactRule = {
                userId,
                username,
                reactions: selectedEmojis
            };

            if (existingIndex !== -1) {
                rules[existingIndex] = newRule;
            } else {
                rules.push(newRule);
            }
        }

        saveRules(rules);
        showToast(`UserReact rule ${selectedEmojis.length === 0 ? "removed" : "saved"} for ${username}`, Toasts.Type.SUCCESS);
        onClose();
    };

    return (
        <div style={{ padding: "20px", minWidth: "400px" }}>
            <Forms.FormTitle tag="h4">UserReact: {username}</Forms.FormTitle>
            <Forms.FormText style={{ marginBottom: "16px", color: "var(--text-muted)" }}>
                Select emojis to auto-react to every message from this user
            </Forms.FormText>

            {/* Selected Emojis Display */}
            <div style={{
                padding: "12px",
                background: "var(--background-secondary)",
                borderRadius: "8px",
                marginBottom: "16px",
                minHeight: "50px",
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                alignItems: "center"
            }}>
                {selectedEmojis.length === 0 && (
                    <Forms.FormText style={{ color: "var(--text-muted)" }}>No emojis selected</Forms.FormText>
                )}
                {selectedEmojis.map((emoji, i) => (
                    <div
                        key={i}
                        style={{
                            position: "relative",
                            cursor: "pointer",
                            fontSize: "24px"
                        }}
                        onClick={() => removeEmoji(i)}
                        title="Click to remove"
                    >
                        {emoji.id
                            ? `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`
                            : emoji.name
                        }
                        <div style={{
                            position: "absolute",
                            top: "-4px",
                            right: "-4px",
                            background: "var(--red-400)",
                            borderRadius: "50%",
                            width: "14px",
                            height: "14px",
                            fontSize: "10px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white"
                        }}>×</div>
                    </div>
                ))}
            </div>

            {/* Emoji Picker */}
            <div style={{ marginBottom: "16px" }}>
                <Forms.FormText style={{ marginBottom: "8px" }}>Pick Emojis:</Forms.FormText>
                {/* Use Discord's built-in emoji picker if available, otherwise fallback to manual input */}
                <TextInput
                    value={inputValue}
                    onChange={setInputValue}
                    placeholder="Paste emoji here or use picker below"
                />
                <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {/* Common emojis as quick picks */}
                    {["👍", "❤️", "😂", "🔥", "👀", "💯", "🎉", "😎", "👌", "💪", "🙌", "✨"].map(emoji => (
                        <button
                            key={emoji}
                            onClick={() => {
                                const newEmoji = { name: emoji, id: null, animated: false };
                                if (!selectedEmojis.find(e => e.name === emoji)) {
                                    setSelectedEmojis([...selectedEmojis, newEmoji]);
                                }
                            }}
                            style={{
                                fontSize: "20px",
                                padding: "4px 8px",
                                cursor: "pointer",
                                background: "var(--background-secondary)",
                                border: "none",
                                borderRadius: "4px"
                            }}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <Button
                    color={Button.Colors.TRANSPARENT}
                    onClick={onClose}
                >
                    Cancel
                </Button>
                <Button
                    color={selectedEmojis.length > 0 ? Button.Colors.GREEN : Button.Colors.RED}
                    onClick={saveRule}
                >
                    {selectedEmojis.length > 0 ? "Save Rule" : "Remove Rule"}
                </Button>
            </div>
        </div>
    );
}

// Context Menu Component for User React
function UserContextMenuPatch(): NavContextMenuPatchCallback {
    return (children, props: any) => {
        const user = props?.user;
        if (!user || user.id === UserStore.getCurrentUser().id) return;

        const rules = parseRules(settings.store.rules);
        const hasRule = rules.some(r => r.userId === user.id);

        const openEmojiPicker = () => {
            openModal(modalProps => (
                <EmojiPickerModal
                    userId={user.id}
                    username={user.globalName || user.username}
                    onClose={() => modalProps.onClose()}
                />
            ));
        };

        children.splice(-1, 0, (
            <Menu.MenuGroup>
                <Menu.MenuItem
                    id="userreact-toggle"
                    label={hasRule ? "Edit UserReact" : "UserReact"}
                    action={openEmojiPicker}
                />
            </Menu.MenuGroup>
        ));
    };
}

// Settings Panel Component
function SettingsPanel() {
    const [rulesText, setRulesText] = React.useState(() => {
        const rules = parseRules(settings.store.rules);
        return rules.map(r => `${r.username} (${r.userId}): ${r.reactions.map(emojiToString).join(" ")}`).join("\n");
    });

    const rules = parseRules(settings.store.rules);

    return (
        <div>
            <Forms.FormTitle tag="h5" style={{ marginBottom: "12px" }}>UserReact Rules</Forms.FormTitle>
            <Forms.FormText style={{ marginBottom: "8px", color: "var(--text-muted)" }}>
                Right-click on a user and select "UserReact" to add or edit rules
            </Forms.FormText>
            <Forms.FormText style={{ marginBottom: "16px", color: "var(--text-muted)" }}>
                Currently configured for <strong>{rules.length} {rules.length === 1 ? "user" : "users"}</strong>
            </Forms.FormText>

            {rules.length > 0 ? (
                <div style={{
                    padding: "12px",
                    background: "var(--background-secondary)",
                    borderRadius: "8px",
                    marginBottom: "16px"
                }}>
                    {rules.map((rule, i) => (
                        <div key={i} style={{
                            padding: "8px",
                            marginBottom: "8px",
                            background: "var(--background-tertiary)",
                            borderRadius: "4px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                        }}>
                            <div>
                                <Forms.FormText style={{ fontWeight: 600 }}>
                                    {rule.username}
                                </Forms.FormText>
                                <Forms.FormText style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                                    {rule.reactions.map(emojiToString).join(" ")}
                                </Forms.FormText>
                            </div>
                            <Button
                                color={Button.Colors.RED}
                                size={Button.Sizes.SMALL}
                                onClick={() => {
                                    const newRules = parseRules(settings.store.rules);
                                    newRules.splice(i, 1);
                                    saveRules(newRules);
                                    setRulesText(newRules.map(r => `${r.username} (${r.userId}): ${r.reactions.map(emojiToString).join(" ")}`).join("\n"));
                                    showToast("Rule removed", Toasts.Type.SUCCESS);
                                }}
                            >
                                Remove
                            </Button>
                        </div>
                    ))}
                </div>
            ) : (
                <Forms.FormText style={{
                    marginBottom: "16px",
                    color: "var(--text-muted)",
                    padding: "16px",
                    background: "var(--background-secondary)",
                    borderRadius: "8px",
                    textAlign: "center"
                }}>
                    No rules configured. Right-click on a user to add one!
                </Forms.FormText>
            )}
        </div>
    );
}

export default definePlugin({
    name: "UserReact",
    description: "Automatically react to every message from specific users with custom emojis",
    authors: [{ name: "YourName", id: BigInt(0) }],
    settings,
    settingsPanel: SettingsPanel,

    contextMenus: {
        "user-context": UserContextMenuPatch(),
    },

    start() {
        FluxDispatcher.subscribe("MESSAGE_CREATE", handleMessageCreate);
    },

    stop() {
        FluxDispatcher.unsubscribe("MESSAGE_CREATE", handleMessageCreate);
    }
});
