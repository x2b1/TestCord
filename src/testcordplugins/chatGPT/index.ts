import definePlugin, { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";
import { showNotification } from "@api/Notifications";
import { ApplicationCommandInputType, ApplicationCommandOptionType, sendBotMessage } from "@api/Commands";

const settings = definePluginSettings({
    apiKey: {
        type: OptionType.STRING,
        description: "Votre clé API OpenAI (obtenue sur https://platform.openai.com/api-keys)",
        default: "",
        placeholder: "sk-proj-..."
    },
    model: {
        type: OptionType.SELECT,
        description: "Modèle ChatGPT à utiliser",
        default: "gpt-4o-mini",
        options: [
            { label: "GPT-4o (2024-08-06) - Recommandé", value: "gpt-4o-2024-08-06" },
            { label: "GPT-4o Mini (2024-07-18) - Rapide & Économique", value: "gpt-4o-mini-2024-07-18" },
            { label: "GPT-4o Mini", value: "gpt-4o-mini" },
            { label: "GPT-4o", value: "gpt-4o" },
            { label: "GPT-4 Turbo (2024-04-09)", value: "gpt-4-turbo-2024-04-09" },
            { label: "GPT-4 Turbo", value: "gpt-4-turbo-preview" },
            { label: "GPT-4 (0613)", value: "gpt-4-0613" },
            { label: "GPT-4", value: "gpt-4" },
            { label: "GPT-3.5 Turbo (0125)", value: "gpt-3.5-turbo-0125" },
            { label: "GPT-3.5 Turbo", value: "gpt-3.5-turbo" }
        ]
    },
    maxTokens: {
        type: OptionType.SLIDER,
        description: "Nombre maximum de tokens dans la réponse",
        default: 500,
        markers: [100, 250, 500, 1000, 2000],
        minValue: 50,
        maxValue: 4000,
        stickToMarkers: false
    },
    temperature: {
        type: OptionType.SLIDER,
        description: "Créativité de la réponse (0 = très précis, 1 = très créatif)",
        default: 0.7,
        markers: [0, 0.3, 0.7, 1.0],
        minValue: 0,
        maxValue: 1,
        stickToMarkers: false
    },
    systemPrompt: {
        type: OptionType.STRING,
        description: "Prompt système pour personnaliser le comportement de ChatGPT",
        default: "Tu es un assistant utile et amical. Réponds de manière concise et claire.",
        placeholder: "Tu es un assistant..."
    },
    enableNotifications: {
        type: OptionType.BOOLEAN,
        description: "Afficher des notifications pour les erreurs et les succès",
        default: true
    }
});

// Variables globales
let isInitialized = false;
let isProcessing = false;

// Fonction pour afficher les notifications
function notify(title: string, body: string, isError = false) {
    if (!settings.store.enableNotifications) return;

    showNotification({
        title: isError ? `❌ ${title}` : `✅ ${title}`,
        body,
        icon: undefined
    });
}

// Fonction pour valider la clé API
function validateApiKey(apiKey: string): boolean {
    return !!(apiKey && (apiKey.startsWith("sk-") || apiKey.startsWith("sk-proj-")) && apiKey.length > 20);
}

// Fonction pour appeler ChatGPT via fetch (sans dépendance OpenAI)
async function callChatGPT(prompt: string): Promise<string> {
    const apiKey = settings.store.apiKey.trim();

    if (!validateApiKey(apiKey)) {
        throw new Error("Clé API invalide. Veuillez configurer une clé API valide dans les paramètres du plugin.");
    }

    const requestBody = {
        model: settings.store.model,
        messages: [
            {
                role: "system",
                content: settings.store.systemPrompt
            },
            {
                role: "user",
                content: prompt
            }
        ],
        max_tokens: Math.round(settings.store.maxTokens),
        temperature: Math.round(settings.store.temperature * 100) / 100
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = `Erreur API (${response.status})`;

        if (errorData.error?.message) {
            errorMessage += `: ${errorData.error.message}`;
        } else if (response.status === 401) {
            errorMessage += ": Clé API invalide ou expirée";
        } else if (response.status === 429) {
            errorMessage += ": Limite de taux atteinte, réessayez plus tard";
        }

        throw new Error(errorMessage);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error("Réponse inattendue de l'API OpenAI");
    }

    return data.choices[0].message.content.trim();
}

export default definePlugin({
    name: "ChatGPT",
    description: "Permet d'utiliser ChatGPT directement dans Discord avec paramètres configurables",
    authors: [{
        name: "Bash",
        id: 1327483363518582784n
    }],
    dependencies: ["CommandsAPI"],
    settings,
    commands: [
        {
            inputType: ApplicationCommandInputType.BUILT_IN,
            name: "chatgpt",
            description: "Posez une question à ChatGPT",
            options: [
                {
                    name: "question",
                    description: "Votre question pour ChatGPT",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                }
            ],
            execute: async (opts, ctx) => {
                try {
                    const question = opts.find(opt => opt.name === "question")?.value;

                    if (!question) {
                        sendBotMessage(ctx.channel.id, {
                            content: "❌ Aucune question fournie !"
                        });
                        return;
                    }

                    // Vérifier si une requête est en cours
                    if (isProcessing) {
                        sendBotMessage(ctx.channel.id, {
                            content: "⏳ Une requête ChatGPT est déjà en cours. Veuillez patienter..."
                        });
                        return;
                    }

                    // Utiliser la clé API des paramètres
                    const apiKey = settings.store.apiKey;

                    if (!validateApiKey(apiKey)) {
                        sendBotMessage(ctx.channel.id, {
                            content: "❌ Clé API non configurée ou invalide. Configurez votre clé dans les paramètres du plugin ChatGPT."
                        });
                        return;
                    }

                    isProcessing = true;

                    const response = await callChatGPT(question as string);

                    notify("ChatGPT", "Réponse générée avec succès");

                    sendBotMessage(ctx.channel.id, {
                        content: `🤖 **ChatGPT** (${settings.store.model}):\n\n${response}`
                    });
                } catch (error) {
                    console.error("[ChatGPT] Erreur lors de l'exécution de la commande:", error);
                    const errorMessage = error instanceof Error ? error.message : "Une erreur s'est produite lors de la communication avec ChatGPT.";

                    notify("Erreur ChatGPT", errorMessage, true);

                    sendBotMessage(ctx.channel.id, {
                        content: `❌ **Erreur ChatGPT**: ${errorMessage}`
                    });
                } finally {
                    isProcessing = false;
                }
            }
        },
        {
            inputType: ApplicationCommandInputType.BUILT_IN,
            name: "chatgpt-info",
            description: "Afficher les informations sur la configuration ChatGPT",
            options: [],
            execute: async (opts, ctx) => {
                const hasValidKey = validateApiKey(settings.store.apiKey);
                const keyStatus = hasValidKey ? "✅ Configurée" : "❌ Non configurée ou invalide";

                sendBotMessage(ctx.channel.id, {
                    content: `🤖 **Configuration ChatGPT**\n\n` +
                        `**Clé API**: ${keyStatus}\n` +
                        `**Modèle**: ${settings.store.model}\n` +
                        `**Tokens max**: ${settings.store.maxTokens}\n` +
                        `**Température**: ${settings.store.temperature}\n` +
                        `**Statut**: ${isProcessing ? "⏳ Traitement en cours" : "🟢 Prêt"}\n\n` +
                        `${!hasValidKey ? "⚠️ Configurez votre clé API dans les paramètres du plugin." : ""}`
                });
            }
        }
    ],
    start() {
        if (isInitialized) {
            console.log("[ChatGPT] Le plugin est déjà initialisé");
            return;
        }

        try {
            console.log("[ChatGPT] Initialisation du plugin...");

            const hasValidKey = validateApiKey(settings.store.apiKey);

            if (!hasValidKey) {
                notify(
                    "ChatGPT Plugin",
                    "Clé API non configurée. Configurez votre clé dans les paramètres du plugin.",
                    true
                );
            } else {
                notify("ChatGPT Plugin", "Plugin activé avec succès !");
            }

            isInitialized = true;
            console.log("[ChatGPT] Plugin initialisé avec succès");
        } catch (error) {
            console.error("[ChatGPT] Erreur lors de l'initialisation du plugin:", error);
            isInitialized = false;
            throw error;
        }
    },
    stop() {
        console.log("[ChatGPT] Arrêt du plugin...");
        isInitialized = false;
        isProcessing = false;
        notify("ChatGPT Plugin", "Plugin désactivé");
    }
});

