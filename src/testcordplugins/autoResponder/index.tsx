import definePlugin, { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";
import { UserStore, ChannelStore, RestAPI, FluxDispatcher, React } from "@webpack/common";
import { DataStore } from "@api/index";
import { groqChat, getGroqKey } from "../nightcordAI/groqManager";
import { ChatBarButton } from "@api/ChatButtons";
import { findByPropsLazy } from "@webpack";

const MessageStore = findByPropsLazy("getMessages");

const settings = definePluginSettings({
    warning: {
        type: OptionType.COMPONENT,
        component: () => (
            <div style={{
                backgroundColor: "rgba(250, 166, 26, 0.1)",
                border: "1px solid var(--status-warning)",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                color: "#FFFFFF"
            }}>
                <span style={{ fontSize: "24px" }}>⚠️</span>
                <div>
                    <div style={{ fontWeight: "bold", color: "var(--status-warning)" }}>API Key Required</div>
                    <div style={{ fontSize: "13px", marginTop: "4px" }}>
                        AutoResponder requires a Groq API Key to function.
                        Please configure it once in the <strong>NightcordAI</strong> settings.
                    </div>
                </div>
            </div>
        )
    },
    isActive: {
        type: OptionType.BOOLEAN,
        description: "AutoResponder functional status",
        default: false,
        restartNeeded: false
    },
    personalInfo: {
        type: OptionType.STRING,
        description: "Personal Information (Name, Age, Location, etc.)",
        default: "",
        restartNeeded: false,
    },
    writingStyle: {
        type: OptionType.STRING,
        description: "Your Writing Style (e.g. casual, no caps, use 'ptn', etc.)",
        default: "",
        restartNeeded: false,
    },
    customInstructions: {
        type: OptionType.STRING,
        description: "Custom Instructions (What to say or NOT to say)",
        default: "",
        restartNeeded: false,
    },
    blacklistedWords: {
        type: OptionType.STRING,
        description: "Blacklisted Words or Topics (comma separated)",
        default: "",
        restartNeeded: false,
    },
    blacklistedUsers: {
        type: OptionType.STRING,
        description: "Blacklisted User IDs (comma separated) — AutoResponder will not reply to these users.",
        default: "",
        restartNeeded: false,
    },
    delayMin: {
        type: OptionType.NUMBER,
        description: "Minimum Delay (seconds)",
        default: 5,
        restartNeeded: false,
    },
    delayMax: {
        type: OptionType.NUMBER,
        description: "Maximum Delay (seconds)",
        default: 12,
        restartNeeded: false,
    }
});

const DS_STYLE_KEY = "auto-responder-global-style";

let lastMessageId = "";
let cachedGlobalStyle = "";

async function handleMessage(message: any) {
    if (!settings.store.isActive) return;

    const currentUser = UserStore.getCurrentUser();
    if (!currentUser || message.author.id === currentUser.id) return;

    // Vérification de la blacklist utilisateurs
    const blacklistedUsers = settings.store.blacklistedUsers?.split(",").map((id: string) => id.trim()) || [];
    if (blacklistedUsers.includes(message.author.id)) {
        console.log(`[AutoResponder] Skipping blacklisted user: ${message.author.username} (${message.author.id})`);
        return;
    }

    if (message.id === lastMessageId) return;

    const channel = ChannelStore.getChannel(message.channel_id);
    // RESTRICTION STRICTE : Uniquement les DMs (Type 1)
    if (!channel || channel.type !== 1) return;

    lastMessageId = message.id;

    try {
        const apiKey = await getGroqKey();
        if (!apiKey) {
            try {
                const { openConfirmationModal } = findByPropsLazy("openConfirmationModal");
                openConfirmationModal({
                    header: "API Key Required",
                    content: "AutoResponder requires a Groq API Key to function. Please configure it once in the NightcordAI settings.",
                    confirmText: "Configure NightcordAI",
                    cancelText: "Cancel",
                    onConfirm: () => {
                        const { openModal } = findByPropsLazy("openModal");
                        // Logique pour ouvrir les settings NightcordAI si possible
                    }
                });
            } catch (e) {
                console.error("[AutoResponder] API Key missing and could not open modal", e);
            }
            return;
        }

        // Récupération de l'historique récent pour la cohérence
        let localHistory = "";
        try {
            const msgs = MessageStore.getMessages(message.channel_id).toArray().slice(-15);
            localHistory = msgs.map((m: any) => {
                const author = m.author.id === currentUser.id ? "MOI" : "L'AMI";
                return `${author}: ${m.content}`;
            }).join("\n");
        } catch { }

        const prompt = `Tu es l'utilisateur (MOI). Réponds au dernier message de L'AMI.
        
MES INFOS PERSONNELLES :
${settings.store.personalInfo}

MES INSTRUCTIONS :
${settings.store.customInstructions}

LISTE NOIRE :
${settings.store.blacklistedWords}

HISTORIQUE :
${localHistory}

LATEST MESSAGE : "${message.content}"

RÈGLES DE COMPORTEMENT (CRUCIAL) :
1. RÉPONSES COURTES : Fais des réponses concises (1 ou 2 phrases max). Ne fais pas de longs paragraphes.
2. DISCRÉTION DES INFOS : N'utilise mes infos personnelles (ex: Paris) que si c'est pertinent. Ne ramène pas tout à Paris à chaque message.
3. STYLE ÉCRIT NATUREL : À l'écrit, on ne dit pas "heu..." ou "attends" quand on calcule. On donne juste le résultat ou on continue la phrase. Supprime toute trace d'hésitation orale.
4. HUMAIN : Parle comme un pote sur Discord (langage SMS léger autorisé si mon style le permet).

MISSION :
Réponds de manière naturelle. NE RENVOIE QUE LE TEXTE DE TA RÉPONSE.`;

        const reply = await groqChat({
            messages: [
                { role: "system", content: "Tu es un AutoResponder ultra-personnalisable pour Discord." },
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
            maxTokens: 500
        });

        if (reply && !reply.startsWith("❌")) {
            // Délai réaliste : base fixe + temps proportionnel à la longueur du message
            const baseDelay = Math.floor(Math.random() * (settings.store.delayMax - settings.store.delayMin + 1) + settings.store.delayMin);
            const extraDelay = reply.length > 100 ? 2 : 0; // +2s si message long
            const totalDelay = (baseDelay + extraDelay) * 1000;

            try {
                const TypingActions = findByPropsLazy("startTyping");
                TypingActions.startTyping(message.channel_id);
            } catch { }

            setTimeout(async () => {
                await RestAPI.post({
                    url: `/channels/${message.channel_id}/messages`,
                    body: { content: reply }
                });
            }, totalDelay);
        }
    } catch (err) {
        console.error("[AutoResponder] Error:", err);
    }
}

const messageCreateListener = (data: any) => {
    // Discord dispatch MESSAGE_CREATE structure can vary
    const msg = data.message || data;
    if (msg && msg.author) {
        handleMessage(msg);
    }
};

const KeyboardIcon = (props: any) => (
    <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
    >
        <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
        <line x1="6" y1="8" x2="6" y2="8" />
        <line x1="10" y1="8" x2="10" y2="8" />
        <line x1="14" y1="8" x2="14" y2="8" />
        <line x1="18" y1="8" x2="18" y2="8" />
        <line x1="6" y1="12" x2="6" y2="12" />
        <line x1="10" y1="12" x2="10" y2="12" />
        <line x1="14" y1="12" x2="14" y2="12" />
        <line x1="18" y1="12" x2="18" y2="12" />
        <line x1="7" y1="16" x2="17" y2="16" />
        {!props.enabled && <line x1="22" y1="2" x2="2" y2="22" stroke="var(--status-danger)" strokeWidth="2.5" />}
    </svg>
);

let _forceUpdate: () => void = () => { };
function forceRerender() {
    _forceUpdate();
}

const AutoResponderButton = () => {
    const [, setTick] = React.useState(0);
    const isEnabled = settings.store.isActive;

    React.useEffect(() => {
        _forceUpdate = () => setTick(t => t + 1);
        return () => { _forceUpdate = () => { }; };
    }, []);

    const toggle = async () => {
        const newState = !settings.store.isActive;

        if (newState) {
            const key = await getGroqKey();
            if (!key) {
                try {
                    const { openConfirmationModal } = findByPropsLazy("openConfirmationModal");
                    openConfirmationModal({
                        header: "API Key Required",
                        content: "AutoResponder requires a Groq API Key to function. Please configure it once in the NightcordAI settings.",
                        confirmText: "Close",
                        confirmColor: "brand"
                    });
                } catch { }
                return;
            }
        }

        settings.store.isActive = newState;
        setTick(t => t + 1);
    };

    return (
        <ChatBarButton
            tooltip={`AutoResponder: ${isEnabled ? "ON" : "OFF"}`}
            onClick={toggle}
        >
            <KeyboardIcon enabled={isEnabled} style={{ color: isEnabled ? "var(--brand-experiment)" : "var(--interactive-normal)" }} />
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "AutoResponder",
    description: "Automatically reply to DMs using AI to match your writing style.",
    authors: [{ name: "Nightcord", id: 0n }],
    settings,
    enabledByDefault: true,
    chatBarButton: {
        icon: KeyboardIcon,
        render: AutoResponderButton,
    },

    flux: {
        async MESSAGE_CREATE(data: any) {
            const msg = data.message || data;
            if (msg && msg.author) {
                handleMessage(msg);
            }
        }
    },

    start() {
        console.log("[AutoResponder] Plugin starting...");
    },

    stop() {
    }
});
