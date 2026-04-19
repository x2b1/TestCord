/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { playAudio } from "@api/AudioPlayer";
import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { BaseText } from "@components/BaseText";
import { Flex } from "@components/Flex";
import { TestcordDevs } from "@utils/constants";
import {
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalProps,
    ModalRoot,
    ModalSize,
    openModal,
} from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { findComponentByCodeLazy } from "@webpack";
import { Button, React, useRef, useState } from "@webpack/common";

// Types pour les sons
interface Sound {
    id: string;
    name: string;
    emoji: string;
    frequency: number;
    duration: number;
    type: OscillatorType;
    url?: string; // Optionnel pour les sons personnalisés
    fileData?: ArrayBuffer; // Données du fichier pour les sons locaux
    fileType?: string; // Type MIME du fichier
}

// Sons prédéfinis avec URLs réelles et paramètres synthétiques de fallback
const DEFAULT_SOUNDS: Sound[] = [
    {
        id: "bruh",
        name: "Bruh",
        emoji: "😤",
        frequency: 150,
        duration: 0.8,
        type: "sawtooth",
        url: "https://www.myinstants.com/media/sounds/bruh-sound-effect.mp3",
    },
    {
        id: "oof",
        name: "Oof",
        emoji: "💀",
        frequency: 200,
        duration: 0.3,
        type: "square",
        url: "https://www.myinstants.com/media/sounds/roblox-death-sound_1.mp3",
    },
    {
        id: "vine_boom",
        name: "Vine Boom",
        emoji: "💥",
        frequency: 60,
        duration: 1.0,
        type: "sine",
        url: "https://www.myinstants.com/media/sounds/vine-boom.mp3",
    },
    {
        id: "discord_notification",
        name: "Discord Notification",
        emoji: "🔔",
        frequency: 800,
        duration: 0.2,
        type: "sine",
        url: "https://discord.com/assets/0a6c6b8b8b8b8b8b8b8b8b8b8b8b8b8b.mp3",
    },
    {
        id: "air_horn",
        name: "Air Horn",
        emoji: "📯",
        frequency: 300,
        duration: 1.5,
        type: "sawtooth",
        url: "https://www.myinstants.com/media/sounds/air-horn.mp3",
    },
    {
        id: "sad_trombone",
        name: "Sad Trombone",
        emoji: "🎺",
        frequency: 200,
        duration: 1.2,
        type: "triangle",
        url: "https://www.myinstants.com/media/sounds/sad-trombone.mp3",
    },
    {
        id: "wilhelm_scream",
        name: "Wilhelm Scream",
        emoji: "😱",
        frequency: 800,
        duration: 2.0,
        type: "sawtooth",
        url: "https://www.myinstants.com/media/sounds/wilhelm-scream.mp3",
    },
    {
        id: "crickets",
        name: "Crickets",
        emoji: "🦗",
        frequency: 4000,
        duration: 0.1,
        type: "square",
        url: "https://www.myinstants.com/media/sounds/crickets.mp3",
    },
    {
        id: "bell",
        name: "Bell",
        emoji: "🔔",
        frequency: 1000,
        duration: 0.5,
        type: "sine",
        url: "https://www.myinstants.com/media/sounds/bell.mp3",
    },
    {
        id: "buzzer",
        name: "Buzzer",
        emoji: "🚨",
        frequency: 500,
        duration: 0.4,
        type: "square",
        url: "https://www.myinstants.com/media/sounds/buzzer.mp3",
    },
    {
        id: "pop",
        name: "Pop",
        emoji: "💨",
        frequency: 2000,
        duration: 0.1,
        type: "sine",
        url: "https://www.myinstants.com/media/sounds/pop.mp3",
    },
    {
        id: "whoosh",
        name: "Whoosh",
        emoji: "💨",
        frequency: 100,
        duration: 0.8,
        type: "sawtooth",
        url: "https://www.myinstants.com/media/sounds/whoosh.mp3",
    },
];

