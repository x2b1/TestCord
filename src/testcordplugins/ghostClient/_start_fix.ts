
        setTimeout(() => {
            const ghostMicLabel: any = "";
            const savedAccounts: any = [];
            (VencordNative.pluginHelpers.GhostClient as any).init().catch(() => { });

            (async () => {
                if (savedAccounts.length === 0) return;
                console.log("[GhostClient] Pre-connecting", savedAccounts.length, "account(s)...");
                for (const acc of savedAccounts) {
                    (VencordNative.pluginHelpers.GhostClient as any).preConnectGhost(acc.userId, acc.token, ghostMicLabel)
                        .then((r: any) => console.log("[GhostClient] Pre-connected:", acc.username, r?.ok))
                        .catch(() => { });
                    // FIX DM SCROLL CRASH: delay increased from 800ms → 2000ms
                    // Mass pre-connection (20+ accounts × 800ms) was saturating the renderer
                    // during exactly the window where the user scrolls through their DMs.
                    // Each preConnectGhost triggers IPC events that force React re-renders
                    // → removeChild crash on the virtualized DM list.
                    // 2000ms between each connection spaces out the load sufficiently.
                    await new Promise(r => setTimeout(r, 2000));
                }
            })();
        }, 30000); // FIX: initial delay 10s → 30s to let the UI stabilize at startup
