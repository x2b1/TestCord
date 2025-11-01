/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Flex } from "@components/Flex";
import { Text } from "@webpack/common";
import React from "react";

import { Author, Contributor } from "../types";
import { openURL } from "../utils";
import { AuthorUserSummaryItem } from "./AuthorSummaryItem";

export interface ContributorAuthorSummaryProps {
    author?: Author;
    contributors?: Contributor[];
}

export const ContributorAuthorSummary = ({ author, contributors }: ContributorAuthorSummaryProps) => {
    return (
        <Flex style={{ gap: "0.7em" }}>
            {author &&
                <Flex style={{ justifyContent: "center", alignItems: "center", gap: "0.5em" }}>
                    <Text variant="text-sm/normal" style={{ color: "var(--text-muted)" }}>
                        Author: <a onClick={() => author.github && openURL(author.github)}>{`${author.name}`}</a>
                    </Text>
                    <AuthorUserSummaryItem authors={[author]} />
                </Flex>
            }
            {(contributors && contributors.length > 0) &&
                <Flex style={{ justifyContent: "center", alignItems: "center", gap: "0.5em" }}>
                    <Text variant="text-sm/normal" style={{ color: "var(--text-muted)" }}>
                        Contributors:
                    </Text>
                    <AuthorUserSummaryItem authors={contributors} />
                </Flex>
            }
        </Flex>
    );
};