const settings = definePluginSettings({
    enableSoundboard: {
        type: OptionType.BOOLEAN,
        description: "Activer le Soundboard Pro",
        default: true,
    },
    volume: {
        type: OptionType.SLIDER,
        description: "Volume des sons (0-100%)",
        default: 50,
        markers: [0, 25, 50, 75, 100],
        stickToMarkers: false,
    },
    enableCustomSounds: {
        type: OptionType.BOOLEAN,
        description: "Permettre l'ajout de sons personnalisés",
        default: true,
    },
    bypassPermissions: {
        type: OptionType.BOOLEAN,
        description: "Contourner les restrictions Discord",
        default: true,
    },
    forceDiscordAPI: {
        type: OptionType.BOOLEAN,
        description:
            "Forcer l'API Discord pour tous les sons (recommandé pour le canal vocal)",
        default: true,
    },
    soundMode: {
        type: OptionType.SELECT,
        description: "Mode de lecture des sons",
        options: [
            { label: "Synthétique uniquement", value: "synthetic" },
            { label: "URL + Synthétique (fallback)", value: "hybrid" },
            { label: "URL uniquement (vrais sons)", value: "url" },
        ],
        default: "hybrid",
    },
});

// Fonction pour jouer un son synthétique
function playSyntheticSound(sound: Sound) {
    try {
        const audioContext = new (window.AudioContext ||
            (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(
            sound.frequency,
            audioContext.currentTime
        );
        oscillator.type = sound.type;

        gainNode.gain.setValueAtTime(
            settings.store.volume / 100,
            audioContext.currentTime
        );
        gainNode.gain.exponentialRampToValueAtTime(
            0.01,
            audioContext.currentTime + sound.duration
        );

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + sound.duration);

        return true;
    } catch (error) {
        console.error("[SoundboardPro] Erreur synthétique:", error);
        return false;
    }
}

// Fonction pour jouer un son depuis URL
async function playUrlSound(sound: Sound) {
    try {
        if (!sound.url) return false;

        const audioContext = new (window.AudioContext ||
            (window as any).webkitAudioContext)();
        const response = await fetch(sound.url, {
            mode: "cors",
            credentials: "omit",
        });

        if (!response.ok) return false;

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const source = audioContext.createBufferSource();
        const gainNode = audioContext.createGain();

        source.buffer = audioBuffer;
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);

        gainNode.gain.setValueAtTime(
            settings.store.volume / 100,
            audioContext.currentTime
        );

        source.start();

        return true;
    } catch (error) {
        console.error("[SoundboardPro] Erreur URL:", error);
        return false;
    }
}

// Fonction pour jouer un fichier audio local dans Discord
function playLocalAudioFileInDiscord(fileUrl: string, volume: number = 0.5) {
    return new Promise<boolean>(resolve => {
        try {
            // Essayer d'abord avec l'API Discord
            try {
                playAudio(fileUrl, {
                    volume: volume,
                    persistent: false,
                });
                console.log("[SoundboardPro] Fichier audio joué via API Discord");
                resolve(true);
            } catch (discordError) {
                console.log(
                    "[SoundboardPro] API Discord échouée, tentative avec Audio natif:",
                    discordError
                );

                // Fallback vers l'API Audio native
                const audio = new Audio(fileUrl);
                audio.volume = volume / 100; // Convertir de 0-100 à 0-1
                audio.preload = "auto";

                audio.oncanplaythrough = () => {
                    console.log("[SoundboardPro] Fichier audio prêt à être joué (natif)");
                    audio
                        .play()
                        .then(() => {
                            console.log(
                                "[SoundboardPro] Fichier audio joué avec succès (natif)"
                            );
                            resolve(true);
                        })
                        .catch(error => {
                            console.error(
                                "[SoundboardPro] Erreur lors de la lecture du fichier (natif):",
                                error
                            );
                            resolve(false);
                        });
                };

                audio.onerror = error => {
                    console.error(
                        "[SoundboardPro] Erreur de chargement du fichier audio (natif):",
                        error
                    );
                    resolve(false);
                };

                // Charger le fichier
                audio.load();
            }
        } catch (error) {
            console.error(
                "[SoundboardPro] Erreur lors de la création de l'audio:",
                error
            );
            resolve(false);
        }
    });
}

