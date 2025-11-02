/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { showNotification } from "@api/Notifications";
import { findByPropsLazy } from "@webpack";
import { React, FluxDispatcher, Forms, Slider } from "@webpack/common";
import definePlugin, { OptionType } from "@utils/types";

const configModule = findByPropsLazy("getOutputVolume");

const settings = definePluginSettings({
    // Paramètres de limitation de volume
    maxVolume: {
        type: OptionType.SLIDER,
        default: 80,
        description: "Volume maximum autorisé (%)",
        markers: [50, 60, 70, 80, 90, 100],
        stickToMarkers: false
    },
    enableVolumeLimiting: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Activer la limitation de volume système"
    },

    // Paramètres de limitation de décibels
    maxDecibels: {
        type: OptionType.SLIDER,
        default: -3,
        description: "Décibels maximum autorisés (dB)",
        markers: [-20, -15, -10, -6, -3, 0],
        stickToMarkers: false
    },
    enableDbLimiting: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Activer la limitation des pics audio (dB)"
    },

    // Paramètres d'affichage
    showNotifications: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Afficher les notifications de limitation"
    },
    showVisualIndicator: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Afficher l'indicateur visuel"
    }
});

// État global du limiteur
let limiterState = {
    isActive: false,
    audioContext: null as AudioContext | null,
    gainNode: null as GainNode | null,
    analyser: null as AnalyserNode | null,
    compressor: null as DynamicsCompressorNode | null,
    currentLevel: 0,
    peakLevel: 0,
    limitingCount: 0,
    lastNotification: 0
};

// Fonction pour obtenir le volume actuel
function getCurrentVolume(): number {
    try {
        return configModule.getOutputVolume();
    } catch (error) {
        console.error("Audio Limiter: Erreur lors de l'obtention du volume:", error);
        return 0;
    }
}

// Fonction pour définir le volume
function setVolume(volume: number) {
    try {
        FluxDispatcher.dispatch({
            type: "AUDIO_SET_OUTPUT_VOLUME",
            volume: Math.max(0, Math.min(200, volume))
        });
    } catch (error) {
        console.error("Audio Limiter: Erreur lors de la définition du volume:", error);
    }
}

// Fonction pour analyser le niveau audio
function analyzeAudioLevel(): number {
    if (!limiterState.analyser) return 0;

    const bufferLength = limiterState.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    limiterState.analyser.getByteFrequencyData(dataArray);

    // Calculer le niveau RMS
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / bufferLength);

    // Convertir en décibels
    const db = 20 * Math.log10(rms / 255);
    return isFinite(db) ? db : -Infinity;
}

// Fonction pour vérifier et limiter le volume système
function checkAndLimitVolume() {
    if (!settings.store.enableVolumeLimiting) return;

    const currentVolume = getCurrentVolume();
    const maxVolume = settings.store.maxVolume;

    if (currentVolume > maxVolume) {
        setVolume(maxVolume);
        limiterState.limitingCount++;

        // Notification avec throttling (max 1 par seconde)
        const now = Date.now();
        if (settings.store.showNotifications && now - limiterState.lastNotification > 1000) {
            showNotification({
                title: "Audio Limiter",
                body: `Volume limité de ${currentVolume}% à ${maxVolume}%`
            });
            limiterState.lastNotification = now;
        }
    }
}

// Fonction pour créer le limiteur audio
async function createAudioLimiter() {
    if (!settings.store.enableDbLimiting) return;

    try {
        // Créer le contexte audio
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

        // Créer le compresseur pour la limitation
        const compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.value = settings.store.maxDecibels;
        compressor.knee.value = 0;
        compressor.ratio.value = 20; // Ratio élevé pour une limitation stricte
        compressor.attack.value = 0.003; // Attaque rapide
        compressor.release.value = 0.1; // Relâchement rapide

        // Créer le nœud de gain pour le contrôle final
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 1.0;

        // Créer l'analyseur pour surveiller les niveaux
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;

        // Connecter les nœuds
        compressor.connect(gainNode);
        gainNode.connect(analyser);
        analyser.connect(audioContext.destination);

        // Mettre à jour l'état
        limiterState.audioContext = audioContext;
        limiterState.gainNode = gainNode;
        limiterState.analyser = analyser;
        limiterState.compressor = compressor;

        // Démarrer la surveillance des niveaux
        startLevelMonitoring();

        if (settings.store.showNotifications) {
            showNotification({
                title: "Audio Limiter",
                body: `Limitation audio activée à ${settings.store.maxDecibels} dB`
            });
        }

        return { audioContext, gainNode, analyser, compressor };
    } catch (error) {
        console.error("Audio Limiter: Erreur lors de la création du limiteur audio:", error);
        throw error;
    }
}

