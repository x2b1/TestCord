/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button, Text, TextArea, useState } from "@webpack/common";
import React, { useEffect, useRef } from "react";

import { classFactory, defaultPluginCode, generateId, getStoredPlugins, LivePlugin, livePlugins, loadLivePlugin, reloadPlugin, savePlugins } from "../index";

export function LivePluginEditor() {
    const [plugins, setPlugins] = useState<LivePlugin[]>(getStoredPlugins());
    const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);
    const [editCode, setEditCode] = useState("");
    const [editName, setEditName] = useState("");
    const [showNewPluginForm, setShowNewPluginForm] = useState(false);
    const [newPluginName, setNewPluginName] = useState("");
    const editorRef = useRef<HTMLTextAreaElement>(null);

    const selectedPlugin = plugins.find(p => p.id === selectedPluginId);

    useEffect(() => {
        if (selectedPlugin) {
            setEditCode(selectedPlugin.code);
            setEditName(selectedPlugin.name);
        }
    }, [selectedPluginId]);

    const handleCreatePlugin = () => {
        if (!newPluginName.trim()) return;

        const newPlugin: LivePlugin = {
            id: generateId(),
            name: newPluginName.trim(),
            code: defaultPluginCode,
            enabled: true,
            description: ""
        };

        const updated = [...plugins, newPlugin];
        savePlugins(updated);
        setPlugins(updated);
        setSelectedPluginId(newPlugin.id);
        setNewPluginName("");
        setShowNewPluginForm(false);
    };

    const handleDeletePlugin = (id: string) => {
        if (livePlugins.has(id)) {
            const entry = livePlugins.get(id);
            if (entry?.instance?.stop) {
                try { entry.instance.stop(); } catch { /* empty */ }
            }
            livePlugins.delete(id);
        }

        const updated = plugins.filter(p => p.id !== id);
        savePlugins(updated);
        setPlugins(updated);
        if (selectedPluginId === id) {
            setSelectedPluginId(null);
        }
    };

    const handleToggleEnabled = (plugin: LivePlugin) => {
        plugin.enabled = !plugin.enabled;
        const updated = [...plugins];
        savePlugins(updated);
        setPlugins(updated);

        if (plugin.enabled) {
            loadLivePlugin(plugin);
        } else {
            if (livePlugins.has(plugin.id)) {
                const entry = livePlugins.get(plugin.id);
                if (entry?.instance?.stop) {
                    try { entry.instance.stop(); } catch { /* empty */ }
                }
                livePlugins.delete(plugin.id);
            }
        }
    };

    const handleSaveCode = () => {
        if (!selectedPlugin) return;

        selectedPlugin.code = editCode;
        selectedPlugin.name = editName;
        const updated = [...plugins];
        savePlugins(updated);
        setPlugins(updated);
    };

    const handleReload = () => {
        if (!selectedPlugin) return;
        reloadPlugin(selectedPlugin);
    };

    const handleDeleteIcon = () => {
        if (!selectedPluginId) return;
        handleDeletePlugin(selectedPluginId);
    };

    return (
        <div className={classFactory("container")}>
            <div className={classFactory("sidebar")}>
                <div className={classFactory("sidebar-header")}>
                    <Text style={{ flex: 1 }}>Plugins</Text>
                    <Button
                        look={Button.Looks.BLANK}
                        onClick={() => setShowNewPluginForm(true)}
                    >
                        +
                    </Button>
                </div>

                {showNewPluginForm && (
                    <div className={classFactory("new-plugin-form")}>
                        <TextArea
                            value={newPluginName}
                            onChange={(e: any) => setNewPluginName(e.target.value)}
                            placeholder="Plugin name..."
                            style={{ marginBottom: "8px" }}
                        />
                        <div className={classFactory("form-buttons")}>
                            <Button look={Button.Looks.FILLED} color={Button.Colors.GREEN} size={Button.Sizes.SMALL} onClick={handleCreatePlugin}>
                                Create
                            </Button>
                            <Button look={Button.Looks.FILLED} size={Button.Sizes.SMALL} onClick={() => setShowNewPluginForm(false)}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}

                <div className={classFactory("plugin-list")}>
                    {plugins.map(plugin => (
                        <div
                            key={plugin.id}
                            className={classFactory("plugin-item", { selected: plugin.id === selectedPluginId })}
                            onClick={() => setSelectedPluginId(plugin.id)}
                        >
                            <div className={classFactory("plugin-info")}>
                                <Text>{plugin.name}</Text>
                                <input
                                    type="checkbox"
                                    checked={plugin.enabled}
                                    onChange={() => handleToggleEnabled(plugin)}
                                    onClick={(e: any) => e.stopPropagation()}
                                />
                            </div>
                        </div>
                    ))}
                    {plugins.length === 0 && (
                        <div className={classFactory("empty-state")}>
                            <Text style={{ opacity: 0.5 }}>No plugins yet. Click + to create one.</Text>
                        </div>
                    )}
                </div>
            </div>

            <div className={classFactory("editor-panel")}>
                {selectedPlugin ? (
                    <>
                        <div className={classFactory("editor-header")}>
                            <TextArea
                                value={editName}
                                onChange={(e: any) => setEditName(e.target.value)}
                                placeholder="Plugin name..."
                                style={{ flex: 1, marginRight: "8px" }}
                            />
                            <Button look={Button.Looks.FILLED} color={Button.Colors.GREEN} onClick={handleSaveCode}>Save</Button>
                            <Button look={Button.Looks.FILLED} onClick={handleReload} style={{ marginLeft: "8px" }}>Reload</Button>
                            <Button look={Button.Looks.FILLED} color={Button.Colors.RED} onClick={handleDeleteIcon} style={{ marginLeft: "8px" }}>Delete</Button>
                        </div>
                        <TextArea
                            ref={editorRef}
                            className={classFactory("code-editor")}
                            value={editCode}
                            onChange={(e: any) => setEditCode(e.target.value)}
                            placeholder="// Write your plugin code here..."
                            style={{
                                fontFamily: "monospace",
                                minHeight: "300px",
                                resize: "vertical"
                            }}
                        />
                        <div className={classFactory("editor-help")}>
                            <Text style={{ opacity: 0.7 }}>
                                Available: definePlugin, VencordNative, console, module, exports, require
                            </Text>
                        </div>
                    </>
                ) : (
                    <div className={classFactory("no-selection")}>
                        <Text style={{ opacity: 0.5 }}>Select a plugin to edit</Text>
                    </div>
                )}
            </div>
        </div>
    );
}
