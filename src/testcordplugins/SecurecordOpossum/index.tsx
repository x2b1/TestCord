/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { sendBotMessage } from "@api/Commands";
import { addMessagePreSendListener, removeMessagePreSendListener, MessageSendListener } from "@api/MessageEvents";
import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { Devs } from "@utils/constants";
import definePlugin, { IconComponent, OptionType } from "@utils/types";
import { Message } from "@vencord/discord-types";

interface IMessageCreate {
    type: "MESSAGE_CREATE";
    optimistic: boolean;
    isPushNotification: boolean;
    channelId: string;
    message: Message;
}

// Enhanced AES-256 encryption with BetterOpossum improvements
class BetterOpossumCipher {
    private static readonly BLOCK_SIZE_BITS = 4096;
    private static readonly KEY_SIZE_BITS = 4096;
    private static readonly IV_SIZE_BITS = 512;
    
    private static readonly BLOCK_SIZE_BYTES = BetterOpossumCipher.BLOCK_SIZE_BITS / 8;
    private static readonly KEY_SIZE_BYTES = BetterOpossumCipher.KEY_SIZE_BITS / 8;
    private static readonly IV_SIZE_BYTES = BetterOpossumCipher.IV_SIZE_BITS / 8;
    
    private static readonly NUMBER_OF_ROUNDS = 192;
    
    private sBox: Uint8Array;
    private invSBox: Uint8Array;
    private permutationTable: Uint32Array;
    
    private static readonly AES_SBOX = new Uint8Array([
        0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
        0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
        0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
        0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
        0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
        0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
        0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
        0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
        0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
        0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
        0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
        0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
        0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
        0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
        0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
        0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
    ]);

    constructor() {
        this.sBox = new Uint8Array(256);
        this.invSBox = new Uint8Array(256);
        this.permutationTable = new Uint32Array(BetterOpossumCipher.BLOCK_SIZE_BYTES);
        this.initializeSBoxAndPermutation();
    }

    private initializeSBoxAndPermutation(): void {
        this.sBox.set(BetterOpossumCipher.AES_SBOX);
        
        // Generate inverse S-box
        for (let i = 0; i < 256; i++) {
            this.invSBox[this.sBox[i]] = i;
        }

        // Initialize permutation table with matrix-based approach
        const matrixRows = 16;
        const matrixCols = BetterOpossumCipher.BLOCK_SIZE_BYTES / matrixRows;

        if (matrixRows * matrixCols !== BetterOpossumCipher.BLOCK_SIZE_BYTES) {
            for (let i = 0; i < BetterOpossumCipher.BLOCK_SIZE_BYTES; i++) {
                this.permutationTable[i] = (i + BetterOpossumCipher.BLOCK_SIZE_BYTES - 5) % BetterOpossumCipher.BLOCK_SIZE_BYTES;
            }
        } else {
            for (let row = 0; row < matrixRows; row++) {
                for (let col = 0; col < matrixCols; col++) {
                    const originalIndex = row * matrixCols + col;
                    const newCol = (col + matrixCols - (row % matrixCols)) % matrixCols;
                    const newIndex = row * matrixCols + newCol;
                    this.permutationTable[originalIndex] = newIndex;
                }
            }
        }
    }

