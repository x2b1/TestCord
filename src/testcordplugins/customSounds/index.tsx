/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { definePluginSettings } from "@api/Settings";
import { classNameFactory } from "@api/Styles";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Button, Forms, React, showToast, TextInput } from "@webpack/common";

import { SoundOverrideComponent } from "./components/SoundOverrideComponent";
import { makeEmptyOverride, seasonalSounds, SoundOverride, SoundType, soundTypes } from "./types";

const cl = classNameFactory("vc-custom-sounds-");

const allSoundTypes = soundTypes || [];

function getSeasonalId(season: string, type: SoundType): string | null {
    if (!type.seasonal) return null;
    const seasonalId = type.seasonal.find(id => id.startsWith(`${season}_`));
    return seasonalId || null;
}

function resolveOverrideUrl(override: SoundOverride, type: SoundType): string {
    if (!override) return "";

    switch (override.selectedSound) {
        case "custom":
            return override.url || "";
        case "default":
            return "";
        default: {
            if (type.seasonal) {
                if (override.selectedSound in seasonalSounds) {
                    return seasonalSounds[override.selectedSound];
                }

                const seasonalId = getSeasonalId(override.selectedSound, type);
                if (seasonalId && seasonalId in seasonalSounds) {
                    return seasonalSounds[seasonalId];
                }
            }
            return "";
        }
    }
}

const settings = definePluginSettings({
    overrides: {
        type: OptionType.COMPONENT,
        description: "",
        component: () => {
            const [resetTrigger, setResetTrigger] = React.useState(0);
            const [searchQuery, setSearchQuery] = React.useState("");
            const fileInputRef = React.useRef<HTMLInputElement>(null);

            const resetOverrides = () => {
                allSoundTypes.forEach(type => {
                    settings.store[type.id] = makeEmptyOverride();
                });
                setResetTrigger(prev => prev + 1);
            };

            const triggerFileUpload = () => {
                fileInputRef.current?.click();
            };

            const handleSettingsUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
                const file = event.target.files?.[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = async (e: ProgressEvent<FileReader>) => {
                        try {
                            resetOverrides();

                            const importedSettings = JSON.parse(e.target?.result as string);

                            importedSettings.forEach((setting: any) => {
                                if (setting.id in settings.store) {
                                    settings.store[setting.id] = {
                                        enabled: setting.enabled ?? false,
                                        selectedSound: setting.selectedSound ?? "default",
                                        url: setting.url || "",
                                        base64Data: setting.base64Data || "",
                                        volume: setting.volume ?? 100,
                                        useFile: setting.useFile ?? false,
                                    };
                                }
                            });

                            setResetTrigger(prev => prev + 1);
                            showToast("Settings imported successfully!");
                        } catch (error) {
                            console.error("Error importing settings:", error);
                            showToast("Error importing settings. Check console for details.");
                        }
                    };

                    reader.readAsText(file);
                    event.target.value = "";
                }
            };

            const downloadSettings = () => {
                const settingsData = Object.entries(settings.store)
                    .filter(([key]) => key !== "overrides")
                    .map(([key, value]) => {
                        const soundType = allSoundTypes.find(type => type.id === key);
                        return {
                            id: key,
                            enabled: value.enabled,
                            selectedSound: value.selectedSound,
                            url: value.selectedSound === "custom" ? value.url : soundType ? resolveOverrideUrl(value, soundType) : "",
                            base64Data: value.base64Data || "",
                            volume: value.volume,
                            useFile: value.useFile,
                        };
                    });
                const blob = new Blob([JSON.stringify(settingsData, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "customSounds-settings.json";
                a.click();
                URL.revokeObjectURL(url);
            };


            const filteredSoundTypes = allSoundTypes.filter(type =>
                type.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                type.id.toLowerCase().includes(searchQuery.toLowerCase())
            );

            return (
                <div>
                    <div className="vc-custom-sounds-buttons">
                        <Button color={Button.Colors.BRAND} onClick={triggerFileUpload}>Import</Button>
                        <Button color={Button.Colors.PRIMARY} onClick={downloadSettings}>Export</Button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json"
                            style={{ display: "none" }}
                            onChange={handleSettingsUpload}
                        />
                    </div>

                    <div className={cl("search")}>
                        <Forms.FormTitle>Search Sounds</Forms.FormTitle>
                        <TextInput
                            value={searchQuery}
                            onChange={e => setSearchQuery(e)}
                            placeholder="Search by name or ID"
                        />
                    </div>

                    <div className={cl("sounds-list")}>
                        {filteredSoundTypes.map(type => (
                            <SoundOverrideComponent
                                key={`${type.id}-${resetTrigger}`}
                                type={type}
                                override={settings.store[type.id] ?? makeEmptyOverride()}
                                overrides={settings.store}
                                onChange={() => {
                                    return new Promise<void>(resolve => {
                                        settings.store[type.id] = {
                                            ...settings.store[type.id],
                                            url: resolveOverrideUrl(settings.store[type.id], type)
                                        };
                                        resolve();
                                    });
                                }}
                            />
                        ))}
                    </div>
                </div>
            );
        }
    }
});

export function isOverriden(id: string): boolean {
    return !!settings.store[id]?.enabled;
}

export function findOverride(id: string): SoundOverride | null {
    const override = settings.store[id];
    return override?.enabled ? override : null;
}

export default definePlugin({
    name: "CustomSounds",
    description: "Customize Discord's sounds.",
    authors: [Devs.ScattrdBlade, Devs.TheKodeToad],
    patches: [
        {
            find: 'Error("could not play audio")',
            replacement: [
                {
                    match: /(?<=new Audio;\i\.src=)\i\([0-9]+\)\("\.\/"\.concat\(this\.name,"\.mp3"\)\)/,
                    replace: "(() => { const override = $self.findOverride(this.name); return override?.url || $&; })()",
                },
                {
                    match: /Math.min\(\i\.\i\.getOutputVolume\(\)\/100\*this\._volume/,
                    replace: "$& * ($self.findOverride(this.name)?.volume ?? 100) / 100",
                },
            ],
        },
        {
            find: ".playWithListener().then",
            replacement: {
                match: /\i\.\i\.getSoundpack\(\)/,
                replace: '$self.isOverriden(arguments[0]) ? "classic" : $&',
            },
        },
    ],
    settings,
    findOverride,
    isOverriden,
});
