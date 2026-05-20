/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Resolver } from "dns";

export type DnsFamily = 4 | 6;

export interface DnsResolveResult {
    success: boolean;
    hostname: string;
    server: string;
    family: DnsFamily;
    addresses: string[];
    error?: string;
}

const DEFAULT_TIMEOUT_MS = 5000;

const resolverCache = new Map<string, Resolver>();

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function normalizeServers(servers: string[]) {
    return servers
        .map(server => server.trim())
        .filter(Boolean);
}

function getResolver(servers: string[]) {
    const cacheKey = servers.join(",");
    const cachedResolver = resolverCache.get(cacheKey);
    if (cachedResolver) return cachedResolver;

    const resolver = new Resolver();
    resolver.setServers(servers);
    resolverCache.set(cacheKey, resolver);
    return resolver;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("DNS request timed out.")), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timeout != null) clearTimeout(timeout);
    });
}

function resolveWithResolver(resolver: Resolver, hostname: string, family: DnsFamily) {
    return new Promise<string[]>((resolve, reject) => {
        const callback = (error: NodeJS.ErrnoException | null, addresses: string[]) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(addresses);
        };

        if (family === 6) {
            resolver.resolve6(hostname, callback);
            return;
        }

        resolver.resolve4(hostname, callback);
    });
}

async function resolveHost(hostname: string, servers: string[], family: DnsFamily, timeoutMs: number): Promise<DnsResolveResult> {
    const normalizedServers = normalizeServers(servers);

    if (!normalizedServers.length) {
        return {
            success: false,
            hostname,
            server: "",
            family,
            addresses: [],
            error: "No DNS servers configured."
        };
    }

    try {
        const resolver = getResolver(normalizedServers);
        const addresses = await withTimeout(resolveWithResolver(resolver, hostname, family), timeoutMs);

        return {
            success: addresses.length > 0,
            hostname,
            server: normalizedServers.join(", "),
            family,
            addresses,
            error: addresses.length > 0 ? undefined : "No addresses returned."
        };
    } catch (error) {
        return {
            success: false,
            hostname,
            server: normalizedServers.join(", "),
            family,
            addresses: [],
            error: getErrorMessage(error)
        };
    }
}

export async function resolveDNS(
    _event: Electron.IpcMainInvokeEvent,
    hostname: string,
    servers: string[],
    family: DnsFamily = 4,
    timeoutMs = DEFAULT_TIMEOUT_MS
) {
    return resolveHost(hostname, servers, family, timeoutMs);
}

export async function preloadDNS(
    _event: Electron.IpcMainInvokeEvent,
    hostnames: string[],
    servers: string[],
    family: DnsFamily = 4,
    timeoutMs = DEFAULT_TIMEOUT_MS
) {
    const results = await Promise.all(hostnames.map(async hostname => {
        const result = await resolveHost(hostname, servers, family, timeoutMs);
        return [hostname, result.addresses] as const;
    }));

    return Object.fromEntries(results.filter(([, addresses]) => addresses.length));
}
