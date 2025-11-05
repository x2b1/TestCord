/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@api/Styles";
import { DataStore } from "@api/index";
import { ModalProps, ModalRoot, ModalHeader, ModalContent, ModalSize, ModalCloseButton } from "@utils/modal";
import { findStoreLazy } from "@webpack";
import { Avatar, ChannelStore, MessageStore, NavigationRouter, RestAPI, TabBar, TextInput, UserStore } from "@webpack/common";
import { Message, Channel, User } from "@vencord/discord-types";
import { React, useEffect, useMemo, useRef, useState, useCallback } from "@webpack/common";

import { settings } from "./index";
import { MediaGrid, searchMediaMessages, MediaItemsCache } from "./MediaGrid";

const PrivateChannelSortStore = findStoreLazy("PrivateChannelSortStore") as { getPrivateChannelIds: () => string[]; };

const cl = classNameFactory("vc-ultra-search-");

enum SearchFilter {
    RECENT = "recent",
    MESSAGES = "messages",
    MEDIA = "media",
    PINNED = "pinned"
}

interface SearchResultsCache {
    query: string;
    filter: SearchFilter;
    channelIds: string[];
    results: SearchResult[];
    lastUpdated: number;
}

interface SearchResult {
    message: Message;
    channel: Channel;
    user?: User;
    matchType: "content" | "author" | "attachment";
    highlight?: string;
    mediaInfo?: {
        url: string;
        thumbnailUrl?: string;
        type: "image" | "video" | "embed" | "sticker";
    };
}