// Fonction pour surveiller les niveaux audio
function startLevelMonitoring() {
    if (!settings.store.enableDbLimiting || !limiterState.analyser) return;

    function monitorLevels() {
        if (!limiterState.isActive || !settings.store.enableDbLimiting) return;

        const currentLevel = analyzeAudioLevel();
        limiterState.currentLevel = currentLevel;

        // Mettre à jour le pic
        if (currentLevel > limiterState.peakLevel) {
            limiterState.peakLevel = currentLevel;
        }

        // Vérifier si la limitation est active
        if (currentLevel > settings.store.maxDecibels) {
            limiterState.limitingCount++;

            const now = Date.now();
            if (settings.store.showNotifications && now - limiterState.lastNotification > 2000) {
                showNotification({
                    title: "Audio Limiter - Limitation Active",
                    body: `Niveau: ${currentLevel.toFixed(1)} dB (limite: ${settings.store.maxDecibels} dB)`
                });
                limiterState.lastNotification = now;
            }
        }

        // Continuer la surveillance
        requestAnimationFrame(monitorLevels);
    }

    monitorLevels();
}

// Fonction pour démarrer la surveillance du volume
function startVolumeMonitoring() {
    if (!settings.store.enableVolumeLimiting) return;

    function monitorVolume() {
        if (!limiterState.isActive || !settings.store.enableVolumeLimiting) return;

        checkAndLimitVolume();

        // Continuer la surveillance
        setTimeout(monitorVolume, 100); // Vérifier toutes les 100ms
    }

    monitorVolume();
}

// Fonction pour démarrer le limiteur
async function startLimiter() {
    if (limiterState.isActive) return;

    try {
        limiterState.isActive = true;

        // Démarrer la surveillance du volume
        startVolumeMonitoring();

        // Créer le limiteur audio si activé
        if (settings.store.enableDbLimiting) {
            await createAudioLimiter();
        }

        console.log("Audio Limiter: Limiteur démarré avec succès");
    } catch (error) {
        console.error("Audio Limiter: Erreur lors du démarrage du limiteur:", error);
        limiterState.isActive = false;
    }
}

// Fonction pour arrêter le limiteur
function stopLimiter() {
    if (!limiterState.isActive) return;

    try {
        limiterState.isActive = false;

        // Nettoyer le contexte audio
        if (limiterState.audioContext) {
            limiterState.audioContext.close();
        }

        // Réinitialiser l'état
        limiterState.audioContext = null;
        limiterState.gainNode = null;
        limiterState.analyser = null;
        limiterState.compressor = null;
        limiterState.currentLevel = 0;
        limiterState.peakLevel = 0;
        limiterState.limitingCount = 0;

        console.log("Audio Limiter: Limiteur arrêté");
    } catch (error) {
        console.error("Audio Limiter: Erreur lors de l'arrêt du limiteur:", error);
    }
}

// Composant d'indicateur visuel
function VisualIndicator() {
    const [currentLevel, setCurrentLevel] = React.useState(0);
    const [peakLevel, setPeakLevel] = React.useState(0);

    React.useEffect(() => {
        if (!settings.store.showVisualIndicator || !limiterState.isActive) return;

        const interval = setInterval(() => {
            setCurrentLevel(limiterState.currentLevel);
            setPeakLevel(limiterState.peakLevel);
        }, 50);

        return () => clearInterval(interval);
    }, [limiterState.isActive]);

    if (!settings.store.showVisualIndicator || !limiterState.isActive) return null;

    const maxDb = settings.store.maxDecibels;
    const currentPercent = Math.max(0, Math.min(100, ((currentLevel - maxDb + 20) / 20) * 100));
    const peakPercent = Math.max(0, Math.min(100, ((peakLevel - maxDb + 20) / 20) * 100));

    return (
        <div style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            background: "rgba(0, 0, 0, 0.8)",
            color: "white",
            padding: "10px",
            borderRadius: "5px",
            fontSize: "12px",
            zIndex: 10000,
            minWidth: "200px"
        }}>
            <div style={{ marginBottom: "5px", fontWeight: "bold" }}>Audio Limiter</div>
            <div style={{ marginBottom: "3px" }}>
                Niveau: {currentLevel.toFixed(1)} dB
            </div>
            <div style={{ marginBottom: "3px" }}>
                Pic: {peakLevel.toFixed(1)} dB
            </div>
            <div style={{ marginBottom: "3px" }}>
                Limite: {maxDb} dB
            </div>
            <div style={{ marginBottom: "3px" }}>
                Limitations: {limiterState.limitingCount}
            </div>
            <div style={{
                width: "100%",
                height: "10px",
                background: "#333",
                borderRadius: "5px",
                overflow: "hidden"
            }}>
                <div style={{
                    width: `${currentPercent}%`,
                    height: "100%",
                    background: currentLevel > maxDb ? "#ff4444" : "#44ff44",
                    transition: "width 0.1s ease"
                }} />
            </div>
        </div>
    );
}

