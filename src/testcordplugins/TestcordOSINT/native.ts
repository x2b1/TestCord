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
