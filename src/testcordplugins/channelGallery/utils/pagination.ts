import { Constants, RestAPI } from "@webpack/common";

const FETCH_TIMEOUT_MS = 10_000;

export async function fetchMessagesPage(args: {
    channelId: string;
    before: string | null;
    limit: number;
    signal?: AbortSignal;
}): Promise<any[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    // Prefer caller-provided abort, but still apply a hard timeout.
    const signal = args.signal;
    if (signal) {
        if (signal.aborted) controller.abort();
        else signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    try {
        const res = await (RestAPI.get as any)({
            url: Constants.Endpoints.MESSAGES(args.channelId),
            query: {
                limit: args.limit,
                ...(args.before ? { before: args.before } : {})
            },
            signal: controller.signal,
            retries: 1
        });

        const body = res?.body;
        return Array.isArray(body) ? body : [];
    } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        throw new Error("fetch_failed");
    } finally {
        clearTimeout(timeout);
    }
}