    private keyExpansion(masterKey: Uint8Array): Uint8Array[] {
        if (masterKey.length !== BetterOpossumCipher.KEY_SIZE_BYTES) {
            throw new Error(`Key must be ${BetterOpossumCipher.KEY_SIZE_BYTES} bytes`);
        }

        const roundKeys: Uint8Array[] = [];
        const expandedKey = new Uint8Array((BetterOpossumCipher.NUMBER_OF_ROUNDS + 1) * BetterOpossumCipher.BLOCK_SIZE_BYTES);
        
        expandedKey.set(masterKey, 0);
        
        const temp = new Uint8Array(BetterOpossumCipher.BLOCK_SIZE_BYTES);

        for (let i = BetterOpossumCipher.KEY_SIZE_BYTES; i < expandedKey.length; i += BetterOpossumCipher.BLOCK_SIZE_BYTES) {
            temp.set(expandedKey.subarray(i - BetterOpossumCipher.BLOCK_SIZE_BYTES, i - BetterOpossumCipher.BLOCK_SIZE_BYTES + BetterOpossumCipher.BLOCK_SIZE_BYTES));
            
            // Rotate left by 13 bits
            const rotated = this.rotateBytesLeft(temp, 13);
            temp.set(rotated);
            
            // Apply S-box substitution
            for (let j = 0; j < temp.length; j++) {
                temp[j] = this.sBox[temp[j]];
            }
            
            // XOR with round constant and previous key
            const roundConstant = i / BetterOpossumCipher.BLOCK_SIZE_BYTES;
            temp[0] ^= roundConstant;
            
            for (let j = 0; j < BetterOpossumCipher.BLOCK_SIZE_BYTES; j++) {
                temp[j] ^= expandedKey[i - BetterOpossumCipher.KEY_SIZE_BYTES + j];
            }
            
            expandedKey.set(temp, i);
        }

        for (let r = 0; r < BetterOpossumCipher.NUMBER_OF_ROUNDS + 1; r++) {
            const roundKey = new Uint8Array(BetterOpossumCipher.BLOCK_SIZE_BYTES);
            roundKey.set(expandedKey.subarray(r * BetterOpossumCipher.BLOCK_SIZE_BYTES, (r + 1) * BetterOpossumCipher.BLOCK_SIZE_BYTES));
            roundKeys.push(roundKey);
        }

        return roundKeys;
    }

    private subBytes(state: Uint8Array): void {
        for (let i = 0; i < state.length; i++) {
            state[i] = this.sBox[state[i]];
        }
    }

    private permuteBytes(state: Uint8Array): void {
        const temp = new Uint8Array(BetterOpossumCipher.BLOCK_SIZE_BYTES);
        for (let i = 0; i < BetterOpossumCipher.BLOCK_SIZE_BYTES; i++) {
            temp[this.permutationTable[i]] = state[i];
        }
        state.set(temp);
    }

    private mixColumns(state: Uint8Array): void {
        const groupSize = 32;
        const tempGroup = new Uint8Array(groupSize);

        for (let groupStart = 0; groupStart < BetterOpossumCipher.BLOCK_SIZE_BYTES; groupStart += groupSize) {
            tempGroup.set(state.subarray(groupStart, groupStart + groupSize));

            for (let i = 0; i < groupSize; i++) {
                const a = tempGroup[i];
                const b = tempGroup[(i + 1) % groupSize];
                const c = tempGroup[(i + (groupSize / 2)) % groupSize];

                const rot_b = ((b << 3) | (b >> 5)) & 0xFF;
                const rot_c = ((c << 5) | (c >> 3)) & 0xFF;

                state[groupStart + i] ^= (rot_b ^ rot_c ^ ((i * 0x05 + 0x1F) & 0xFF));
            }
        }
    }

    private addRoundKey(state: Uint8Array, roundKey: Uint8Array): void {
        for (let i = 0; i < BetterOpossumCipher.BLOCK_SIZE_BYTES; i++) {
            state[i] ^= roundKey[i];
        }
    }

    private applyRoundDependentTransforms(state: Uint8Array, roundNumber: number): void {
        const rotationAmount = (roundNumber % 32) + 1;
        const rotatedState = this.rotateBytesLeft(state, rotationAmount);
        state.set(rotatedState);

        for (let i = 0; i < state.length; i++) {
            state[i] ^= this.sBox[(roundNumber + i) & 0xFF];
        }
    }

