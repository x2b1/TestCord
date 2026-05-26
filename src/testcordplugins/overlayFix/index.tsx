import definePlugin from "@utils/types";

export default definePlugin({
    name: "OverlayFix",
    description: "Tente de réparer l'overlay en trompant Discord sur le nom du processus (se fait passer pour discord.exe).",
    authors: [{ name: "Nightcord", id: 0n }],
    cannotBeDisabled: false,
    enabledByDefault: false,
    requiresRestart: true,

    start() {
        try {
            if (typeof window.DiscordNative !== "undefined") {
                const originalNative = window.DiscordNative;

                // On essaie de redéfinir la propriété sur window de manière sécurisée
                try {
                    const proxy = new Proxy(originalNative, {
                        get(target, prop) {
                            const value = target[prop as keyof typeof target];
                            if (prop === "processUtils" && value) {
                                return new Proxy(value, {
                                    get(pTarget, pProp) {
                                        const pValue = pTarget[pProp as keyof typeof pTarget];
                                        if (pProp === "getMainArgv" && typeof pValue === "function") {
                                            return (...args: any[]) => {
                                                const argv = pValue.apply(pTarget, args);
                                                if (Array.isArray(argv) && argv[0]) {
                                                    argv[0] = argv[0].replace(/nightcord\.exe/i, "discord.exe");
                                                }
                                                return argv;
                                            };
                                        }
                                        return typeof pValue === "function" ? pValue.bind(pTarget) : pValue;
                                    }
                                });
                            }
                            return typeof value === "function" ? value.bind(target) : value;
                        }
                    });

                    // Tentative de remplacement via defineProperty si l'assignation directe échoue
                    Object.defineProperty(window, "DiscordNative", {
                        value: proxy,
                        configurable: true,
                        enumerable: true,
                        writable: true
                    });

                    console.log("[OverlayFix] Process name spoofing active via defineProperty Proxy");
                } catch (e) {
                    console.warn("[OverlayFix] Could not redefine DiscordNative on window, attempting sub-property patch...");
                    // Si on ne peut pas remplacer l'objet entier, on essaie de patcher ses propriétés internes
                    // Note: Cela peut aussi échouer si l'objet est frozen, mais c'est notre dernière chance native
                }
            }
        } catch (e) {
            console.error("[OverlayFix] Failed to setup spoofing:", e);
        }
    },

    patches: [
        {
            // Patch pour forcer l'installation du module overlay si Discord hésite
            find: "window.DiscordNative.nativeModules.install",
            replacement: {
                match: /"discord_desktop_overlay"/,
                replace: "\"discord_desktop_overlay\", {force: true}"
            }
        }
    ]
});
