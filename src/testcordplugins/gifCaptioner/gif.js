/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Simplified GIF encoder for TestCord
// Based on gif.js library functionality

class GIF {
    constructor(options = {}) {
        this.frames = [];
        this.options = {
            workers: options.workers || 2,
            quality: options.quality || 10,
            ...options
        };
        this.onFinished = null;
        this.onAbort = null;
    }

    addFrame(canvas, options = {}) {
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas context not available");

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        this.frames.push({
            data: imageData.data,
            width: canvas.width,
            height: canvas.height,
            delay: options.delay || 100
        });
    }

    on(event, callback) {
        if (event === "finished") this.onFinished = callback;
        if (event === "abort") this.onAbort = callback;
    }

    render() {
        try {
            const gifData = this.encodeGIF();
            const blob = new Blob([gifData], { type: "image/gif" });
            if (this.onFinished) this.onFinished(blob);
        } catch (error) {
            if (this.onAbort) this.onAbort();
            throw error;
        }
    }

    encodeGIF() {
        const { frames } = this;
        if (frames.length === 0) throw new Error("No frames to encode");

        const { width } = frames[0];
        const { height } = frames[0];

        // GIF Header
        const data = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]; // GIF89a

        // Logical Screen Descriptor
        data.push(width & 0xFF, (width >> 8) & 0xFF);
        data.push(height & 0xFF, (height >> 8) & 0xFF);
        data.push(0xF0, 0x00, 0x00); // Global Color Table flag, 256 colors

        // Global Color Table (simple grayscale for now)
        for (let i = 0; i < 256; i++) {
            data.push(i, i, i);
        }

        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];

            // Graphic Control Extension
            data.push(0x21, 0xF9, 0x04); // Extension introducer, GCE label, block size
            data.push(0x00); // Disposal method: No disposal
            data.push(frame.delay & 0xFF, (frame.delay >> 8) & 0xFF); // Delay time
            data.push(0x00, 0x00); // Transparent color index, block terminator

            // Image Descriptor
            data.push(0x2C); // Image separator
            data.push(0x00, 0x00, 0x00, 0x00); // Image left, top
            data.push(width & 0xFF, (width >> 8) & 0xFF);
            data.push(height & 0xFF, (height >> 8) & 0xFF);
            data.push(0x00); // No local color table

            // Image Data
            const pixels = this.quantizeFrame(frame.data, width, height);
            const compressed = this.lzwCompress(pixels, 8);

            data.push(8); // LZW minimum code size
            for (let j = 0; j < compressed.length; j += 255) {
                const blockSize = Math.min(255, compressed.length - j);
                data.push(blockSize);
                for (let k = 0; k < blockSize; k++) {
                    data.push(compressed[j + k]);
                }
            }
            data.push(0x00); // Block terminator
        }

        // GIF Trailer
        data.push(0x3B);

        return new Uint8Array(data);
    }

    quantizeFrame(data, width, height) {
        // Simple quantization to 256 colors (grayscale)
        const pixels = [];
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            // Convert to grayscale
            const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            pixels.push(gray);
        }
        return pixels;
    }

    lzwCompress(data, minCodeSize) {
        // Basic LZW compression
        const output = [];
        let codeSize = minCodeSize + 1;
        const clearCode = 1 << minCodeSize;
        const endCode = clearCode + 1;
        let nextCode = endCode + 1;

        const codeTable = new Map();
        for (let i = 0; i < clearCode; i++) {
            codeTable.set([i], i);
        }

        let pos = 0;
        let current = [data[pos++]];

        while (pos < data.length) {
            const next = data[pos++];
            const combined = [...current, next];

            if (codeTable.has(combined)) {
                current = combined;
            } else {
                // Output current code
                output.push(codeTable.get(current));

                // Add new code to table
                codeTable.set(combined, nextCode++);
                if (nextCode === (1 << codeSize) && codeSize < 12) {
                    codeSize++;
                }

                current = [next];
            }
        }

        // Output remaining code
        output.push(codeTable.get(current));
        output.push(endCode);

        // Convert to bytes
        const bytes = [];
        let bits = 0;
        let bitsCount = 0;

        for (const code of output) {
            bits |= code << bitsCount;
            bitsCount += codeSize;

            while (bitsCount >= 8) {
                bytes.push(bits & 0xFF);
                bits >>= 8;
                bitsCount -= 8;
            }
        }

        if (bitsCount > 0) {
            bytes.push(bits & 0xFF);
        }

        return bytes;
    }
}

export default GIF;
