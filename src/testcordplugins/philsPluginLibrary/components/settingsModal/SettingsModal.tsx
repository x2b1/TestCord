/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Flex } from "@components/Flex";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalRoot } from "@utils/modal";
import { Button, Text } from "@webpack/common";
import React, { JSX } from "react";

import { Author, Contributor } from "../../types";
import { ContributorAuthorSummary } from "../ContributorAuthorSummary";


export interface SettingsModalProps extends React.ComponentProps<typeof ModalRoot> {
    title?: string;
    onClose: () => void;
    onDone?: () => void;
    footerContent?: JSX.Element;
    closeButtonName?: string;
    author?: Author,
    contributors?: Contributor[];
}

export const SettingsModal = (props: SettingsModalProps) => {
    const doneButton =
        <Button
            size={Button.Sizes.SMALL}
            color={Button.Colors.BRAND}
            onClick={props.onDone}
        >
            {props.closeButtonName ?? "Done"}
        </Button>;

    return (
        <ModalRoot {...props}>
            <ModalHeader separator={false}>
                {props.title && <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>{props.title}</Text>}
                <div style={{ marginLeft: "auto" }}>
                    <ModalCloseButton onClick={props.onClose} />
                </div>
            </ModalHeader>
            <ModalContent style={{ marginBottom: "1em", display: "flex", flexDirection: "column", gap: "1em" }}>
                {props.children}
            </ModalContent>
            <ModalFooter>
                <Flex style={{ width: "100%" }}>
                    <div style={{ flex: 1, display: "flex" }}>
                        {(props.author || props.contributors && props.contributors.length > 0) &&

                            <Flex style={{ justifyContent: "flex-start", alignItems: "center", flex: 1 }}>
                                <ContributorAuthorSummary
                                    author={props.author}
                                    contributors={props.contributors} />
                            </Flex>
                        }
                        {props.footerContent}
                    </div>
                    <div style={{ marginLeft: "auto" }}>{doneButton}</div>
                </Flex>
            </ModalFooter>
        </ModalRoot >
    );
};
