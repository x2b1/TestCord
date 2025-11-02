/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Simplified GIF parser and decompressor for TestCord
// Based on gifuct-js library functionality

function parseGIF(arrayBuffer) {
    const data = new Uint8Array(arrayBuffer);
    let pos = 0;

    // GIF Header
    const signature = String.fromCharCode(...data.slice(pos, pos + 3));
    pos += 3;
    const version = String.fromCharCode(...data.slice(pos, pos + 3));
    pos += 3;

    if (signature !== "GIF") throw new Error("Not a GIF file");

    // Logical Screen Descriptor
    const lsd = {
        width: data[pos] | (data[pos + 1] << 8),
        height: data[pos + 2] | (data[pos + 3] << 8),
        flags: data[pos + 4],
        bgColorIndex: data[pos + 5],
        pixelAspectRatio: data[pos + 6]
    };
    pos += 7;

    // Global Color Table (if present)
    let globalColorTable = null;
    if (lsd.flags & 0x80) {
        const gctSize = 1 << ((lsd.flags & 0x07) + 1);
        globalColorTable = data.slice(pos, pos + gctSize * 3);
        pos += gctSize * 3;
    }

    const frames = [];
    let graphicControl = null;

    while (pos < data.length) {
        const blockType = data[pos];
        pos++;

        if (blockType === 0x21) { // Extension
            const extType = data[pos];
            pos++;

            if (extType === 0xF9) { // Graphic Control Extension
                graphicControl = {
                    disposalMethod: (data[pos + 1] >> 2) & 0x07,
                    delay: (data[pos + 3] << 8) | data[pos + 2],
                    transparentColorIndex: data[pos + 4] & 0x01 ? data[pos + 5] : null
                };
                pos += 6;
            } else {
                // Skip other extensions
                let size = data[pos];
                while (size !== 0) {
                    pos += size + 1;
                    size = data[pos];
                }
                pos++;
            }
        } else if (blockType === 0x2C) { // Image Descriptor
            const frame = {
                left: data[pos] | (data[pos + 1] << 8),
                top: data[pos + 2] | (data[pos + 3] << 8),
                width: data[pos + 4] | (data[pos + 5] << 8),
                height: data[pos + 6] | (data[pos + 7] << 8),
                flags: data[pos + 8],
                localColorTable: null,
                lzwMinCodeSize: data[pos + 9],
                data: null,
                graphicControl: graphicControl
            };
            pos += 10;

            // Local Color Table
            if (frame.flags & 0x80) {
                const lctSize = 1 << ((frame.flags & 0x07) + 1);
                frame.localColorTable = data.slice(pos, pos + lctSize * 3);
                pos += lctSize * 3;
            }

            // Image Data
            const dataSize = data[pos];
            pos++;
            const compressedData = data.slice(pos, pos + dataSize);
            pos += dataSize;

            frame.data = compressedData;
            frames.push(frame);
            graphicControl = null;
        } else if (blockType === 0x3B) { // Trailer
            break;
        } else {
            // Skip unknown blocks
            let size = data[pos];
            while (size !== 0) {
                pos += size + 1;
                size = data[pos];
            }
            pos++;
        }
    }

    return { lsd, frames };
}

function decompressFrames(parsed, buildPatch) {
    const frames = [];

    for (const frame of parsed.frames) {
        // Simple LZW decompression (basic implementation)
        const decompressed = lzwDecode(frame.data, frame.lzwMinCodeSize);
        const pixels = new Uint8Array(decompressed);

        if (buildPatch) {
            frames.push({
                dims: { width: frame.width, height: frame.height, left: frame.left, top: frame.top },
                colorTable: frame.localColorTable || parsed.globalColorTable,
                patch: pixels,
                delay: frame.graphicControl?.delay || 100,
                disposalType: frame.graphicControl?.disposalMethod || 0,
                transparentIndex: frame.graphicControl?.transparentColorIndex
            });
        } else {
            frames.push({
                dims: { width: frame.width, height: frame.height, left: frame.left, top: frame.top },
                colorTable: frame.localColorTable || parsed.globalColorTable,
                pixels: pixels,
                delay: frame.graphicControl?.delay || 100,
                disposalType: frame.graphicControl?.disposalMethod || 0,
                transparentIndex: frame.graphicControl?.transparentColorIndex
            });
        }
    }

    return frames;
}

// Basic LZW decoder
function lzwDecode(data, minCodeSize) {
    const output = [];
    let codeSize = minCodeSize + 1;
    const clearCode = 1 << minCodeSize;
    const endCode = clearCode + 1;
    const codeTable = [];
    let nextCode = endCode + 1;

    // Initialize code table
    for (let i = 0; i < clearCode; i++) {
        codeTable[i] = [i];
    }
    codeTable[clearCode] = [];
    codeTable[endCode] = [];

    let pos = 0;
    let bits = 0;
    let bitsCount = 0;

    function readCode() {
        while (bitsCount < codeSize) {
            bits |= data[pos] << bitsCount;
            bitsCount += 8;
            pos++;
        }
        const code = bits & ((1 << codeSize) - 1);
        bits >>= codeSize;
        bitsCount -= codeSize;
        return code;
    }

    let prevCode = null;
    while (pos < data.length) {
        const code = readCode();

        if (code === clearCode) {
            codeSize = minCodeSize + 1;
            nextCode = endCode + 1;
            prevCode = null;
            continue;
        }

        if (code === endCode) break;

        let entry;
        if (code < codeTable.length) {
            entry = codeTable[code];
        } else if (prevCode !== null) {
            entry = [...codeTable[prevCode], codeTable[prevCode][0]];
        } else {
            throw new Error("Invalid LZW code");
        }

        output.push(...entry);

        if (prevCode !== null) {
            codeTable[nextCode] = [...codeTable[prevCode], entry[0]];
            nextCode++;
            if (nextCode === (1 << codeSize) && codeSize < 12) {
                codeSize++;
            }
        }

        prevCode = code;
    }

    return output;
}

export { decompressFrames,parseGIF };