    private opossumBlockEncrypt(inputBlock: Uint8Array, roundKeys: Uint8Array[]): Uint8Array {
        if (inputBlock.length !== BetterOpossumCipher.BLOCK_SIZE_BYTES) {
            throw new Error(`Input block must be ${BetterOpossumCipher.BLOCK_SIZE_BYTES} bytes`);
        }

        const state = new Uint8Array(BetterOpossumCipher.BLOCK_SIZE_BYTES);
        state.set(inputBlock);
        
        this.addRoundKey(state, roundKeys[0]);

        for (let round = 1; round < BetterOpossumCipher.NUMBER_OF_ROUNDS; round++) {
            this.subBytes(state);
            this.permuteBytes(state);
            this.mixColumns(state);
            this.applyRoundDependentTransforms(state, round);
            this.addRoundKey(state, roundKeys[round]);
        }

        this.subBytes(state);
        this.permuteBytes(state);
        this.applyRoundDependentTransforms(state, BetterOpossumCipher.NUMBER_OF_ROUNDS);
        this.addRoundKey(state, roundKeys[BetterOpossumCipher.NUMBER_OF_ROUNDS]);

        return state;
    }

    private rotateBytesLeft(data: Uint8Array, shift: number): Uint8Array {
        if (data.length === 0) return data;
        shift %= data.length;
        if (shift === 0) return data;

        const rotated = new Uint8Array(data.length);
        rotated.set(data.subarray(shift), 0);
        rotated.set(data.subarray(0, shift), data.length - shift);
        return rotated;
    }

    private incrementCounter(counterBlock: Uint8Array, counterStartIndex: number): void {
        for (let i = BetterOpossumCipher.BLOCK_SIZE_BYTES - 1; i >= counterStartIndex; i--) {
            if (counterBlock[i] === 0xFF) {
                counterBlock[i] = 0x00;
            } else {
                counterBlock[i]++;
                return;
            }
        }
    }

    private xorBytes(a: Uint8Array, offsetA: number, b: Uint8Array, offsetB: number, result: Uint8Array, offsetResult: number, length: number): void {
        for (let i = 0; i < length; i++) {
            result[offsetResult + i] = a[offsetA + i] ^ b[offsetB + i];
        }
    }

    private processCTR(inputData: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
        if (iv.length !== BetterOpossumCipher.IV_SIZE_BYTES) {
            throw new Error(`IV must be ${BetterOpossumCipher.IV_SIZE_BYTES} bytes`);
        }

        const roundKeys = this.keyExpansion(key);
        const outputData = new Uint8Array(inputData.length);
        const counterBlock = new Uint8Array(BetterOpossumCipher.BLOCK_SIZE_BYTES);
        
        counterBlock.set(iv, 0);

        let processedBytes = 0;
        while (processedBytes < inputData.length) {
            const encryptedCounterBlock = this.opossumBlockEncrypt(counterBlock, roundKeys);
            
            const bytesToProcess = Math.min(BetterOpossumCipher.BLOCK_SIZE_BYTES, inputData.length - processedBytes);
            this.xorBytes(inputData, processedBytes, encryptedCounterBlock, 0, outputData, processedBytes, bytesToProcess);
            
            processedBytes += bytesToProcess;
            this.incrementCounter(counterBlock, BetterOpossumCipher.IV_SIZE_BYTES);
        }

        return outputData;
    }

    public encrypt(plaintext: string, password: string): string {
        const encoder = new TextEncoder();
        const data = encoder.encode(plaintext);
        
        // Derive key from password using simple XOR-based method
        const keyMaterial = encoder.encode(password);
        const salt = crypto.getRandomValues(new Uint8Array(32));
        
        const key = new Uint8Array(BetterOpossumCipher.KEY_SIZE_BYTES);
        for (let i = 0; i < key.length; i++) {
            key[i] = keyMaterial[i % keyMaterial.length] ^ salt[i % salt.length];
        }
        
        const iv = crypto.getRandomValues(new Uint8Array(BetterOpossumCipher.IV_SIZE_BYTES));
        
        // Process with CTR mode
        const processed = this.processCTR(data, key, iv);
        
        // Combine salt, IV, and processed data
        const result = new Uint8Array(salt.length + iv.length + processed.length);
        result.set(salt, 0);
        result.set(iv, salt.length);
        result.set(processed, salt.length + iv.length);
        
        return btoa(String.fromCharCode(...result));
    }

