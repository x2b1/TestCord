
        setTimeout(() => {
            Native.init().catch(() => { });

            (async () => {
                if (savedAccounts.length === 0) return;
                console.log("[GhostClient] Pré-connexion de", savedAccounts.length, "account(s)...");
                for (const acc of savedAccounts) {
                    Native.preConnectGhost(acc.userId, acc.token, ghostMicLabel)
                        .then(r => console.log("[GhostClient] Pré-connecté:", acc.username, r?.ok))
                        .catch(() => { });
                    // FIX CRASH SCROLL DM: délai augmenté de 800ms → 2000ms
                    // La pré-connexion de masse (20+ comptes × 800ms) saturait le renderer
                    // pendant exactement la fenêtre où l'utilisateur scrolle dans ses DMs.
                    // Chaque preConnectGhost déclenche des events IPC qui forcent des re-renders
                    // React → removeChild crash sur la liste virtualisée des DMs.
                    // 2000ms entre chaque connexion espace suffisamment la charge.
                    await new Promise(r => setTimeout(r, 2000));
                }
            })();
        }, 30000); // FIX: délai initial 10s → 30s pour laisser l'UI se stabiliser au démarrage