export function SearchModal({ modalProps }: { modalProps: ModalProps; }) {
    const [query, setQuery] = useState("");
    const [activeFilter, setActiveFilter] = useState<SearchFilter>(SearchFilter.RECENT);
    const [allResults, setAllResults] = useState<SearchResult[]>([]); // Tous les résultats
    const [displayedResults, setDisplayedResults] = useState<SearchResult[]>([]); // Résultats affichés
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [stats, setStats] = useState({ total: 0, displayed: 0, loading: false });
    const [loadingMore, setLoadingMore] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);
    const mediaGridContainerRef = useRef<HTMLDivElement>(null);
    const initialLoadLimit = 50; // Nombre de résultats à charger initialement
    const loadMoreBatchSize = 50; // Nombre de résultats supplémentaires à charger à chaque scroll

    // Focus sur le champ de recherche au montage
    useEffect(() => {
        searchInputRef.current?.focus();
    }, []);

    // Recherche avec debounce
    useEffect(() => {
        // Pour le filtre MEDIA, charger tous les médias même sans requête
        if (activeFilter === SearchFilter.MEDIA && !query.trim()) {
            performSearch("", activeFilter);
            return;
        }

        if (!query.trim()) {
            setAllResults([]);
            setDisplayedResults([]);
            return;
        }

        const timeoutId = setTimeout(() => {
            performSearch(query.trim(), activeFilter);
        }, settings.store.searchTimeout || 300);

        return () => clearTimeout(timeoutId);
    }, [query, activeFilter]);

    // Fonction helper pour rechercher un mot complet (sensible à la casse)
    const matchesWholeWord = useCallback((text: string, searchTerm: string): boolean => {
        if (!text || !searchTerm) return false;
        // Échapper les caractères spéciaux regex
        const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // Créer une regex avec word boundaries (\b) pour chercher des mots complets
        // Sensible à la casse
        const regex = new RegExp(`\\b${escapedSearch}\\b`);
        return regex.test(text);
    }, []);

    // Navigation au clavier optimisée avec useCallback
    const navigateToMessage = useCallback((result: SearchResult) => {
        const { message, channel } = result;
        const messageId = message.id || (message as any).message_id;
        const channelId = message.channel_id || channel.id;
        const guildId = channel.guild_id || "@me";
        const url = `/channels/${guildId}/${channelId}/${messageId}`;
        NavigationRouter.transitionTo(url);
        modalProps.onClose();
    }, [modalProps]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex(prev =>
                    prev < displayedResults.length - 1 ? prev + 1 : prev
                );
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
            } else if (e.key === "Enter" && selectedIndex >= 0 && displayedResults[selectedIndex]) {
                e.preventDefault();
                navigateToMessage(displayedResults[selectedIndex]);
            } else if (e.key === "Escape") {
                e.preventDefault();
                modalProps.onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [displayedResults, selectedIndex, navigateToMessage, modalProps]);

    // Scroll vers l'élément sélectionné (seulement si l'utilisateur navigue au clavier) - DÉSACTIVÉ pour MEDIA
    useEffect(() => {
        // Ne jamais scroller automatiquement pour le filtre MEDIA
        if (activeFilter === SearchFilter.MEDIA) return;

        if (selectedIndex >= 0 && resultsRef.current) {
            const element = resultsRef.current.children[selectedIndex] as HTMLElement;
            if (element) {
                element.scrollIntoView({ block: "nearest", behavior: "smooth" });
            }
        }
    }, [selectedIndex, activeFilter]);

    // Scroll infini pour charger plus de messages (tous les filtres sauf MEDIA)
    useEffect(() => {
        if (activeFilter === SearchFilter.MEDIA) return; // Le scroll infini pour médias est géré séparément
        if (displayedResults.length >= allResults.length) return; // Déjà tout chargé

        const container = resultsRef.current;
        if (!container) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

            // Charger plus quand on est à 200px du bas
            if (distanceFromBottom < 200 && !loadingMore && displayedResults.length < allResults.length) {
                setLoadingMore(true);

                // Charger le prochain batch
                const nextBatch = allResults.slice(
                    displayedResults.length,
                    displayedResults.length + loadMoreBatchSize
                );

                setDisplayedResults(prev => [...prev, ...nextBatch]);
                setStats(prev => ({
                    ...prev,
                    displayed: Math.min(prev.displayed + nextBatch.length, allResults.length)
                }));

                // Petit délai pour éviter les chargements trop rapides
                setTimeout(() => setLoadingMore(false), 100);
            }
        };

        container.addEventListener("scroll", handleScroll);
        return () => container.removeEventListener("scroll", handleScroll);
    }, [activeFilter, displayedResults, allResults, loadingMore, loadMoreBatchSize]);

    // Scroll infini pour charger plus de médias
    useEffect(() => {
        if (activeFilter !== SearchFilter.MEDIA) return;
        if (displayedResults.length >= allResults.length) return; // Déjà tout chargé

        const container = mediaGridContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

            // Charger plus quand on est à 200px du bas
            if (distanceFromBottom < 200 && !loadingMore && displayedResults.length < allResults.length) {
                setLoadingMore(true);

                // Charger le prochain batch
                const nextBatch = allResults.slice(
                    displayedResults.length,
                    displayedResults.length + loadMoreBatchSize
                );

                setDisplayedResults(prev => [...prev, ...nextBatch]);
                setStats(prev => ({
                    ...prev,
                    displayed: Math.min(prev.displayed + nextBatch.length, allResults.length)
                }));

                // Petit délai pour éviter les chargements trop rapides
                setTimeout(() => setLoadingMore(false), 100);
            }
        };

        container.addEventListener("scroll", handleScroll);
        return () => container.removeEventListener("scroll", handleScroll);
    }, [activeFilter, displayedResults, allResults, loadingMore, loadMoreBatchSize]);

    async function performSearch(searchQuery: string, filter: SearchFilter) {
        // Pour le filtre MEDIA, permettre une recherche vide pour charger tous les médias
        if (filter !== SearchFilter.MEDIA && !searchQuery.trim()) {
            setAllResults([]);
            setDisplayedResults([]);
            return;
        }

        setLoading(true);
        setStats({ total: 0, displayed: 0, loading: true });
        console.log(`[Ultra Advanced Search] Recherche: "${searchQuery}", Filtre: ${filter}`);

        try {
            const searchResults: SearchResult[] = [];

            // Obtenir tous les canaux accessibles
            const channelIds: string[] = [];

            // Ajouter les canaux privés (DMs et groupes)
            try {
                const privateChannelIds = PrivateChannelSortStore.getPrivateChannelIds();
                channelIds.push(...privateChannelIds);
                console.log(`[Ultra Advanced Search] ${channelIds.length} canaux privés trouvés`);
            } catch (error) {
                console.error("Erreur lors de la récupération des canaux privés:", error);
            }

            // Seulement les canaux privés (DMs et groupes), pas les serveurs
            const limitedChannelIds = channelIds;

            // Vérifier le cache pour les résultats de recherche (sauf pour MEDIA qui a son propre cache)
            if (filter !== SearchFilter.MEDIA && searchQuery.trim()) {
                const cacheKey = `ultra-search-results-${filter}-${searchQuery.toLowerCase()}`;
                try {
                    const cached = await DataStore.get(cacheKey) as SearchResultsCache | null | undefined;
                    if (cached && cached.results && cached.results.length > 0) {
                        // Vérifier que les canaux sont toujours les mêmes
                        const cachedChannelIds = new Set(cached.channelIds);
                        const currentChannelIds = new Set(limitedChannelIds);
                        const channelsMatch = cachedChannelIds.size === currentChannelIds.size &&
                            Array.from(cachedChannelIds).every(id => currentChannelIds.has(id));

                        if (channelsMatch) {
                            const cachedFinalResults = cached.results.slice(0, settings.store.maxResults || 100);
                            console.log(`[Ultra Advanced Search] Utilisation du cache pour la recherche: "${searchQuery}" (${cachedFinalResults.length} résultats)`);
                            setAllResults(cachedFinalResults);
                            setDisplayedResults(cachedFinalResults);
                            setStats({ total: cachedFinalResults.length, displayed: cachedFinalResults.length, loading: false });
                            setLoading(false);
                            return;
                        }
                    }
                } catch (error) {
                    console.error("[Ultra Advanced Search] Erreur lors du chargement du cache de recherche:", error);
                }
            }

            // Pour le filtre MEDIA, traiter les canaux de manière séquentielle pour éviter les rate limits
            if (filter === SearchFilter.MEDIA) {
                // D'abord, charger les items multimédias depuis le cache dédié pour affichage immédiat
                const cachedMediaItems: Array<{
                    url: string;
                    thumbnailUrl?: string;
                    type: "image" | "video" | "embed" | "sticker";
                    message: Message | any;
                    channel: Channel;
                    user: User | null;
                }> = [];

                for (const channelId of limitedChannelIds) {
                    try {
                        const channel = ChannelStore.getChannel(channelId);
                        if (!channel) continue;

                        const mediaItemsCacheKey = `ultra-search-media-items-${channelId}`;
                        const cachedMedia = await DataStore.get(mediaItemsCacheKey) as MediaItemsCache | null | undefined;

                        if (cachedMedia && cachedMedia.items && cachedMedia.items.length > 0) {
                            console.log(`[Ultra Advanced Search] Cache items multimédias trouvé pour ${channelId}: ${cachedMedia.items.length} items`);

                            for (const item of cachedMedia.items) {
                                // Filtrer par query si nécessaire
                                if (!searchQuery.trim() || searchQuery.trim() === "") {
                                    const message = MessageStore.getMessage(item.channelId, item.messageId) || {
                                        id: item.messageId,
                                        channel_id: item.channelId,
                                        author: item.userId ? { id: item.userId } : null,
                                        timestamp: new Date(item.timestamp)
                                    };
                                    const user = item.userId ? UserStore.getUser(item.userId) : null;
                                    cachedMediaItems.push({
                                        url: item.url,
                                        thumbnailUrl: item.thumbnailUrl,
                                        type: item.type,
                                        message: message as any,
                                        channel,
                                        user
                                    });
                                }
                            }
                        }
                    } catch (error) {
                        console.error(`[Ultra Advanced Search] Erreur lors du chargement du cache items multimédias pour ${channelId}:`, error);
                    }
                }

                // Trier par timestamp (plus récent en premier)
                cachedMediaItems.sort((a, b) => {
                    const timeA = a.message.timestamp?.valueOf() || (a.message as any).timestamp || 0;
                    const timeB = b.message.timestamp?.valueOf() || (b.message as any).timestamp || 0;
                    return timeB - timeA;
                });

                // Fonction helper pour convertir cachedMediaItems en SearchResult (éviter la duplication)
                const convertCachedItemsToResults = (items: typeof cachedMediaItems): SearchResult[] => {
                    return items.map(item => ({
                        message: item.message,
                        channel: item.channel,
                        user: item.user || undefined,
                        matchType: "attachment" as const,
                        mediaInfo: {
                            url: item.url,
                            thumbnailUrl: item.thumbnailUrl,
                            type: item.type
                        }
                    }));
                };

                // Afficher immédiatement les médias du cache
                if (cachedMediaItems.length > 0) {
                    console.log(`[Ultra Advanced Search] ${cachedMediaItems.length} médias chargés depuis le cache items`);
                    const cachedResults = convertCachedItemsToResults(cachedMediaItems);
                    setAllResults(cachedResults);
                    setDisplayedResults(cachedResults.slice(0, initialLoadLimit));
                    setStats({ total: cachedResults.length, displayed: Math.min(initialLoadLimit, cachedResults.length), loading: false });
                    setLoading(false);
                }

                // Ensuite, charger les résultats depuis le cache des messages pour compléter
                for (const channelId of limitedChannelIds) {
                    try {
                        const channel = ChannelStore.getChannel(channelId);
                        if (!channel) continue;

                        const cachedResults = await searchMediaMessages(channelId, searchQuery, true, settings.store.apiRequestDelay || 200); // true = cache seulement
                        searchResults.push(...cachedResults);
                    } catch (error) {
                        console.error(`[Ultra Advanced Search] Erreur lors de la recherche dans le cache pour ${channelId}:`, error);
                    }
                }

                // Mettre à jour les résultats avec les nouveaux (éviter les doublons)
                if (searchResults.length > 0) {
                    searchResults.sort((a, b) => {
                        const timeA = a.message.timestamp?.valueOf() || (a.message as any).timestamp || 0;
                        const timeB = b.message.timestamp?.valueOf() || (b.message as any).timestamp || 0;
                        return timeB - timeA;
                    });

                    // Fusionner avec les résultats du cache items (éviter les doublons)
                    const existingIds = new Set(cachedMediaItems.map(item => item.message.id || item.message.message_id));
                    const newResults = searchResults.filter(r => {
                        const msgId = r.message.id || (r.message as any).message_id;
                        return !existingIds.has(msgId);
                    });

                    if (cachedMediaItems.length > 0) {
                        const cachedResults = convertCachedItemsToResults(cachedMediaItems);
                        const merged = [...cachedResults, ...newResults];
                        setAllResults(merged);
                        setDisplayedResults(merged.slice(0, initialLoadLimit));
                        setStats({ total: merged.length, displayed: Math.min(initialLoadLimit, merged.length), loading: false });
                    } else {
                        setAllResults(searchResults);
                        setDisplayedResults(searchResults.slice(0, initialLoadLimit));
                        setStats({ total: searchResults.length, displayed: Math.min(initialLoadLimit, searchResults.length), loading: false });
                    }
                }

                // Charger les nouveaux médias en arrière-plan (par batch de 2 canaux)
                const batchSize = 2;
                const delayBetweenBatches = 500; // 500ms entre chaque batch

                for (let i = 0; i < limitedChannelIds.length; i += batchSize) {
                    const batch = limitedChannelIds.slice(i, i + batchSize);

                    // Petit délai entre les batches
                    if (i > 0) {
                        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
                    }

                    const batchPromises = batch.map(async (channelId) => {
                        try {
                            const channel = ChannelStore.getChannel(channelId);
                            if (!channel) return [];
                            return await searchMediaMessages(channelId, searchQuery, false, settings.store.apiRequestDelay || 200); // false = charger depuis API aussi
                        } catch (error) {
                            console.error(`Erreur lors de la recherche dans le canal ${channelId}:`, error);
                            return [];
                        }
                    });

                    const batchResults = await Promise.all(batchPromises);
                    const newResults: SearchResult[] = [];
                    for (const results of batchResults) {
                        newResults.push(...results);
                    }

                    // Ajouter les nouveaux résultats (éviter les doublons)
                    const existingIds = new Set(searchResults.map(r => r.message.id || (r.message as any).message_id));
                    for (const result of newResults) {
                        const msgId = result.message.id || (result.message as any).message_id;
                        if (!existingIds.has(msgId)) {
                            searchResults.push(result);
                            existingIds.add(msgId);
                        }
                    }

                    // Mettre à jour l'affichage progressivement (ajouter les nouveaux résultats)
                    searchResults.sort((a, b) => {
                        const timeA = a.message.timestamp?.valueOf() || (a.message as any).timestamp || 0;
                        const timeB = b.message.timestamp?.valueOf() || (b.message as any).timestamp || 0;
                        return timeB - timeA;
                    });

                    // Mettre à jour tous les résultats
                    setAllResults(prev => {
                        const existingIds = new Set(prev.map(r => r.message.id || (r.message as any).message_id));
                        const newResults = searchResults.filter(r => {
                            const msgId = r.message.id || (r.message as any).message_id;
                            return !existingIds.has(msgId);
                        });
                        return [...prev, ...newResults];
                    });

                    // Ajouter les nouveaux résultats aux résultats affichés seulement si on n'a pas encore atteint la limite initiale
                    setDisplayedResults(prev => {
                        if (prev.length >= initialLoadLimit) return prev;

                        const existingIds = new Set(prev.map(r => r.message.id || (r.message as any).message_id));
                        const newResultsToDisplay = searchResults
                            .filter(r => {
                                const msgId = r.message.id || (r.message as any).message_id;
                                return !existingIds.has(msgId);
                            })
                            .slice(0, initialLoadLimit - prev.length);

                        return [...prev, ...newResultsToDisplay];
                    });
                }
            } else {
                // Pour les autres filtres, traitement normal
                const searchPromises = limitedChannelIds.map(async (channelId, index) => {
                    // Petit délai pour éviter de bloquer l'UI (par batch de 5 canaux)
                    if (index > 0 && index % 5 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 10));
                    }

                    try {
                        const channel = ChannelStore.getChannel(channelId);
                        if (!channel) return [];

                        // Recherche selon le filtre
                        if (filter === SearchFilter.PINNED) {
                            return searchPinnedMessages(channelId, searchQuery);
                        } else if (filter === SearchFilter.MESSAGES) {
                            return searchGeneral(channelId, searchQuery);
                        } else {
                            return searchGeneral(channelId, searchQuery);
                        }
                    } catch (error) {
                        console.error(`Erreur lors de la recherche dans le canal ${channelId}:`, error);
                        return [];
                    }
                });

                // Attendre toutes les recherches en parallèle
                const allResults = await Promise.all(searchPromises);

                // Flatten et ajouter tous les résultats
                for (const channelResults of allResults) {
                    searchResults.push(...channelResults);
                }

                console.log(`[Ultra Advanced Search] ${searchResults.length} résultats trouvés`);
            }

            // Trier par date (plus récent en premier)
            searchResults.sort((a, b) => {
                const timeA = a.message.timestamp?.valueOf() || (a.message as any).timestamp || 0;
                const timeB = b.message.timestamp?.valueOf() || (b.message as any).timestamp || 0;
                return timeB - timeA;
            });

            // Si on n'a pas assez de résultats, chercher avec l'API
            const minResults = settings.store.minResultsForAPI ?? 5;
            if (searchResults.length < minResults && limitedChannelIds.length > 0 && filter !== SearchFilter.MEDIA) {
                console.log(`[Ultra Advanced Search] Cache local: ${searchResults.length} résultats, recherche API...`);
                const apiResults = await searchWithAPI(searchQuery, filter, limitedChannelIds, searchResults.length);

                // Ajouter les résultats de l'API (en évitant les doublons)
                const existingIds = new Set(searchResults.map(r => r.message.id || (r.message as any).message_id));
                for (const result of apiResults) {
                    const msgId = result.message.id || (result.message as any).message_id;
                    if (!existingIds.has(msgId)) {
                        searchResults.push(result);
                    }
                }

                // Re-trier après avoir ajouté les résultats de l'API
                searchResults.sort((a, b) => {
                    const timeA = a.message.timestamp?.valueOf() || (a.message as any).timestamp || 0;
                    const timeB = b.message.timestamp?.valueOf() || (b.message as any).timestamp || 0;
                    return timeB - timeA;
                });
            }

            // Pour le filtre MEDIA, utiliser la pagination (50 initialement)
            if (filter === SearchFilter.MEDIA) {
                setAllResults(searchResults);
                setDisplayedResults(searchResults.slice(0, initialLoadLimit));
                setStats({ total: searchResults.length, displayed: Math.min(initialLoadLimit, searchResults.length), loading: false });
                console.log(`[Ultra Advanced Search] ${searchResults.length} résultats au total, ${Math.min(initialLoadLimit, searchResults.length)} affichés initialement`);
            } else {
                // Pour les autres filtres, afficher tous les résultats (limités par maxResults)
                const finalResults = searchResults.slice(0, settings.store.maxResults || 100);
                setAllResults(finalResults);
                setDisplayedResults(finalResults);
                setStats({ total: finalResults.length, displayed: finalResults.length, loading: false });
                console.log(`[Ultra Advanced Search] ${finalResults.length} résultats affichés`);

                // Mettre en cache les résultats de recherche (cache infini)
                if (searchQuery.trim() && finalResults.length > 0) {
                    const cacheKey = `ultra-search-results-${filter}-${searchQuery.toLowerCase()}`;
                    try {
                        await DataStore.set(cacheKey, {
                            query: searchQuery,
                            filter,
                            channelIds: limitedChannelIds,
                            results: finalResults,
                            lastUpdated: Date.now()
                        } as SearchResultsCache);
                        console.log(`[Ultra Advanced Search] Cache de recherche sauvegardé pour "${searchQuery}" (${finalResults.length} résultats)`);
                    } catch (error) {
                        console.error("[Ultra Advanced Search] Erreur lors de la sauvegarde du cache de recherche:", error);
                    }
                }
            }
        } catch (error) {
            console.error("Erreur lors de la recherche:", error);
            setStats({ total: 0, displayed: 0, loading: false });
        } finally {
            setLoading(false);
            setStats(prev => ({ ...prev, loading: false }));
        }
    }

    // Fonction pour chercher avec l'API Discord si le cache local ne donne pas assez de résultats
    async function searchWithAPI(
        searchQuery: string,
        filter: SearchFilter,
        channelIds: string[],
        currentResultCount: number
    ): Promise<SearchResult[]> {
        const apiResults: SearchResult[] = [];
        const maxApiChannels = Math.min(10, channelIds.length); // Limiter à 10 canaux pour éviter le rate limit
        const delayBetweenRequests = settings.store.apiRequestDelay || 200; // Délai configurable entre les requêtes

        for (let i = 0; i < maxApiChannels; i++) {
            const channelId = channelIds[i];
            try {
                const channel = ChannelStore.getChannel(channelId);
                if (!channel) continue;

                // Délai entre les requêtes pour éviter le rate limit
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
                }

                // Charger des messages depuis l'API (limite de 100 messages par requête)
                let response: any = null;
                try {
                    response = await RestAPI.get({
                        url: `/channels/${channelId}/messages`,
                        query: {
                            limit: 100
                        },
                        retries: 1
                    });
                } catch (error: any) {
                    // Gérer le rate limit (429)
                    if (error?.status === 429) {
                        const retryAfter = parseFloat(error.response?.headers?.["retry-after"] || error.response?.headers?.["Retry-After"] || "1");
                        console.log(`[Ultra Advanced Search] Rate limit atteint, attente de ${retryAfter}s...`);
                        // Attendre le délai spécifié avant de continuer
                        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                        // Réessayer une fois après l'attente
                        try {
                            response = await RestAPI.get({
                                url: `/channels/${channelId}/messages`,
                                query: {
                                    limit: 100
                                },
                                retries: 0
                            });
                        } catch (retryError) {
                            // Si encore rate limit, passer au canal suivant
                            continue;
                        }
                    } else {
                        // Autre erreur, continuer
                        continue;
                    }
                }

                if (!response?.body || !Array.isArray(response.body)) {
                    continue;
                }

                // Rechercher dans les messages chargés (recherche sensible à la casse)
                for (const msg of response.body) {
                    // Convertir le message brut en objet Message si nécessaire
                    const message: any = msg;

                    // Vérifier selon le filtre
                    let matches = false;

                    if (filter === SearchFilter.PINNED) {
                        matches = message.pinned &&
                            (!searchQuery || (message.content && matchesWholeWord(message.content, searchQuery)));
                    } else if (filter === SearchFilter.MEDIA) {
                        const hasMedia = message.attachments?.length > 0 ||
                            message.embeds?.length > 0 ||
                            message.sticker_items?.length > 0;
                        matches = hasMedia &&
                            (!searchQuery || (message.content && matchesWholeWord(message.content, searchQuery)));
                    } else {
                        // Recherche générale (recherche de mots complets, sensible à la casse)
                        matches = message.content && matchesWholeWord(message.content, searchQuery);
                    }

                    if (matches) {
                        apiResults.push({
                            message: message as Message,
                            channel,
                            user: UserStore.getUser(message.author?.id),
                            matchType: filter === SearchFilter.MEDIA ? "attachment" : "content",
                            highlight: searchQuery
                        });
                    }
                }

                // Si on a assez de résultats, arrêter
                if (apiResults.length >= settings.store.maxResults) {
                    break;
                }
            } catch (error: any) {
                // Ignorer les erreurs silencieusement (déjà gérées dans le try-catch interne)
                if (error?.status !== 429) {
                    console.error(`[Ultra Advanced Search] Erreur API pour canal ${channelId}:`, error);
                }
                continue;
            }
        }

        return apiResults;
    }

    function searchGeneral(channelId: string, query: string): SearchResult[] {
        const results: SearchResult[] = [];
        const channel = ChannelStore.getChannel(channelId);
        if (!channel) return results;

        // Utiliser uniquement le cache local des messages
        const messages = MessageStore.getMessages(channelId);
        if (messages && messages.size > 0) {
            // Convertir le Map en tableau
            let messageArray: Message[] = [];
            try {
                if (messages instanceof Map) {
                    messageArray = Array.from(messages.values());
                } else if (typeof messages.forEach === "function") {
                    messages.forEach((msg: Message) => messageArray.push(msg));
                }
            } catch (error) {
                console.error("Erreur lors de la conversion des messages:", error);
                return results;
            }

            // Recherche de mots complets (sensible à la casse)
            // IMPORTANT: Exclure les messages avec uniquement des médias (pas de contenu texte)
            for (const message of messageArray) {
                // Vérifier que le message a du contenu texte (pas seulement des médias)
                const hasTextContent = message.content && message.content.trim().length > 0;

                // Si le message a du contenu texte et correspond à la recherche (mot complet)
                if (hasTextContent && message.content && matchesWholeWord(message.content, query)) {
                    results.push({
                        message,
                        channel,
                        matchType: "content",
                        highlight: query
                    });
                }
            }
        }

        return results;
    }


    function searchPinnedMessages(channelId: string, query: string): SearchResult[] {
        const results: SearchResult[] = [];
        const channel = ChannelStore.getChannel(channelId);
        if (!channel) return results;

        // Utiliser uniquement le cache local - rechercher les messages avec pinned = true
        const messages = MessageStore.getMessages(channelId);
        if (messages && messages.size > 0) {
            // Convertir le Map en tableau
            let messageArray: Message[] = [];
            try {
                if (messages instanceof Map) {
                    messageArray = Array.from(messages.values());
                } else if (typeof messages.forEach === "function") {
                    messages.forEach((msg: Message) => messageArray.push(msg));
                }
            } catch (error) {
                return results;
            }

            // Recherche de mots complets (sensible à la casse)
            for (const message of messageArray) {
                // Vérifier si le message est épinglé (propriété pinned)
                if (message.pinned && (!query || (message.content && matchesWholeWord(message.content, query)))) {
                    results.push({
                        message,
                        channel,
                        matchType: "content"
                    });
                }
            }
        }

        return results;
    }


    // Optimiser highlightText avec useMemo
    const highlightText = useCallback((text: string, highlight: string): React.ReactNode => {
        if (!highlight || !text) return text;
        // Échapper les caractères spéciaux dans la regex
        const escapedHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const parts = text.split(new RegExp(`(${escapedHighlight})`, "gi"));
        return parts.map((part, i) =>
            part.toLowerCase() === highlight.toLowerCase() ? (
                <mark key={i} style={{ backgroundColor: "var(--brand-experiment-500)", color: "white", padding: "0 2px", borderRadius: "2px" }}>
                    {part}
                </mark>
            ) : part
        );
    }, []);

    const formatMessagePreview = useCallback((message: Message): string => {
        if (message.content) {
            return message.content.length > 150
                ? message.content.substring(0, 150) + "..."
                : message.content;
        }
        if (message.attachments?.length > 0) {
            return `📎 ${message.attachments.length} pièce(s) jointe(s)`;
        }
        if (message.embeds?.length > 0) {
            return `📄 ${message.embeds.length} intégration(s)`;
        }
        return "Message sans contenu";
    }, []);

    const formatTimestamp = useCallback((timestamp: any): string => {
        if (!timestamp) return "";
        try {
            let date: Date;

            // Handle different timestamp formats
            if (timestamp instanceof Date) {
                date = timestamp;
            } else if (typeof timestamp === "number") {
                date = new Date(timestamp);
            } else if (timestamp && typeof timestamp === "object") {
                // Handle moment.js or similar objects
                if (timestamp.valueOf) {
                    date = new Date(timestamp.valueOf());
                } else if (timestamp.toDate) {
                    date = timestamp.toDate();
                } else if (timestamp.toISOString) {
                    date = new Date(timestamp.toISOString());
                } else {
                    return "";
                }
            } else if (typeof timestamp === "string") {
                date = new Date(timestamp);
            } else {
                return "";
            }

            if (isNaN(date.getTime())) return "";

            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (diffDays === 0) {
                return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
            } else if (diffDays === 1) {
                return "Hier";
            } else if (diffDays < 7) {
                return date.toLocaleDateString("fr-FR", { weekday: "short" });
            } else if (diffDays < 365) {
                return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
            } else {
                return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
            }
        } catch {
            return "";
        }
    }, []);

    const getAvatarURL = useCallback((user: User | null, channel: Channel): string | null => {
        if (!user) return null;
        try {
            return user.getAvatarURL?.(channel.guild_id, 128) ||
                (user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=128` : null);
        } catch {
            return user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=128` : null;
        }
    }, []);

    // Composant pour afficher la liste des messages
    function MessagesList({ results, onNavigate, onSelect, selectedIndex, searchQuery }: {
        results: SearchResult[];
        onNavigate: (result: SearchResult) => void;
        onSelect: (index: number) => void;
        selectedIndex: number;
        searchQuery: string;
    }) {
        if (results.length === 0) {
            return (
                <div className={cl("no-results")}>
                    <span>Aucun message trouvé</span>
                </div>
            );
        }

        return (
            <div ref={resultsRef} className={cl("results")}>
                {results.map((result, index) => {
                    const isSelected = index === selectedIndex;
                    const user = result.user || UserStore.getUser(result.message.author.id);
                    const channel = result.channel;

                    return (
                        <div
                            key={`${result.message.channel_id}-${result.message.id}-${index}`}
                            className={cl("result-item", { selected: isSelected })}
                            onClick={() => onNavigate(result)}
                            onMouseEnter={() => onSelect(index)}
                        >
                            <div className={cl("result-content-wrapper")}>
                                <div className={cl("result-avatar")}>
                                    <Avatar
                                        src={getAvatarURL(user, channel) || undefined}
                                        size="SIZE_40"
                                        className={cl("avatar")}
                                    />
                                </div>
                                <div className={cl("result-main")}>
                                    <div className={cl("result-header")}>
                                        <div className={cl("result-author")}>
                                            <span className={cl("result-author-name")}>
                                                {user?.globalName || user?.username || "Utilisateur inconnu"}
                                            </span>
                                            <span className={cl("result-channel")}>
                                                {channel.name || "DM"}
                                            </span>
                                            {result.message.pinned && (
                                                <span className={cl("result-pinned")} title="Message épinglé">
                                                    📌
                                                </span>
                                            )}
                                        </div>
                                        <span className={cl("result-time")}>
                                            {formatTimestamp(result.message.timestamp)}
                                        </span>
                                    </div>
                                    <div className={cl("result-content")}>
                                        {highlightText(formatMessagePreview(result.message), searchQuery)}
                                    </div>
                                    {(result.message.attachments?.length > 0 || result.message.embeds?.length > 0) && (
                                        <div className={cl("result-metadata")}>
                                            {result.message.attachments?.length > 0 && (
                                                <div className={cl("result-attachments")}>
                                                    <span className={cl("result-icon")}>📎</span>
                                                    <span>{result.message.attachments.length} pièce(s) jointe(s)</span>
                                                </div>
                                            )}
                                            {result.message.embeds?.length > 0 && (
                                                <div className={cl("result-embeds")}>
                                                    <span className={cl("result-icon")}>📄</span>
                                                    <span>{result.message.embeds.length} intégration(s)</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    // Composant wrapper pour la grille de médias
    function MediaGridWrapper({ results, allResults, onNavigate, onSelect, selectedIndex, loadingMore, remainingCount }: {
        results: SearchResult[];
        allResults: SearchResult[];
        onNavigate: (result: SearchResult) => void;
        onSelect: (index: number) => void;
        selectedIndex: number;
        loadingMore: boolean;
        remainingCount: number;
    }) {
        return (
            <div ref={mediaGridContainerRef} className={cl("results", "media-grid-container")}>
                {results.length === 0 && !loading ? (
                    <div className={cl("empty")}>
                        <span>Chargement des médias...</span>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", width: "100%", minWidth: 0, maxWidth: "100%" }}>
                        <MediaGrid
                            displayedResults={results}
                            allResults={allResults}
                            navigateToMessage={onNavigate}
                            setSelectedIndex={onSelect}
                            selectedIndex={selectedIndex}
                        />
                        {loadingMore && (
                            <div className={cl("loading-more")}>
                                <span>Chargement...</span>
                            </div>
                        )}
                        {results.length < allResults.length && !loadingMore && (
                            <div className={cl("loading-more")}>
                                <span>Faites défiler pour charger plus ({remainingCount} restants)</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }


    return (
        <ModalRoot {...modalProps} size={ModalSize.LARGE} className={cl("root")}>
            <ModalHeader className={cl("header")}>
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <TextInput
                            ref={searchInputRef}
                            value={query}
                            onChange={setQuery}
                            placeholder="Rechercher..."
                            style={{ flex: 1 }}
                            autoFocus
                        />
                        <ModalCloseButton onClick={modalProps.onClose} />
                    </div>

                    <TabBar
                        type="top"
                        look="brand"
                        selectedItem={activeFilter}
                        onItemSelect={setActiveFilter as any}
                    >
                        <TabBar.Item id={SearchFilter.RECENT}>
                            Récent
                        </TabBar.Item>
                        <TabBar.Item id={SearchFilter.MESSAGES}>
                            Messages
                        </TabBar.Item>
                        <TabBar.Item id={SearchFilter.MEDIA}>
                            Contenu multimédia
                        </TabBar.Item>
                        <TabBar.Item id={SearchFilter.PINNED}>
                            Messages épinglés
                        </TabBar.Item>
                    </TabBar>
                    {stats.total > 0 && (
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                            {stats.displayed} / {stats.total} résultats
                        </div>
                    )}
                </div>
            </ModalHeader>

            <ModalContent className={cl("content")}>
                {loading ? (
                    <div className={cl("loading")}>
                        <div className={cl("spinner")} />
                        <span>Recherche en cours...</span>
                    </div>
                ) : activeFilter === SearchFilter.MEDIA ? (
                    <MediaGridWrapper
                        results={displayedResults}
                        allResults={allResults}
                        onNavigate={navigateToMessage}
                        onSelect={setSelectedIndex}
                        selectedIndex={selectedIndex}
                        loadingMore={loadingMore}
                        remainingCount={allResults.length - displayedResults.length}
                    />
                ) : displayedResults.length === 0 && query ? (
                    <div className={cl("no-results")}>
                        <span>Aucun résultat trouvé pour "{query}"</span>
                    </div>
                ) : displayedResults.length === 0 ? (
                    <div className={cl("empty")}>
                        <span>Tapez pour rechercher dans tous vos messages</span>
                    </div>
                ) : (
                    <>
                        <MessagesList
                            results={displayedResults}
                            onNavigate={navigateToMessage}
                            onSelect={setSelectedIndex}
                            selectedIndex={selectedIndex}
                            searchQuery={query}
                        />
                        {loadingMore && (
                            <div className={cl("loading-more")} style={{ padding: "12px", textAlign: "center" }}>
                                <span>Chargement...</span>
                            </div>
                        )}
                        {displayedResults.length < allResults.length && !loadingMore && (
                            <div className={cl("loading-more")} style={{ padding: "12px", textAlign: "center" }}>
                                <span>Faites défiler pour charger plus ({allResults.length - displayedResults.length} restants)</span>
                            </div>
                        )}
                    </>
                )}
            </ModalContent>
        </ModalRoot>
    );
}