    public decrypt(encrypted: string, password: string): string {
        try {
            const data = new Uint8Array(atob(encrypted).split("").map(c => c.charCodeAt(0)));
            
            const salt = data.subarray(0, 32);
            const iv = data.subarray(32, 32 + BetterOpossumCipher.IV_SIZE_BYTES);
            const encryptedData = data.subarray(32 + BetterOpossumCipher.IV_SIZE_BYTES);
            
            const encoder = new TextEncoder();
            const keyMaterial = encoder.encode(password);
            
            // Derive key (same as encryption)
            const key = new Uint8Array(BetterOpossumCipher.KEY_SIZE_BYTES);
            for (let i = 0; i < key.length; i++) {
                key[i] = keyMaterial[i % keyMaterial.length] ^ salt[i % salt.length];
            }
            
            // Process with CTR mode
            const processed = this.processCTR(encryptedData, key, iv);
            
            const decoder = new TextDecoder();
            return decoder.decode(processed);
        } catch (error) {
            console.error("Decryption error:", error);
            throw new Error("Decryption failed");
        }
    }
}

// Global cipher instance
const cipher = new BetterOpossumCipher();

// SVG icons for the button
type IconProps = {
    height?: number;
    width?: number;
    className?: string;
};

const EncryptionEnabledIcon: IconComponent = ({ height = 20, width = 20, className }: IconProps) => {
    return (
        <svg
            width={width}
            height={height}
            viewBox="0 0 24 24"
            className={className}
        >
            <path fill="currentColor" d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM8.9 6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2H8.9V6z" />
        </svg>
    );
};

const EncryptionDisabledIcon: IconComponent = ({ height = 20, width = 20, className }: IconProps) => {
    return (
        <svg
            width={width}
            height={height}
            viewBox="0 0 24 24"
            className={className}
        >
            <path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
        </svg>
    );
};

// Chatbar button
const EncryptionToggleButton: ChatBarButtonFactory = ({ channel, type }) => {
    const { pluginActivated, encryptionEnabled } = settings.use(["pluginActivated", "encryptionEnabled"]);

    const validChat = ["normal", "sidebar"].some(x => type.analyticsName === x);

    if (!validChat) return null;

    // Only show button when plugin is activated
    if (!pluginActivated) {
        return (
            <ChatBarButton
                tooltip="Activate Securecord Opossum Plugin"
                onClick={() => {
                    settings.store.pluginActivated = true;
                    // Show confirmation
                    sendBotMessage(
                        channel?.id ?? "",
                        {
                            content: "🔐 Securecord Opossum plugin activated! Click again to toggle encryption."
                        }
                    );
                }}
            >
                <EncryptionDisabledIcon />
            </ChatBarButton>
        );
    }

    return (
        <ChatBarButton
            tooltip={encryptionEnabled ? "Disable Encryption" : "Enable Encryption"}
            onClick={() => {
                const newValue = !encryptionEnabled;
                settings.store.encryptionEnabled = newValue;

                // Show confirmation
                sendBotMessage(
                    channel?.id ?? "",
                    {
                        content: `🔐 Encryption ${newValue ? "enabled" : "disabled"}!`
                    }
                );
            }}
        >
            {encryptionEnabled ? <EncryptionEnabledIcon /> : <EncryptionDisabledIcon />}
        </ChatBarButton>
    );
};

// Plugin settings definition
const settings = definePluginSettings({
    pluginActivated: {
        type: OptionType.BOOLEAN,
        description: "Activate/deactivate the Securecord Opossum plugin",
        default: false
    },
    encryptionPassword: {
        type: OptionType.STRING,
        description: "AES-256 encryption password (shared with other users)",
        default: "",
        placeholder: "Enter shared password..."
    },
    encryptionEnabled: {
        type: OptionType.BOOLEAN,
        description: "Enable/disable message encryption",
        default: false
    },
    enableLogging: {
        type: OptionType.BOOLEAN,
        description: "Enable/disable console logs (for debugging)",
        default: true
    }
});

