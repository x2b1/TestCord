/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Flex } from "@components/Flex";
import { TestcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Button, React, Text, TextArea } from "@webpack/common";
import { showToast, Toasts } from "@webpack/common";

const settings = definePluginSettings({
    importToTokenLogin: {
        type: OptionType.BOOLEAN,
        description: "Import tokens to Token Login Manager",
        default: true
    }
});

function parseTokens(input: string): Array<{ userId: string; token: string; }> {
    const lines = input.trim().split("\n");
    const tokens: Array<{ userId: string; token: string; }> = [];

    for (let i = 0; i < lines.length; i += 3) {
        const userId = lines[i]?.trim();
        const token = lines[i + 2]?.trim().replace(/^["']|["']$/g, "");

        if (userId && token) {
            tokens.push({ userId, token });
        }
    }

    return tokens;
}

const ImportMultiTokensComponent = () => {
    const [input, setInput] = React.useState("");
    const [importing, setImporting] = React.useState(false);

    const handleImport = async () => {
        if (!input.trim()) {
            showToast("Please paste token data", Toasts.Type.FAILURE);
            return;
        }

        setImporting(true);
        try {
            const tokens = parseTokens(input);

            if (tokens.length === 0) {
                showToast("No valid tokens found", Toasts.Type.FAILURE);
                setImporting(false);
                return;
            }

            if (settings.store.importToTokenLogin) {
                const tokenLoginPlugin = Vencord.Plugins.plugins.TokenLoginManager;
                if (tokenLoginPlugin?.tokenLoginManager) {
                    for (const { userId, token } of tokens) {
                        tokenLoginPlugin.tokenLoginManager.addAccount({
                            username: `User ${userId}`,
                            token
                        });
                    }
                    showToast(`Imported ${tokens.length} token(s) to Token Login Manager`, Toasts.Type.SUCCESS);
                } else {
                    showToast("Token Login Manager not available", Toasts.Type.FAILURE);
                }
            }

            setInput("");
        } catch (error) {
            showToast("Import failed: " + error, Toasts.Type.FAILURE);
        } finally {
            setImporting(false);
        }
    };

    return (
        <div style={{ padding: "16px" }}>
            <Text variant="heading-lg/semibold" style={{ marginBottom: "12px" }}>
                Import Multiple Tokens
            </Text>
            <Text variant="text-sm/normal" style={{ marginBottom: "16px", color: "var(--text-muted)" }}>
                Paste tokens in format: userId, colon, token (one per 3 lines)
            </Text>
            <TextArea
                placeholder="tokens from your local storage > tokens;"
                value={input}
                onChange={setInput}
                rows={10}
                style={{ marginBottom: "12px", fontFamily: "monospace" }}
            />
            <Flex style={{ gap: "8px" }}>
                <Button
                    color={Button.Colors.BRAND}
                    onClick={handleImport}
                    disabled={importing || !input.trim()}
                >
                    {importing ? "Importing..." : "Import Tokens"}
                </Button>
                <Button
                    color={Button.Colors.TRANSPARENT}
                    onClick={() => setInput("")}
                    disabled={!input.trim()}
                >
                    Clear
                </Button>
            </Flex>
        </div>
    );
};

export default definePlugin({
    name: "ImportMultiTokens",
    description: "Import multiple user tokens into Token Login Manager",
    authors: [TestcordDevs.x2b],
    tags: ["Utility"],
    settings,

    settingsAboutComponent: () => <ImportMultiTokensComponent />
});
