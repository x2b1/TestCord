/*
 * Equicord, a Discord client mod
 * Copyright (c) 2024 Nightcord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { RelationshipStore, Toasts } from "@webpack/common";

const RelationshipActions = findByPropsLazy("removeFriend", "sendFriendRequest");

// RelationshipType 4 = OUTGOING_REQUEST
const OUTGOING_REQUEST = 4;

function cancelRequest(userId: string) {
    try {
        RelationshipActions.removeFriend(userId);
        Toasts.show({
            message: "Request d'friend annulée ✓",
            type: Toasts.Type.SUCCESS,
            id: Toasts.genId(),
        });
    } catch (e) {
        console.error("[CancelFriendRequest] Error:", e);
    }
}

function getUserIdFromOutgoingRelationships(): string | null {
    try {
        const rels = (RelationshipStore as any).getRelationships?.() ?? {};
        for (const [uid, type] of Object.entries(rels)) {
            if (type === OUTGOING_REQUEST) return uid;
        }
    } catch {}
    return null;
}

let observer: MutationObserver | null = null;

function patchBtn(btn: HTMLElement, userId: string) {
    if (btn.dataset.cfp) return;
    btn.dataset.cfp = "1";
    btn.addEventListener("click", (e: MouseEvent) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        cancelRequest(userId);
    }, true);
    // Retirer le disabled si présent pour que le clic soit possible
    btn.removeAttribute("disabled");
    btn.style.cursor = "pointer";
    btn.style.opacity = "1";
}

function scan(root: Document | Element = document) {
    // ── Cas 1 : popup profil ─────────────────────────────────────────────────
    // aria-label="Outgoing Friend Request" — invariant quelle que soit la langue UI
    root.querySelectorAll<HTMLElement>('button[aria-label="Outgoing Friend Request"]').forEach(btn => {
        // Trouver le userId via le container du profil
        const profileContainer = btn.closest("[class*='profileButtons']") 
            ?? btn.closest("[class*='profileHeader']")
            ?? btn.closest("[class*='inner']");
        if (!profileContainer) return;

        // Chercher un avatar avec CDN Discord qui contient le userId
        const wholeModal = btn.closest("[class*='modal'], [class*='userPopout'], [class*='profileBody']")
            ?? document;
        const avatarImg = wholeModal?.querySelector?.("img[src*='cdn.discordapp.com/avatars/']");
        if (avatarImg) {
            const m = avatarImg.getAttribute("src")?.match(/avatars\/(\d+)\//);
            if (m) { patchBtn(btn, m[1]); return; }
        }
        // Fallback : chercher via les relations en attente (si 1 seule demande sortante)
        const uid = getUserIdFromOutgoingRelationships();
        if (uid) patchBtn(btn, uid);
    });

    // ── Cas 2 : DM header ────────────────────────────────────────────────────
    // Le bouton "Friend Request Sent" est disabled + secondary dans le header DM
    // Structure : div.container_b50d96 > div.inline_b50d96 > button[disabled].secondary
    root.querySelectorAll<HTMLElement>('button[disabled][class*="secondary"]').forEach(btn => {
        // Vérifier qu'on est bien dans un header de DM (pas ailleurs)
        const container = btn.closest("[class*='container_b50d96'], [class*='dmWelcome'], [class*='privateChannelEmptyMessage']");
        if (!container) return;

        // Récupérer le userId via l'avatar dans ce header
        const avatarImg = container.querySelector("img[src*='cdn.discordapp.com/avatars/']");
        if (avatarImg) {
            const m = avatarImg.getAttribute("src")?.match(/avatars\/(\d+)\//);
            if (m) {
                const relType = (RelationshipStore as any).getRelationshipType(m[1]);
                if (relType === OUTGOING_REQUEST) { patchBtn(btn, m[1]); return; }
            }
        }

        // Fallback : via les relations sortantes
        const uid = getUserIdFromOutgoingRelationships();
        if (uid) {
            const relType = (RelationshipStore as any).getRelationshipType(uid);
            if (relType === OUTGOING_REQUEST) patchBtn(btn, uid);
        }
    });
}

export default definePlugin({
    name: "CancelFriendRequestNC",
    enabledByDefault: true,
    description: "Cancels a pending friend request by clicking the button again.",
    authors: [{ name: "Nightcord", id: 0n }],

    start() {
        observer = new MutationObserver(mutations => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node instanceof HTMLElement) scan(node);
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        scan(document);
        console.log("[CancelFriendRequest] Démarré ✓");
    },

    stop() {
        observer?.disconnect();
        observer = null;
        document.querySelectorAll<HTMLElement>("[data-cfp]").forEach(el => {
            delete el.dataset.cfp;
        });
        console.log("[CancelFriendRequest] Arrêté.");
    },
});