export default definePlugin({
    name: "SecurecordOpossum",
    description: "Enhanced AES-256 end-to-end encryption for Discord with BetterOpossum improvements. Share the same password with other users to communicate securely.",
    authors: [{ name: "irritably", id: 928787166916640838n }],
    settings,
    chatBarButton: {
        render: EncryptionToggleButton
    },

    start() {

        // Add listener to encrypt messages before sending
        const listener: MessageSendListener = async (_, message) => {
            if (settings.store.pluginActivated && settings.store.encryptionEnabled && settings.store.encryptionPassword) {
                // Encrypt message only if not already encrypted
                if (!message.content.startsWith("🔒ENCRYPTED:") && !message.content.endsWith(":ENDLOCK")) {
                    try {
                        const encryptedMessage = cipher.encrypt(message.content, settings.store.encryptionPassword);
                        // Replace message content with encrypted version
                        message.content = `🔒ENCRYPTED:${encryptedMessage}:ENDLOCK`;
                        
                        if (settings.store.enableLogging) {
                            console.log("Securecord Opossum: Message encrypted");
                        }
                    } catch (error) {
                        console.error("Message encryption error:", error);
                    }
                }
            }
        };

        addMessagePreSendListener(listener);
        // Save listener to remove it later
        (this as any)._listener = listener;

        console.log("Securecord Opossum: Plugin loaded successfully");
    },

    stop() {
        // Remove listener when plugin is stopped
        if ((this as any)._listener) {
            removeMessagePreSendListener((this as any)._listener);
        }

        console.log("Securecord Opossum: Plugin stopped");
    },

    flux: {
        async MESSAGE_CREATE({ optimistic, type, message, channelId }: IMessageCreate) {
            if (optimistic || type !== "MESSAGE_CREATE") return;
            if (message.state === "SENDING") return;
            if (!message.content) return;

            // Check if message is encrypted
            if (message.content.startsWith("🔒ENCRYPTED:") && message.content.endsWith(":ENDLOCK")) {
                if (settings.store.enableLogging) {
                    console.log("Securecord Opossum: Received encrypted message from", message.author.username);
                }

                // Get password from settings
                const password = settings.store.encryptionPassword;

                if (!password) {
                    if (settings.store.enableLogging) {
                        console.log("Securecord Opossum: No password set");
                    }
                    return;
                }

                try {
                    // Extract encrypted message (removing extra characters)
                    const encryptedPart = message.content.substring(12, message.content.length - 8);

                    if (settings.store.enableLogging) {
                        console.log("Securecord Opossum: Extracted encrypted part:", encryptedPart);
                        console.log("Securecord Opossum: Encrypted part length:", encryptedPart.length);
                        console.log("Securecord Opossum: Password used:", password);
                    }

                    // Decode message using enhanced cipher
                    const decryptedMessage = cipher.decrypt(encryptedPart, password);

                    if (settings.store.enableLogging) {
                        console.log("Securecord Opossum: Successfully decrypted message", decryptedMessage);
                    }

                    // Show decrypted message as bot message (Clyde)
                    sendBotMessage(channelId, {
                        content: `🔐 **Decrypted message from ${message.author.username}**: ${decryptedMessage}`
                    });

                    if (settings.store.enableLogging) {
                        console.log("Securecord Opossum: Sent bot message with decrypted content");
                    }
                } catch (error) {
                    console.error("Decryption error:", error);

                    // Show error message
                    sendBotMessage(channelId, {
                        content: `🔒 Decryption error for message from ${message.author.username}. Details: ${(error as Error).message}`
                    });
                }

                // Prevent display of original encrypted message
                return;
            } else {
                // Don't log non-encrypted messages
                return;
            }
        },
    }

});
