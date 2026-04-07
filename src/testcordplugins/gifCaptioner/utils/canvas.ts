/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

interface MeasureTextContext {
    measureText: CanvasRenderingContext2D["measureText"];
}

export function getLines(ctx: MeasureTextContext, text: string, maxWidth: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = words[0] ?? "";

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const { width } = ctx.measureText(`${currentLine} ${word}`);
        if (width < maxWidth) {
            currentLine += ` ${word}`;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }

    lines.push(currentLine);
    return lines;
}
