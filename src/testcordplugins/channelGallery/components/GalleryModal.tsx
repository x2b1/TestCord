import { Heading } from "@components/Heading";
import { ModalCloseButton, ModalContent, ModalHeader, ModalProps, ModalRoot, ModalSize } from "@utils/modal";
import { ChannelStore, React, useEffect, useMemo, useRef, useState } from "@webpack/common";

import { extractImages, GalleryItem } from "../utils/extractImages";
import { fetchMessagesPage } from "../utils/pagination";
import { GalleryGrid } from "./GalleryGrid";
import { LightboxViewer } from "./LightboxViewer";

type PluginSettings = {
    includeGifs: boolean;
    includeEmbeds: boolean;
    showCaptions: boolean;
    pageSize: number;
    preloadPages: number;
};

type GalleryCache = {
    items: GalleryItem[];
    keys: Set<string>;
    oldestMessageId: string | null;
    hasMore: boolean;
};

const cacheByChannel = new Map<string, GalleryCache>();

function getOrCreateCache(channelId: string): GalleryCache {
    const existing = cacheByChannel.get(channelId);
    if (existing) return existing;
    const created: GalleryCache = {
        items: [],
        keys: new Set(),
        oldestMessageId: null,
        hasMore: true
    };
    cacheByChannel.set(channelId, created);
    return created;
}

export function GalleryModal(props: ModalProps & { channelId: string; settings: PluginSettings; }) {
    const { channelId, settings, ...modalProps } = props;

    const channel = ChannelStore.getChannel(channelId);
    const title = channel?.name ? `Gallery — #${channel.name}` : "Gallery";

    const cache = useMemo(() => getOrCreateCache(channelId), [channelId]);

    const [items, setItems] = useState<GalleryItem[]>(() => cache.items);
    const [hasMore, setHasMore] = useState<boolean>(() => cache.hasMore);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [viewerIndex, setViewerIndex] = useState<number | null>(null);

    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        return () => abortRef.current?.abort();
    }, []);

    async function loadNextPages(pages: number) {
        if (loading) return;
        if (!hasMore) return;

        setLoading(true);
        setError(null);

        const controller = new AbortController();
        abortRef.current?.abort();
        abortRef.current = controller;

        try {
            let before = cache.oldestMessageId;
            let localHasMore = cache.hasMore;

            for (let i = 0; i < pages && localHasMore; i++) {
                const msgs = await fetchMessagesPage({
                    channelId,
                    before,
                    limit: Math.max(1, Math.floor(settings.pageSize)),
                    signal: controller.signal
                });

                if (!msgs.length) {
                    localHasMore = false;
                    break;
                }

                before = msgs[msgs.length - 1]?.id ?? before;
                cache.oldestMessageId = before;

                const extracted = extractImages(msgs, channelId, {
                    includeEmbeds: settings.includeEmbeds,
                    includeGifs: settings.includeGifs
                });

                for (const it of extracted) {
                    if (cache.keys.has(it.key)) continue;
                    cache.keys.add(it.key);
                    cache.items.push(it);
                }
            }

            cache.hasMore = localHasMore;

            setItems([...cache.items]);
            setHasMore(cache.hasMore);
        } catch (e: any) {
            if (e?.name === "AbortError") return;
            setError("Unable to load gallery items");
        } finally {
            setLoading(false);
        }
    }

    // Initial load/preload (lazy, only after modal opens).
    useEffect(() => {
        if (cache.items.length) return;
        void loadNextPages(Math.max(1, Math.floor(settings.preloadPages)));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelId]);

    const onCloseAll = () => {
        abortRef.current?.abort();
        modalProps.onClose();
    };

    const viewerItem = viewerIndex != null ? items[viewerIndex] : null;

    return (
        <ModalRoot {...modalProps} size={ModalSize.LARGE} aria-label="Gallery">
            <ModalHeader>
                <Heading tag="h3" style={{ flex: 1, margin: 0 }}>
                    {title}
                </Heading>
                <ModalCloseButton onClick={onCloseAll} />
            </ModalHeader>
            <ModalContent
                className="vc-channel-gallery-modal"
                style={{ padding: 0, overflow: "hidden" }}
            >
                {viewerItem ? (
                    <LightboxViewer
                        items={items}
                        index={viewerIndex!}
                        onClose={() => setViewerIndex(null)}
                        onChangeIndex={setViewerIndex}
                        onOpenMessage={onCloseAll}
                        channelId={channelId}
                    />
                ) : (
                    <GalleryGrid
                        items={items}
                        showCaptions={settings.showCaptions}
                        isLoading={loading}
                        hasMore={hasMore}
                        error={error}
                        onRetry={() => loadNextPages(1)}
                        onLoadMore={() => loadNextPages(1)}
                        onSelect={setViewerIndex}
                    />
                )}
            </ModalContent>
        </ModalRoot>
    );
}