// Composant de paramètres
function SettingsPanel() {
    return (
        <Forms.FormSection>
            <Forms.FormTitle>Paramètres de Limitation</Forms.FormTitle>

            <Forms.FormDivider />

            <Forms.FormText>
                Ce plugin limite automatiquement le volume de sortie pour éviter les sons trop forts.
            </Forms.FormText>

            <Forms.FormDivider />

            <Forms.FormItem>
                <Forms.FormLabel>Volume Maximum (%)</Forms.FormLabel>
                <Slider
                    value={settings.store.maxVolume}
                    onChange={(value) => settings.store.maxVolume = value}
                    min={10}
                    max={100}
                    markers={[50, 60, 70, 80, 90, 100]}
                    stickToMarkers={false}
                />
                <Forms.FormText>
                    Volume maximum autorisé: {settings.store.maxVolume}%
                </Forms.FormText>
            </Forms.FormItem>

            <Forms.FormItem>
                <Forms.FormLabel>Décibels Maximum (dB)</Forms.FormLabel>
                <Slider
                    value={settings.store.maxDecibels}
                    onChange={(value) => settings.store.maxDecibels = value}
                    min={-20}
                    max={0}
                    markers={[-20, -15, -10, -6, -3, 0]}
                    stickToMarkers={false}
                />
                <Forms.FormText>
                    Niveau audio maximum: {settings.store.maxDecibels} dB
                </Forms.FormText>
            </Forms.FormItem>

            <Forms.FormDivider />

            <Forms.FormItem>
                <Forms.FormSwitch
                    value={settings.store.enableVolumeLimiting}
                    onChange={(value) => settings.store.enableVolumeLimiting = value}
                >
                    Activer la limitation de volume
                </Forms.FormSwitch>
            </Forms.FormItem>

            <Forms.FormItem>
                <Forms.FormSwitch
                    value={settings.store.enableDbLimiting}
                    onChange={(value) => settings.store.enableDbLimiting = value}
                >
                    Activer la limitation des décibels
                </Forms.FormSwitch>
            </Forms.FormItem>

            <Forms.FormItem>
                <Forms.FormSwitch
                    value={settings.store.showNotifications}
                    onChange={(value) => settings.store.showNotifications = value}
                >
                    Afficher les notifications
                </Forms.FormSwitch>
            </Forms.FormItem>

            <Forms.FormItem>
                <Forms.FormSwitch
                    value={settings.store.showVisualIndicator}
                    onChange={(value) => settings.store.showVisualIndicator = value}
                >
                    Afficher l'indicateur visuel
                </Forms.FormSwitch>
            </Forms.FormItem>

            <Forms.FormDivider />

            <Forms.FormText>
                <strong>Statut:</strong> {limiterState.isActive ? "Actif" : "Inactif"}
            </Forms.FormText>
            <Forms.FormText>
                <strong>Limitations appliquées:</strong> {limiterState.limitingCount}
            </Forms.FormText>
        </Forms.FormSection>
    );
}

export default definePlugin({
    name: "Audio Limiter",
    description: "Limite automatiquement le volume de sortie pour éviter les sons trop forts",
    authors: [{ name: "Bash", id: 1327483363518582784n }],
    settings,
    settingsAboutComponent: SettingsPanel,

    start() {
        console.log("Audio Limiter: Plugin démarré");
        startLimiter();
    },

    stop() {
        console.log("Audio Limiter: Plugin arrêté");
        stopLimiter();
    },

    patches: [
        {
            find: "AUDIO_SET_OUTPUT_VOLUME",
            replacement: {
                match: /AUDIO_SET_OUTPUT_VOLUME/,
                replace: "AUDIO_SET_OUTPUT_VOLUME_LIMITED"
            }
        }
    ]
});