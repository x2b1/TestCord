/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { readFileSync, statSync } from "fs";
import { join } from "path";
import { Dirent } from "fs";

export interface PluginData {
    name: string;
    description: string;
    authors: Array<{
        name: string;
        id: string;
    }>;
    dependencies?: string[];
    hasPatches?: boolean;
    required?: boolean;
}

const devs = new Map<string, { name: string; id: string; }>();
const equicordDevs = new Map<string, { name: string; id: string; }>();

export function parseDevs() {
    try {
        const content = readFileSync(join(process.cwd(), "src/utils/constants.ts"), "utf-8");
        const devsMatch = content.match(/export const Devs = Object\.freeze\(\{([^}]+)\}\)/);
        if (!devsMatch) return;

        const devsContent = devsMatch[1];
        const devEntries = devsContent.matchAll(/(\w+):\s*\{\s*name:\s*"([^"]+)",\s*id:\s*(\d+)n?\s*\}/g);

        for (const match of devEntries) {
            const [, key, name, id] = match;
            devs.set(key, { name, id });
        }
    } catch (error) {
        console.warn("Could not parse Devs constant:", error);
    }
}

export function parseEquicordDevs() {
    try {
        const content = readFileSync(join(process.cwd(), "src/utils/constants.ts"), "utf-8");
        const equicordDevsMatch = content.match(/export const EquicordDevs = Object\.freeze\(\{([^}]+)\}\)/);
        if (!equicordDevsMatch) {
            throw new Error("Could not find EquicordDevs constant");
        }

        const equicordDevsContent = equicordDevsMatch[1];
        const devEntries = equicordDevsContent.matchAll(/(\w+):\s*\{\s*name:\s*"([^"]+)",\s*id:\s*(\d+)n?\s*\}/g);

        for (const match of devEntries) {
            const [, key, name, id] = match;
            equicordDevs.set(key, { name, id });
        }
    } catch (error) {
        throw new Error("Could not find EquicordDevs constant");
    }
}

export function isPluginFile(dirent: Dirent) {
    if (!dirent.isFile()) return false;
    const name = dirent.name;
    if (name.startsWith("_") || name.startsWith(".")) return false;
    if (/\.(zip|rar|7z|tar|gz|bz2)/.test(name)) return false;
    return /\.(ts|tsx|js|jsx)$/.test(name) && !name.includes(".d.ts");
}

export async function getEntryPoint(dir: string, dirent: Dirent) {
    const fullPath = join(dir, dirent.name);
    if (dirent.isFile()) {
        return fullPath;
    }

    // For directories, look for index files
    for (const file of ["index.ts", "index.tsx", "index.js", "index.jsx"]) {
        try {
            const indexPath = join(fullPath, file);
            statSync(indexPath);
            return indexPath;
        } catch {
            continue;
        }
    }

    throw new Error(`No entry point found for ${fullPath}`);
}

export async function parseFile(filePath: string): Promise<[PluginData]> {
    const content = readFileSync(filePath, "utf-8");

    // Extract plugin definition
    const definePluginMatch = content.match(/definePlugin\(\{([^}]+)\}\)/s);
    if (!definePluginMatch) {
        throw new Error(`No definePlugin call found in ${filePath}`);
    }

    const pluginDef = definePluginMatch[1];

    // Extract name
    const nameMatch = pluginDef.match(/name:\s*["'`]([^"'`]+)["'`]/);
    const name = nameMatch ? nameMatch[1] : "Unknown";

    // Extract description
    const descMatch = pluginDef.match(/description:\s*["'`]([^"'`]+)["'`]/);
    const description = descMatch ? descMatch[1] : "";

    // Extract authors
    const authors: Array<{ name: string; id: string; }> = [];
    const authorsMatch = pluginDef.match(/authors:\s*\[([^\]]+)\]/);
    if (authorsMatch) {
        const authorsContent = authorsMatch[1];
        const authorRefs = authorsContent.matchAll(/(?:Devs|EquicordDevs)\.(\w+)/g);

        for (const match of authorRefs) {
            const [, devKey] = match;
            const dev = devs.get(devKey) || equicordDevs.get(devKey);
            if (dev) {
                authors.push(dev);
            }
        }
    }

    // Extract dependencies
    const dependencies: string[] = [];
    const depsMatch = pluginDef.match(/dependencies:\s*\[([^\]]+)\]/);
    if (depsMatch) {
        const depsContent = depsMatch[1];
        const depMatches = depsContent.matchAll(/["'`]([^"'`]+)["'`]/g);
        for (const match of depMatches) {
            dependencies.push(match[1]);
        }
    }

    // Check for patches
    const hasPatches = /patches:\s*\[/.test(pluginDef);

    // Check if required
    const required = /required:\s*true/.test(pluginDef);

    return [{
        name,
        description,
        authors,
        dependencies: dependencies.length > 0 ? dependencies : undefined,
        hasPatches,
        required
    }];
}
