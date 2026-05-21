/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";

const STORE_KEY = "vAnalyzer_modularScanModules";

export interface ModularScanFilter {
    type: "none" | "contains" | "regex";
    pattern: string;
}

export interface ModularScanModule {
    id: string;
    name: string;
    type: "file" | "url";
    method: string;
    url: string;
    headers: Record<string, string>;
    bodyType: "multipart" | "json" | "none";
    fileField: string;
    extraFields: Record<string, string>;
    jsonTemplate: string;
    autoScan: boolean;
    filter: ModularScanFilter;
}

function generateId(): string {
    return Math.random().toString(36).slice(2, 10);
}

let cache: ModularScanModule[] = [];

export function getModulesSync(): ModularScanModule[] {
    return cache;
}

export async function getModules(): Promise<ModularScanModule[]> {
    const modules = (await DataStore.get<ModularScanModule[]>(STORE_KEY)) ?? [];
    cache = modules;
    return modules;
}

export async function saveModules(modules: ModularScanModule[]): Promise<void> {
    cache = modules;
    await DataStore.set(STORE_KEY, modules);
}

export async function addModule(m: Omit<ModularScanModule, "id">): Promise<ModularScanModule> {
    const module: ModularScanModule = { ...m, id: generateId() };
    const all = await getModules();
    all.push(module);
    await saveModules(all);
    return module;
}

export async function updateModule(updated: ModularScanModule): Promise<void> {
    const all = await getModules();
    const idx = all.findIndex(m => m.id === updated.id);
    if (idx !== -1) all[idx] = updated;
    await saveModules(all);
}

export async function deleteModule(id: string): Promise<void> {
    const all = await getModules();
    const next = all.filter(m => m.id !== id);
    await saveModules(next);
}

getModules();