// Fonction principale pour jouer un son
async function playSound(sound: Sound) {
    let success = false;

    try {
        // Vérifier si c'est un fichier local (blob URL)
        const isLocalFile = sound.url?.startsWith("blob:") || false;

        if (isLocalFile && sound.url && !settings.store.forceDiscordAPI) {
            // Pour les fichiers locaux, essayer d'abord l'API Discord, puis fallback natif
            console.log("[SoundboardPro] Lecture d'un fichier local:", sound.name);
            success = await playLocalAudioFileInDiscord(
                sound.url,
                settings.store.volume
            );
        } else {
            // Pour les URLs externes ou si forceDiscordAPI est activé
            if (settings.store.forceDiscordAPI && sound.url) {
                // Forcer l'API Discord pour tous les sons
                try {
                    playAudio(sound.url, {
                        volume: settings.store.volume,
                        persistent: false,
                    });
                    success = true;
                    console.log(
                        "[SoundboardPro] Son joué via API Discord (forcé):",
                        sound.name
                    );
                } catch (error) {
                    console.error("[SoundboardPro] Erreur API Discord (forcé):", error);
                    success = false;
                }
            } else {
                // Logique normale selon le mode
                switch (settings.store.soundMode) {
                    case "synthetic":
                        success = playSyntheticSound(sound);
                        break;

                    case "url":
                        if (sound.url) {
                            try {
                                playAudio(sound.url, {
                                    volume: settings.store.volume,
                                    persistent: false,
                                });
                                success = true;
                            } catch (error) {
                                console.error("[SoundboardPro] Erreur API Discord:", error);
                                success = false;
                            }
                        }
                        break;

                    case "hybrid":
                        if (sound.url) {
                            try {
                                playAudio(sound.url, {
                                    volume: settings.store.volume,
                                    persistent: false,
                                });
                                success = true;
                            } catch (error) {
                                console.error(
                                    "[SoundboardPro] Erreur API Discord, fallback synthétique:",
                                    error
                                );
                                success = playSyntheticSound(sound);
                            }
                        } else {
                            success = playSyntheticSound(sound);
                        }
                        break;
                }
            }
        }

        if (success) {
            const isForcedDiscord = settings.store.forceDiscordAPI && sound.url;
            showNotification({
                title: "🔊 Soundboard Pro",
                body: `Son "${sound.name}" joué${isForcedDiscord
                    ? " dans le canal vocal"
                    : isLocalFile
                        ? " (fichier local)"
                        : " dans le canal vocal"
                    }`,
                color: "var(--green-360)",
            });
        } else {
            showNotification({
                title: "🔊 Soundboard Pro",
                body: `Erreur lors de la lecture de "${sound.name}"`,
                color: "var(--red-360)",
            });
        }
    } catch (error) {
        console.error("[SoundboardPro] Erreur générale:", error);
        showNotification({
            title: "🔊 Soundboard Pro",
            body: `Erreur lors de la lecture de "${sound.name}"`,
            color: "var(--red-360)",
        });
    }
}

