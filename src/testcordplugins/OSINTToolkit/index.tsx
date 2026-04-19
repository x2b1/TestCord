/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import definePlugin, { OptionType } from "@utils/types";

interface DomainInfo {
    domain: string;
    registrar?: string;
    registrationDate?: string;
    expirationDate?: string;
    updatedAt?: string;
    status?: string[];
    nameServers?: string[];
    dnssec?: string;
}

interface IPInfo {
    ip: string;
    city?: string;
    region?: string;
    country?: string;
    countryName?: string;
    lat?: number;
    lon?: number;
    org?: string;
    isp?: string;
    timezone?: string;
    zip?: string;
}

const settings = definePluginSettings({
    enableLogging: {
        type: OptionType.BOOLEAN,
        description: "Enable debug logging",
        default: false
    },
    availableCommands: {
        type: OptionType.STRING,
        description:
            "Available commands:\n" +
            "/domain <domain> - Lookup a domain via RDAP\n" +
            "/iplookup <ipv4> - Lookup an IPv4 address\n" +
            "/myip - Show your public IP information\n" +
            "/usersearch <username> - Generate a usersearch.org link for a username\n" +
            "\n" +
            "Example:\n" +
            "/domain google.com\n" +
            "/iplookup 1.1.1.1\n" +
            "/myip\n" +
            "/usersearch johndoe",
        default: "OSINTToolkit command list"
    }
});

function logDebug(...args: any[]) {
    if (settings.store.enableLogging) {
        console.log("[OSINT]", ...args);
    }
}

function normalizeDomain(input: string): string {
    return input
        .toLowerCase()
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/.*$/, "")
        .replace(/\.$/, "");
}

function isValidIPv4(ip: string): boolean {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) return false;

    return ip.split(".").every(octet => {
        const num = Number(octet);
        return Number.isInteger(num) && num >= 0 && num <= 255;
    });
}

function normalizeUsername(input: string): string {
    return input.trim().replace(/^@+/, "");
}

async function getDomainInfo(domain: string): Promise<DomainInfo | null> {
    try {
        const response = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`);

        if (!response.ok) {
            throw new Error(`RDAP lookup failed with status ${response.status}`);
        }

        const data = await response.json();

        let registrar = "Unknown";
        if (Array.isArray(data.entities)) {
            const registrarEntity = data.entities.find((e: any) =>
                Array.isArray(e.roles) && e.roles.includes("registrar")
            );

            if (registrarEntity?.vcardArray?.[1]) {
                const fn = registrarEntity.vcardArray[1].find((p: any) => p[0] === "fn");
                if (fn?.[3]) {
                    registrar = fn[3];
                }
            }
        }

        const registrationDate =
            data.events?.find((e: any) => e.eventAction === "registration")?.eventDate ??
            data.events?.find((e: any) => e.eventAction === "registered")?.eventDate;

        const expirationDate =
            data.events?.find((e: any) => e.eventAction === "expiration")?.eventDate ??
            data.events?.find((e: any) => e.eventAction === "expire")?.eventDate;

        const updatedAt =
            data.events?.find((e: any) => e.eventAction === "last changed")?.eventDate ??
            data.events?.find((e: any) => e.eventAction === "last update of RDAP database")?.eventDate;

        return {
            domain: data.ldhName || domain,
            registrar,
            registrationDate,
            expirationDate,
            updatedAt,
            status: Array.isArray(data.status) ? data.status : [],
            nameServers: Array.isArray(data.nameservers)
                ? data.nameservers.map((ns: any) => ns.ldhName).filter(Boolean)
                : [],
            dnssec: data.secureDNS?.delegationSigned ? "signed" : "unsigned"
        };
    } catch (error) {
        console.error("Domain lookup error:", error);
        return null;
    }
}

async function getIPInfo(ip: string): Promise<IPInfo | null> {
    try {
        const response = await fetch(`https://free.freeipapi.com/api/json/${encodeURIComponent(ip)}`);

        if (!response.ok) {
            throw new Error(`IP lookup failed with status ${response.status}`);
        }

        const data = await response.json();

        const timezone =
            Array.isArray(data.timeZones) && data.timeZones.length > 0
                ? data.timeZones[0]
                : data.timeZone || data.timezone;

        return {
            ip: data.ipAddress || data.ip || ip,
            city: data.cityName || data.city,
            region: data.regionName || data.region,
            country: data.countryCode || data.country,
            countryName: data.countryName || data.country,
            lat: typeof data.latitude === "number" ? data.latitude : undefined,
            lon: typeof data.longitude === "number" ? data.longitude : undefined,
            org: data.organization || data.asnOrganization || data.org,
            isp: data.isp || data.asnOrganization,
            timezone,
            zip: data.zipCode || data.zip
        };
    } catch (error) {
        console.error("IP lookup error:", error);
        return null;
    }
}

