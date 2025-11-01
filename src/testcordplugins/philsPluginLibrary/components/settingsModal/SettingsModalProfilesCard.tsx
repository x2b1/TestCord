/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Flex } from "@components/Flex";
import { Select, TextInput, useEffect, useState } from "@webpack/common";

import { PluginSettings, ProfilableStore } from "../../../philsPluginLibrary";
import { CopyButton, DeleteButton, NewButton, SaveButton } from "../buttons";
import { SettingsModalCard } from "./SettingsModalCard";
import { SettingsModalCardItem } from "./SettingsModalCardItem";

export interface SettingsModalProfilesCardProps<T extends PluginSettings = {}> extends React.ComponentProps<typeof SettingsModalCard> {
    profileableStore: ProfilableStore<T, any>;
    onSaveStateChanged: (isSaving: boolean) => void;
}

export const SettingsModalProfilesCard = <T extends PluginSettings = {},>(props: SettingsModalProfilesCardProps<T>) => {
    const { profileableStore: { use } } = props;

    const {
        currentProfile,
        setCurrentProfile,
        deleteProfile,
        getCurrentProfile,
        getDefaultProfiles,
        getProfile,
        getProfiles,
        saveProfile,
        isCurrentProfileADefaultProfile
    } = use();

    const { name } = currentProfile;

    const [isSaving, setIsSaving] = useState(false);
    const [profileNameInput, setProfileNameInput] = useState<string>("");

    useEffect(() => {
        props.onSaveStateChanged(isSaving);
    }, [isSaving]);

    const onSaveProfile = () => {
        if (!isSaving) {
            setIsSaving(true);

        } else {
            if (profileNameInput.length && !getDefaultProfiles().some(value => value.name === profileNameInput)) {
                saveProfile({ ...getCurrentProfile(), name: profileNameInput });
                setCurrentProfile(getProfile(profileNameInput) || { name: "" });
                setIsSaving(false);
            }
        }
    };

    const onCopyProfile = () => {
        setCurrentProfile({ ...getCurrentProfile(), name: "" });
    };

    const onNewProfile = () => {
        setCurrentProfile({ name: "" });
    };

    const onDeleteProfile = () => {
        deleteProfile(currentProfile);
    };

    return (
        <SettingsModalCard
            title="Profile"
            {...props}>
            <SettingsModalCardItem>
                <Flex style={{ alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                        {isSaving
                            ? <TextInput
                                style={{ width: "100%" }}
                                placeholder="Insert name"
                                value={profileNameInput}
                                onChange={setProfileNameInput} />
                            : <Select
                                isSelected={value => name === value}
                                options={getProfiles(true).map(profile => ({
                                    label: profile.name,
                                    value: profile.name
                                }))}
                                select={value => setCurrentProfile(getProfile(value) || { name: "" })}
                                serialize={() => ""} />}
                    </div>
                    <Flex style={{ gap: "0.8em" }}>
                        <SaveButton onClick={onSaveProfile} />
                        <NewButton onClick={onNewProfile} disabled={isSaving} />
                        <CopyButton onClick={onCopyProfile} disabled={isSaving} />
                        <DeleteButton onClick={onDeleteProfile} disabled={isSaving || isCurrentProfileADefaultProfile() || !currentProfile.name.length} />
                    </Flex>
                </Flex>
            </SettingsModalCardItem>
        </SettingsModalCard>
    );
};