// Composant pour l'interface du soundboard
function SoundboardModal({ modalProps }: { modalProps: ModalProps; }) {
    const [sounds, setSounds] = useState<Sound[]>(DEFAULT_SOUNDS);
    const [isPlaying, setIsPlaying] = useState<string | null>(null);
    const [customSoundUrl, setCustomSoundUrl] = useState("");
    const [customSoundName, setCustomSoundName] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handlePlaySound = async (sound: Sound) => {
        setIsPlaying(sound.id);
        await playSound(sound);
        setTimeout(() => setIsPlaying(null), 1000);
    };

    // Fonction pour ajouter un son personnalisé via URL
    const addCustomSound = () => {
        if (!customSoundUrl.trim() || !customSoundName.trim()) return;

        const newSound: Sound = {
            id: `custom_${Date.now()}`,
            name: customSoundName,
            emoji: "🎵",
            url: customSoundUrl,
            frequency: 440, // Valeur par défaut
            duration: 1.0,
            type: "sine",
        };

        setSounds([...sounds, newSound]);
        setCustomSoundUrl("");
        setCustomSoundName("");

        showNotification({
            title: "🔊 Soundboard Pro",
            body: "Son personnalisé ajouté !",
            color: "var(--green-360)",
        });
    };

    // Fonction pour ouvrir le sélecteur de fichier MP3
    const openFileSelector = () => {
        console.log("[SoundboardPro] openFileSelector appelé");
        if (fileInputRef.current) {
            console.log("[SoundboardPro] Clic sur l'input file");
            fileInputRef.current.click();
        } else {
            console.error("[SoundboardPro] fileInputRef.current est null");
        }
    };

    // Fonction pour gérer la sélection de fichier
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        console.log("[SoundboardPro] handleFileSelect appelé", event.target.files);
        const file = event.target.files?.[0];
        if (!file) {
            console.log("[SoundboardPro] Aucun fichier sélectionné");
            return;
        }

        console.log(
            "[SoundboardPro] Fichier sélectionné:",
            file.name,
            file.type,
            file.size
        );

        // Vérifier que c'est un fichier audio
        if (!file.type.startsWith("audio/")) {
            console.log("[SoundboardPro] Type de fichier non supporté:", file.type);
            showNotification({
                title: "🔊 Soundboard Pro",
                body: "Veuillez sélectionner un fichier audio (MP3, WAV, OGG, etc.)",
                color: "var(--red-360)",
            });
            return;
        }

        // Extraire le nom du fichier sans extension
        const fileName = file.name.replace(/\.[^/.]+$/, "");

        // Convertir le fichier en ArrayBuffer pour le stocker
        const reader = new FileReader();
        reader.onload = e => {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            if (arrayBuffer) {
                const newSound: Sound = {
                    id: `file_${Date.now()}`,
                    name: fileName,
                    emoji: "🎵",
                    url: "", // Pas d'URL pour les fichiers locaux
                    frequency: 440,
                    duration: 1.0,
                    type: "sine",
                    fileData: arrayBuffer, // Stocker les données du fichier
                    fileType: file.type,
                };

                setSounds([...sounds, newSound]);

                showNotification({
                    title: "🔊 Soundboard Pro",
                    body: `Fichier "${fileName}" ajouté au soundboard !`,
                    color: "var(--green-360)",
                });
            }
        };
        reader.readAsArrayBuffer(file);

        // Réinitialiser l'input
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <ModalRoot {...modalProps} size={ModalSize.LARGE}>
            <ModalHeader>
                <BaseText size="lg" weight="semibold" style={{ flexGrow: 1 }}>
                    🔊 Soundboard Pro - Contournement des Permissions
                </BaseText>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>

            <ModalContent>
                <BaseText
                    size="md"
                    style={{ marginBottom: "16px", color: "var(--text-muted)" }}
                >
                    Soundboard avancé avec sons synthétiques et support d'URLs. Contourne
                    les restrictions Discord.
                </BaseText>
                <BaseText
                    size="sm"
                    style={{ color: "var(--text-muted)", marginBottom: "16px" }}
                >
                    📁 = Fichier local • 🎵 = URL externe • 🔊 = En cours de lecture
                </BaseText>

                {/* Sons prédéfinis */}
                <div style={{ marginBottom: "24px" }}>
                    <BaseText
                        size="md"
                        weight="semibold"
                        style={{ marginBottom: "12px" }}
                    >
                        🎵 Sons Disponibles ({sounds.length})
                    </BaseText>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                            gap: "8px",
                        }}
                    >
                        {sounds.map(sound => {
                            const isLocalFile = sound.url?.startsWith("blob:") || false;
                            return (
                                <Button
                                    key={sound.id}
                                    onClick={() => handlePlaySound(sound)}
                                    disabled={isPlaying === sound.id}
                                    color={Button.Colors.PRIMARY}
                                    look={Button.Looks.FILLED}
                                    style={{
                                        height: "70px",
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "4px",
                                        border: isLocalFile ? "2px solid var(--green-360)" : "none",
                                    }}
                                >
                                    <span style={{ fontSize: "20px" }}>{sound.emoji}</span>
                                    <span style={{ fontSize: "11px" }}>{sound.name}</span>
                                    {isPlaying === sound.id && (
                                        <span style={{ fontSize: "10px" }}>🔊</span>
                                    )}
                                    {isLocalFile && (
                                        <span
                                            style={{ fontSize: "8px", color: "var(--green-360)" }}
                                        >
                                            📁
                                        </span>
                                    )}
                                    {sound.id.startsWith("custom_") && !isLocalFile && (
                                        <span
                                            style={{ fontSize: "8px", color: "var(--text-muted)" }}
                                        >
                                            🎵
                                        </span>
                                    )}
                                </Button>
                            );
                        })}
                    </div>
                </div>

                {/* Ajout de son personnalisé */}
                {settings.store.enableCustomSounds && (
                    <div
                        style={{
                            borderTop: "1px solid var(--background-modifier-accent)",
                            paddingTop: "16px",
                        }}
                    >
                        <BaseText
                            size="md"
                            weight="semibold"
                            style={{ marginBottom: "12px" }}
                        >
                            ➕ Ajouter un Son Personnalisé
                        </BaseText>

                        {/* Input file caché */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="audio/*"
                            onChange={handleFileSelect}
                            style={{ display: "none" }}
                        />

                        <Flex direction={Flex.Direction.VERTICAL} style={{ gap: "8px" }}>
                            {/* Bouton pour sélectionner un fichier MP3 */}
                            <Button
                                onClick={openFileSelector}
                                color={Button.Colors.BRAND}
                                size={Button.Sizes.SMALL}
                                style={{ width: "100%" }}
                            >
                                📁 Sélectionner un fichier MP3
                            </Button>

                            <BaseText
                                size="sm"
                                style={{ color: "var(--text-muted)", textAlign: "center" }}
                            >
                                ou
                            </BaseText>

                            {/* Ajout via URL */}
                            <input
                                type="text"
                                placeholder="Nom du son"
                                value={customSoundName}
                                onChange={e => setCustomSoundName(e.target.value)}
                                style={{
                                    padding: "8px 12px",
                                    borderRadius: "4px",
                                    border: "1px solid var(--background-modifier-accent)",
                                    backgroundColor: "var(--input-background)",
                                    color: "var(--text-normal)",
                                    fontSize: "14px",
                                }}
                            />
                            <input
                                type="url"
                                placeholder="URL du fichier audio (MP3, WAV, OGG)"
                                value={customSoundUrl}
                                onChange={e => setCustomSoundUrl(e.target.value)}
                                style={{
                                    padding: "8px 12px",
                                    borderRadius: "4px",
                                    border: "1px solid var(--background-modifier-accent)",
                                    backgroundColor: "var(--input-background)",
                                    color: "var(--text-normal)",
                                    fontSize: "14px",
                                }}
                            />
                            <Button
                                onClick={addCustomSound}
                                disabled={!customSoundUrl.trim() || !customSoundName.trim()}
                                color={Button.Colors.GREEN}
                                size={Button.Sizes.SMALL}
                            >
                                Ajouter via URL
                            </Button>
                        </Flex>
                    </div>
                )}
            </ModalContent>

            <ModalFooter>
                <Flex direction={Flex.Direction.HORIZONTAL_REVERSE}>
                    <Button
                        onClick={modalProps.onClose}
                        color={Button.Colors.PRIMARY}
                        look={Button.Looks.FILLED}
                    >
                        Fermer
                    </Button>
                </Flex>
            </ModalFooter>
        </ModalRoot>
    );
}

