/*
 * ThemeStore — native.ts
 * Runs in the Electron MAIN process (Node.js) — no CORS, no CSP.
 * Exposed via VencordNative.pluginHelpers.ThemeStore.fetchUrl()
 */

import { net } from "electron";

/**
 * Fetches a URL from the Electron main process using electron.net.
 * Handles redirects manually and sends proper browser-like headers
 * so the BetterDiscord API returns JSON instead of an HTML error page.
 */
export function fetchUrl(_event: any, url: string): Promise<string> {
    return fetchWithRedirects(url, 5);
}

function fetchWithRedirects(url: string, remainingRedirects: number): Promise<string> {
    return new Promise((resolve, reject) => {
        if (remainingRedirects <= 0) {
            return reject(new Error("Too many redirects"));
        }

        try {
            const request = net.request({
                url,
                method: "GET",
                // Use session to handle cookies / TLS properly
                useSessionCookies: false,
            });

            // Send headers that make the server return JSON
            request.setHeader("Accept", "application/json, text/plain, */*");
            request.setHeader("Accept-Language", "en-US,en;q=0.9");
            request.setHeader(
                "User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            );
            request.setHeader("Cache-Control", "no-cache");
            request.setHeader("Pragma", "no-cache");

            const chunks: Buffer[] = [];

            request.on("response", (response: any) => {
                const status   = response.statusCode as number;
                const location = response.headers?.location as string | undefined;

                // Follow 3xx redirects
                if (status >= 300 && status < 400 && location) {
                    // Resolve relative redirect URLs
                    const redirectUrl = location.startsWith("http")
                        ? location
                        : new URL(location, url).toString();
                    resolve(fetchWithRedirects(redirectUrl, remainingRedirects - 1));
                    return;
                }

                if (status < 200 || status >= 300) {
                    reject(new Error(`HTTP ${status} from ${url}`));
                    return;
                }

                response.on("data",  (chunk: Buffer) => chunks.push(chunk));
                response.on("end",   () => resolve(Buffer.concat(chunks).toString("utf-8")));
                response.on("error", (err: Error) => reject(err));
            });

            request.on("error", (err: Error) => reject(err));
            request.end();
        } catch (err) {
            reject(err);
        }
    });
}
