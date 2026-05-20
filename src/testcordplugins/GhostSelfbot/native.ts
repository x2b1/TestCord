/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { execSync, spawn } from "child_process";
import { IpcMainInvokeEvent } from "electron";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const logger = new Logger("GhostSelfbotNative");

export interface GhostToken {
    token: string;
    username: string;
    id: string;
}

export interface GhostStatus {
    ghostExeFound: boolean;
    ghostSourceFound: boolean;
    pythonFound: boolean;
    requirementsFound: boolean;
}

let ghostPluginPath: string | null = null;

function detectGhostPluginPath(): string {
    if (ghostPluginPath) return ghostPluginPath;

    // Try multiple strategies to find the plugin directory
    try {
        // Strategy 1: Use __dirname (works in development)
        logger.log("__dirname is:", __dirname);

        // Check if Ghost.exe exists in __dirname
        const { existsSync } = require("fs");
        if (existsSync(join(__dirname, "Ghost.exe"))) {
            logger.log("Found Ghost.exe in __dirname");
            ghostPluginPath = __dirname;
            return ghostPluginPath;
        }

        // Strategy 2: Try going up from dist/desktop to src/userplugins
        // __dirname might be like: C:\...\Illegalcord\dist\desktop
        // We need: C:\...\Illegalcord\src\userplugins\GhostSelfbot
        const path = require("path");
        const possiblePath = join(__dirname, "..", "..", "src", "userplugins", "GhostSelfbot");
        logger.log("Trying alternative path:", possiblePath);

        if (existsSync(join(possiblePath, "Ghost.exe"))) {
            logger.log("Found Ghost.exe in alternative path");
            ghostPluginPath = possiblePath;
            return ghostPluginPath;
        }

        // Strategy 3: Check if we're in src/userplugins already
        if (__dirname.includes("userplugins") && __dirname.includes("GhostSelfbot")) {
            logger.log("__dirname already contains GhostSelfbot path");
            ghostPluginPath = __dirname;
            return ghostPluginPath;
        }

        logger.error("Could not find Ghost.exe in any expected location");
        logger.error("__dirname:", __dirname);
        logger.error("Tried:", join(__dirname, "Ghost.exe"));
        logger.error("Tried:", join(possiblePath, "Ghost.exe"));

        ghostPluginPath = __dirname;
        return ghostPluginPath;
    } catch (error) {
        logger.error("Failed to detect Ghost plugin path:", error);
        ghostPluginPath = __dirname;
        return ghostPluginPath;
    }
}

export function getGhostExePath(): string {
    const pluginDir = detectGhostPluginPath();
    const exePath = join(pluginDir, "Ghost.exe");
    logger.log("Checking Ghost.exe at:", exePath);
    return exePath;
}

export function getGhostSourcePath(): string {
    const pluginDir = detectGhostPluginPath();
    const sourcePath = join(pluginDir, "ghost-4.2.0 (Source Code)");
    logger.log("Checking Ghost source at:", sourcePath);
    return sourcePath;
}

export function getGhostConfigPath(): string {
    return join(process.env.APPDATA || "", "Ghost/config.json");
}

export function getGhostTokensPath(): string {
    return join(process.env.APPDATA || "", "Ghost/data/sensitive/tokens.json");
}

export function getGhostRequirementsPath(): string {
    const ghostSourcePath = getGhostSourcePath();
    return ghostSourcePath ? join(ghostSourcePath, "requirements.txt") : "";
}

