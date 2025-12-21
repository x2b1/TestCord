const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif"]);

function getExt(name?: string): string {
    if (!name) return "";
    const idx = name.lastIndexOf(".");
    if (idx === -1) return "";
    return name.slice(idx + 1).toLowerCase();
}

function isSpoiler(attachment: any): boolean {
    const filename = String(attachment?.filename ?? "");
    return Boolean(attachment?.spoiler) || filename.startsWith("SPOILER_");
}

function isAllowedImageFilename(name: string | undefined, includeGifs: boolean) {
    const ext = getExt(name);
    if (!ext) return false;
    if (!includeGifs && ext === "gif") return false;
    return IMAGE_EXTS.has(ext);
}

function isImageAttachment(att: any, includeGifs: boolean): boolean {
    if (!att?.url) return false;
    if (isSpoiler(att)) return false;

    const ct = String(att?.content_type ?? "").toLowerCase();
    if (ct.startsWith("image/")) {
        if (!includeGifs && ct === "image/gif") return false;
        return true;
    }

    return isAllowedImageFilename(att?.filename, includeGifs);
}

function isImageUrl(url: string, includeGifs: boolean): boolean {
    if (!/^https?:\/\//i.test(url)) return false;
    // Some embed URLs omit extensions; be conservative and require an image-like extension.
    const ext = getExt(url.split("?")[0]);
    if (!ext) return false;
    if (!includeGifs && ext === "gif") return false;
    return IMAGE_EXTS.has(ext);
}

export type GalleryItem = {
    key: string;
    channelId: string;
    messageId: string;
    url: string;
    proxyUrl?: string;
    width?: number;
    height?: number;
    filename?: string;
    authorId?: string;
    timestamp?: string;
};

export function extractImages(messages: any[], channelId: string, opts: { includeGifs: boolean; includeEmbeds: boolean; }): GalleryItem[] {
    const items: GalleryItem[] = [];

    for (const m of messages ?? []) {
        const messageId = String(m?.id ?? "");
        if (!messageId) continue;

        const base = {
            channelId,
            messageId,
            authorId: m?.author?.id ? String(m.author.id) : undefined,
            timestamp: m?.timestamp ? String(m.timestamp) : undefined
        };

        for (const a of m?.attachments ?? []) {
            if (!isImageAttachment(a, opts.includeGifs)) continue;
            const url = String(a.url);
            const proxyUrl = a.proxy_url ? String(a.proxy_url) : undefined;
            const filename = a.filename ? String(a.filename) : undefined;
            const width = typeof a.width === "number" ? a.width : undefined;
            const height = typeof a.height === "number" ? a.height : undefined;

            items.push({
                ...base,
                key: `${messageId}:${url}`,
                url,
                proxyUrl,
                filename,
                width,
                height
            });
        }

        if (opts.includeEmbeds) {
            for (const e of m?.embeds ?? []) {
                const image = e?.image;
                const thumb = e?.thumbnail;

                for (const source of [image, thumb]) {
                    if (!source?.url) continue;
                    const url = String(source.url);
                    if (!isImageUrl(url, opts.includeGifs)) continue;

                    items.push({
                        ...base,
                        key: `${messageId}:${url}`,
                        url,
                        proxyUrl: source.proxyURL ? String(source.proxyURL) : (source.proxy_url ? String(source.proxy_url) : undefined),
                        width: typeof source.width === "number" ? source.width : undefined,
                        height: typeof source.height === "number" ? source.height : undefined,
                        filename: undefined
                    });
                }
            }
        }
    }

    return items;
}

