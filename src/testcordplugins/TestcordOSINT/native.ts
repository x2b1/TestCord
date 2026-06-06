import { IpcMainInvokeEvent } from "electron";

export interface NativeOSINTResponse {
    status: number;
    body: string;
    error?: string;
    headers?: Record<string, string>;
}

export async function osintFetch(
    _: IpcMainInvokeEvent,
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string
): Promise<NativeOSINTResponse> {
    try {
        const response = await fetch(url, {
            method,
            headers: {
                "Content-Type": "application/json",
                ...headers,
            },
            body,
        });
        return {
            status: response.status,
            body: await response.text(),
            headers: Object.fromEntries(response.headers.entries()),
        };
    } catch (error) {
        return {
            status: -1,
            body: "",
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

export interface NativeCordCatResult {
    ok: boolean;
    status?: number;
    body?: string;
    error?: string;
}

export async function fetchCordCat(
    _: IpcMainInvokeEvent,
    parsedId: string
): Promise<NativeCordCatResult> {
    try {
        const response = await fetch(`https://api.cord.cat/api/v2/query/${encodeURIComponent(parsedId)}`, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(10_000),
        });
        return {
            ok: true,
            status: response.status,
            body: await response.text(),
        };
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