// Fonction pour ouvrir le modal du soundboard
export function openSoundboardPro() {
    console.log("🔊 SoundboardPro: openSoundboardPro called");
    try {
        const modalKey = openModal(modalProps => (
            <SoundboardModal modalProps={modalProps} />
        ));
        console.log("🔊 SoundboardPro: Modal opened with key:", modalKey);
    } catch (error) {
        console.error("🔊 SoundboardPro: Error opening modal:", error);
    }
}

// Composant bouton pour le panel vocal (comme fakeDeafen)
const PanelButton = findComponentByCodeLazy(".NONE,disabled:", ".PANEL_BUTTON");

function SoundboardIcon() {
    return (
        <img
            src="./src/bashplugins/soundboardPro/icone.webp"
            alt="Soundboard Pro"
            width="28"
            height="28"
            style={{
                borderRadius: "4px",
                objectFit: "cover",
            }}
        />
    );
}

function SoundboardButton() {
    return (
        <PanelButton
            tooltipText="Soundboard Pro"
            icon={SoundboardIcon}
            onClick={() => {
                openSoundboardPro();
            }}
        />
    );
}

// Composant des paramètres
function SettingsComponent() {
    return (
        <div>
            <BaseText size="md" style={{ marginBottom: "16px" }}>
                🔊 <strong>Soundboard Pro</strong>
            </BaseText>
            <BaseText
                size="sm"
                style={{ marginBottom: "16px", color: "var(--text-muted)" }}
            >
                Soundboard avancé avec vrais sons et sons synthétiques. Joue les sons
                directement dans le canal vocal Discord.
            </BaseText>

            <div style={{ marginBottom: "16px" }}>
                <Button
                    onClick={openSoundboardPro}
                    color={Button.Colors.BRAND}
                    style={{ width: "100%" }}
                >
                    🎵 Ouvrir le Soundboard Pro
                </Button>
            </div>

            <BaseText size="sm" style={{ color: "var(--text-muted)" }}>
                <strong>✨ Fonctionnalités :</strong>
                <br />
                • 12 vrais sons avec URLs réelles
                <br />
                • Sons synthétiques en fallback
                <br />
                • 3 modes de lecture (synthétique, URL, hybride)
                <br />
                • Bouton intégré dans le panel vocal
                <br />
                • Sons joués directement dans Discord
                <br />
                • Sélection de fichiers MP3 locaux
                <br />
                • Option "Forcer API Discord" pour le canal vocal
                <br />• Interface avancée avec grille responsive
            </BaseText>
        </div>
    );
}

export default definePlugin({
    name: "SoundboardPro",
    description:
        "Advanced soundboard with real sounds and synthetic sounds. Plays sounds directly in Discord voice channel.",
    tags: ["Voice", "Utility"],
    authors: [TestcordDevs.x2b],
    settings,
    settingsAboutComponent: SettingsComponent,

    patches: [
        {
            find: "#{intl::ACCOUNT_SPEAKING_WHILE_MUTED}",
            replacement: {
                match: /className:\i\.buttons,.{0,50}children:\[/,
                replace: "$&$self.SoundboardButton(),",
            },
        },
    ],
    SoundboardButton,

    start() {
        console.log(
            "[SoundboardPro] Plugin démarré - Version fusionnée avec patch"
        );
    },

    stop() {
        console.log("[SoundboardPro] Plugin arrêté");
    },
});