export function checkPythonInstalled(_event: IpcMainInvokeEvent, pythonPath: string): boolean {
    try {
        execSync(`${pythonPath} --version`, { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}

export function installRequirements(_event: IpcMainInvokeEvent, pythonPath: string): boolean {
    try {
        const requirementsPath = getGhostRequirementsPath();

        if (!requirementsPath) {
            logger.error("Could not find requirements.txt path");
            return false;
        }

        if (!existsSync(requirementsPath)) {
            logger.error("requirements.txt not found in Ghost source directory");
            return false;
        }

        logger.log("Installing Python requirements...");
        execSync(`${pythonPath} -m pip install -r "${requirementsPath}"`, {
            stdio: "inherit"
        });

        logger.log("Python requirements installed successfully");
        return true;
    } catch (error) {
        logger.error("Failed to install requirements:", error);
        return false;
    }
}

export function updateGhostConfig(_event: IpcMainInvokeEvent, token: string): boolean {
    try {
        const ghostConfigPath = getGhostConfigPath();
        const ghostTokensPath = getGhostTokensPath();

        if (!existsSync(ghostConfigPath)) {
            logger.error("Ghost config not found. Please run Ghost.exe first to create config.");
            return false;
        }

        const config = JSON.parse(readFileSync(ghostConfigPath, "utf-8"));
        config.token = token;
        writeFileSync(ghostConfigPath, JSON.stringify(config, null, 4));

        if (existsSync(ghostTokensPath)) {
            const tokens: GhostToken[] = JSON.parse(readFileSync(ghostTokensPath, "utf-8"));
            const { UserStore } = require("@webpack/common");
            const currentUser = UserStore.getCurrentUser();
            const existingIndex = tokens.findIndex((t: GhostToken) => t.id === currentUser.id);

            if (existingIndex >= 0) {
                tokens[existingIndex].token = token;
                tokens[existingIndex].username = currentUser.username;
            } else {
                tokens.push({
                    token: token,
                    username: currentUser.username,
                    id: currentUser.id
                });
            }

            writeFileSync(ghostTokensPath, JSON.stringify(tokens, null, 4));
        }

        return true;
    } catch (error) {
        logger.error("Failed to update Ghost config:", error);
        return false;
    }
}

export function launchGhostExe(_event: IpcMainInvokeEvent, autoFillToken: boolean, token: string | null, nitroWebhookUrl: string, privnoteWebhookUrl: string, autoSetupWebhooks: boolean): void {
    const ghostExePath = getGhostExePath();

    if (!ghostExePath || !existsSync(ghostExePath)) {
        throw new Error("Ghost.exe not found");
    }

    if (autoFillToken && token) {
        updateGhostConfig(_event, token);
        logger.log("Token updated in Ghost config");
    }

    if (nitroWebhookUrl || privnoteWebhookUrl) {
        updateGhostWebhooks(_event, nitroWebhookUrl, privnoteWebhookUrl);
    }

    if (autoSetupWebhooks) {
        enableWebhookSetup(_event);
    }

    // Ensure fonts and data are accessible by setting working directory
    const ghostPluginDir = detectGhostPluginPath();
    const options = {
        cwd: ghostPluginDir,
        env: {
            ...process.env,
            GHOST_PLUGIN_DIR: ghostPluginDir
        }
    };

    logger.log("Launching Ghost.exe from directory:", ghostPluginDir);
    const child = spawn(ghostExePath, [], options);

    child.on("error", error => {
        logger.error("Failed to start Ghost.exe:", error.message);
    });

    child.on("exit", code => {
        logger.log("Ghost.exe exited with code:", code);
    });
}

export function launchGhostSource(_event: IpcMainInvokeEvent, autoFillToken: boolean, autoInstallRequirements: boolean, pythonPath: string, token: string | null, nitroWebhookUrl: string, privnoteWebhookUrl: string, autoSetupWebhooks: boolean): void {
    const ghostSourcePath = getGhostSourcePath();

    if (!ghostSourcePath || !existsSync(ghostSourcePath)) {
        throw new Error("Ghost source code not found");
    }

    if (!checkPythonInstalled(_event, pythonPath)) {
        throw new Error(`Python not found at ${pythonPath}`);
    }

    if (autoInstallRequirements) {
        if (!installRequirements(_event, pythonPath)) {
            throw new Error("Failed to install Python requirements");
        }
    }

    if (autoFillToken && token) {
        updateGhostConfig(_event, token);
        logger.log("Token updated in Ghost config");
    }

    if (nitroWebhookUrl || privnoteWebhookUrl) {
        updateGhostWebhooks(_event, nitroWebhookUrl, privnoteWebhookUrl);
    }

    if (autoSetupWebhooks) {
        enableWebhookSetup(_event);
    }

    const ghostPy = join(ghostSourcePath, "ghost.py");

    if (!existsSync(ghostPy)) {
        throw new Error("ghost.py not found in source directory");
    }

    const child = spawn(pythonPath, [ghostPy], {
        cwd: ghostSourcePath,
        detached: true,
        stdio: "ignore"
    });

    child.unref();
}

export function checkGhostSetup(_event: IpcMainInvokeEvent, pythonPath: string): GhostStatus {
    const ghostExePath = getGhostExePath();
    const ghostSourcePath = getGhostSourcePath();
    const requirementsPath = getGhostRequirementsPath();

    return {
        ghostExeFound: !!(ghostExePath && existsSync(ghostExePath)),
        ghostSourceFound: !!(ghostSourcePath && existsSync(ghostSourcePath)),
        pythonFound: checkPythonInstalled(_event, pythonPath),
        requirementsFound: !!(requirementsPath && existsSync(requirementsPath))
    };
}

export function updateGhostWebhooks(_event: IpcMainInvokeEvent, nitroWebhookUrl: string, privnoteWebhookUrl: string): boolean {
    try {
        const ghostConfigPath = getGhostConfigPath();

        if (!existsSync(ghostConfigPath)) {
            logger.error("Ghost config not found. Please run Ghost.exe first to create config.");
            return false;
        }

        const config = JSON.parse(readFileSync(ghostConfigPath, "utf-8"));

        if (nitroWebhookUrl) {
            if (!config.snipers) config.snipers = {};
            if (!config.snipers.nitro) config.snipers.nitro = {};
            config.snipers.nitro.webhook = nitroWebhookUrl;
            logger.log("Nitro sniper webhook updated");
        }

        if (privnoteWebhookUrl) {
            if (!config.snipers) config.snipers = {};
            if (!config.snipers.privnote) config.snipers.privnote = {};
            config.snipers.privnote.webhook = privnoteWebhookUrl;
            logger.log("Privnote sniper webhook updated");
        }

        writeFileSync(ghostConfigPath, JSON.stringify(config, null, 4));
        return true;
    } catch (error) {
        logger.error("Failed to update Ghost webhooks:", error);
        return false;
    }
}

export function enableWebhookSetup(_event: IpcMainInvokeEvent): boolean {
    try {
        const cacheDir = join(process.env.APPDATA || "", "Ghost/data/cache");
        const webhookFlagPath = join(cacheDir, "CREATE_WEBHOOKS");

        if (!existsSync(cacheDir)) {
            require("fs").mkdirSync(cacheDir, { recursive: true });
        }

        writeFileSync(webhookFlagPath, "True");
        logger.log("Webhook auto-setup enabled");
        return true;
    } catch (error) {
        logger.error("Failed to enable webhook setup:", error);
        return false;
    }
}