async function getMyIP(): Promise<IPInfo | null> {
    try {
        const response = await fetch("https://free.freeipapi.com/api/json");

        if (!response.ok) {
            throw new Error(`My IP lookup failed with status ${response.status}`);
        }

        const data = await response.json();

        const timezone =
            Array.isArray(data.timeZones) && data.timeZones.length > 0
                ? data.timeZones[0]
                : data.timeZone || data.timezone;

        return {
            ip: data.ipAddress || data.ip,
            city: data.cityName || data.city,
            region: data.regionName || data.region,
            country: data.countryCode || data.country,
            countryName: data.countryName || data.country,
            lat: typeof data.latitude === "number" ? data.latitude : undefined,
            lon: typeof data.longitude === "number" ? data.longitude : undefined,
            org: data.organization || data.asnOrganization || data.org,
            isp: data.isp || data.asnOrganization,
            timezone,
            zip: data.zipCode || data.zip
        };
    } catch (error) {
        console.error("My IP lookup error:", error);
        return null;
    }
}

function calculateDomainAge(registrationDate: string): string {
    const now = new Date();
    const regDate = new Date(registrationDate);

    if (Number.isNaN(regDate.getTime())) {
        return "Unknown";
    }

    const diffTime = Math.abs(now.getTime() - regDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    const days = (diffDays % 365) % 30;

    return `${years}y ${months}m ${days}d`;
}

function createDomainMessage(info: DomainInfo) {
    const ageText = info.registrationDate ? calculateDomainAge(info.registrationDate) : "Unknown";

    return [
        "```txt",
        `[DOMAIN LOOKUP] ${info.domain}`,
        `Registration : ${info.registrationDate || "N/A"}`,
        `Age          : ${ageText}`,
        `Expiration   : ${info.expirationDate || "N/A"}`,
        `Registrar    : ${info.registrar || "Unknown"}`,
        `Updated      : ${info.updatedAt || "N/A"}`,
        `DNSSEC       : ${info.dnssec || "N/A"}`,
        `Status       : ${info.status?.length ? info.status.join(", ") : "N/A"}`,
        "```"
    ].join("\n");
}

function createIPMessage(info: IPInfo) {
    const coordinates =
        typeof info.lat === "number" && typeof info.lon === "number"
            ? `${info.lat}, ${info.lon}`
            : "Unknown";

    return [
        "```txt",
        `[IP LOOKUP] ${info.ip}`,
        `City         : ${info.city || "Unknown"}`,
        `Region       : ${info.region || "Unknown"}`,
        `Country      : ${info.countryName || "Unknown"} (${info.country || "?"})`,
        `Timezone     : ${info.timezone || "Unknown"}`,
        `ZIP Code     : ${info.zip || "Unknown"}`,
        `ISP          : ${info.isp || "Unknown"}`,
        `Organization : ${info.org || "Unknown"}`,
        `Coordinates  : ${coordinates}`,
        "```"
    ].join("\n");
}

export default definePlugin({
    name: "OSINTToolkit",
    description: "OSINT - Domain age lookup, IP information, and username search",
    tags: ["Utility", "Developers"],
    authors: [{ name: "Irritably", id: 928787166916640838n }],
    settings,

    commands: [
        {
            name: "domain",
            description: "Get domain registration information and age",
            inputType: ApplicationCommandInputType.BUILT_IN,
            predicate: () => true,
            options: [
                {
                    name: "domain",
                    description: "The domain to lookup (e.g., google.com)",
                    type: 3,
                    required: true
                }
            ],
            execute: async (args: any[], ctx: any) => {
                const channelId = ctx.channel.id;
                const domainInput = args[0]?.value as string;

                if (!domainInput) {
                    sendBotMessage(channelId, { content: "Please provide a domain name!" });
                    return;
                }

                const domain = normalizeDomain(domainInput);
                logDebug("Looking up domain:", domain);

                try {
                    const info = await getDomainInfo(domain);

                    if (!info) {
                        sendBotMessage(channelId, {
                            content: `Failed to retrieve information for **${domain}**\nPossible reasons:\n• Domain doesn't exist\n• RDAP server unavailable\n• Invalid domain format`
                        });
                        return;
                    }

                    sendBotMessage(channelId, { content: createDomainMessage(info) });
                } catch {
                    sendBotMessage(channelId, {
                        content: `An unexpected error occurred while looking up **${domain}**`
                    });
                }
            }
        },
        {
            name: "iplookup",
            description: "Get geolocation and network information for an IP",
            inputType: ApplicationCommandInputType.BUILT_IN,
            predicate: () => true,
            options: [
                {
                    name: "ip",
                    description: "The IP address to lookup (IPv4)",
                    type: 3,
                    required: true
                }
            ],
            execute: async (args: any[], ctx: any) => {
                const channelId = ctx.channel.id;
                const ipInput = args[0]?.value as string;

                if (!ipInput) {
                    sendBotMessage(channelId, { content: "Please provide an IP address!" });
                    return;
                }

                const ip = ipInput.trim();

                if (!isValidIPv4(ip)) {
                    sendBotMessage(channelId, {
                        content: "Invalid IP address format! Please use IPv4 format (e.g., 8.8.8.8)"
                    });
                    return;
                }

                logDebug("Looking up IP:", ip);

                try {
                    const info = await getIPInfo(ip);

                    if (!info) {
                        sendBotMessage(channelId, {
                            content: `Failed to retrieve information for **${ip}**\nPossible reasons:\n• Provider unavailable\n• Rate limit exceeded\n• Network error\n• Unsupported IP format`
                        });
                        return;
                    }

                    sendBotMessage(channelId, { content: createIPMessage(info) });
                } catch {
                    sendBotMessage(channelId, {
                        content: `An unexpected error occurred while looking up **${ip}**`
                    });
                }
            }
        },
        {
            name: "myip",
            description: "Show your public IP address and geolocation",
            inputType: ApplicationCommandInputType.BUILT_IN,
            predicate: () => true,
            execute: async (_args: any[], ctx: any) => {
                const channelId = ctx.channel.id;

                try {
                    const info = await getMyIP();

                    if (!info) {
                        sendBotMessage(channelId, {
                            content: "Failed to retrieve your IP information.\nPossible reasons:\n• Provider unavailable\n• Rate limit exceeded\n• Network error"
                        });
                        return;
                    }

                    sendBotMessage(channelId, { content: createIPMessage(info) });
                } catch {
                    sendBotMessage(channelId, {
                        content: "An unexpected error occurred while retrieving your IP."
                    });
                }
            }
        },
        {
            name: "usersearch",
            description: "Generate a usersearch.org link for a username",
            inputType: ApplicationCommandInputType.BUILT_IN,
            predicate: () => true,
            options: [
                {
                    name: "username",
                    description: "The username to search (e.g., johndoe)",
                    type: 3,
                    required: true
                }
            ],
            execute: async (args: any[], ctx: any) => {
                const channelId = ctx.channel.id;
                const usernameInput = args[0]?.value as string;

                if (!usernameInput) {
                    sendBotMessage(channelId, { content: "Please provide a username!" });
                    return;
                }

                const username = normalizeUsername(usernameInput);

                if (!username) {
                    sendBotMessage(channelId, { content: "Invalid username!" });
                    return;
                }

                const searchUrl = `https://usersearch.org/results.php?type=standard&URL_username=${encodeURIComponent(username)}`;
                const whatsMyNameUrl = `https://whatsmyname.app/?q=${encodeURIComponent(username)}`;

                logDebug("Generating usersearch link for:", username);

                sendBotMessage(channelId, {
                    content: [
                        "```txt",
                        `[USER SEARCH] ${username}`,
                        `Link UserSearch : ${searchUrl}`,
                        `Link Whatsmyname : ${whatsMyNameUrl}`,
                        "```"
                    ].join("\n")
                });
            }
        }
    ]
});
