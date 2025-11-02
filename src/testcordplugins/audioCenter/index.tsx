/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { showNotification } from "@api/Notifications";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { React, MediaEngineStore, FluxDispatcher, Forms, Select, Slider, Button } from "@webpack/common";
import { identity } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";

const configModule = findByPropsLazy("getOutputVolume");

const settings = definePluginSettings({
    // Paramètres du mixeur audio
    enabled: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Activer le centre audio"
    },
    primaryDevice: {
        type: OptionType.COMPONENT,
        component: () => <PrimaryDeviceSelector />,
        description: "Périphérique audio principal (microphone)"
    },
    secondaryDevice: {
        type: OptionType.COMPONENT,
        component: () => <SecondaryDeviceSelector />,
        description: "Périphérique audio secondaire (musique, etc.)"
    },
    primaryVolume: {
        type: OptionType.SLIDER,
        default: 100,
        description: "Volume du périphérique principal (%)",
        markers: [0, 25, 50, 75, 100],
        stickToMarkers: false
    },
    secondaryVolume: {
        type: OptionType.SLIDER,
        default: 50,
        description: "Volume du périphérique secondaire (%)",
        markers: [0, 25, 50, 75, 100],
        stickToMarkers: false
    },

    // Paramètres du périphérique virtuel
    virtualDeviceName: {
        type: OptionType.STRING,
        default: "AudioCenter - Sortie Virtuelle",
        description: "Nom du périphérique virtuel"
    },
    autoSetAsOutput: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Définir automatiquement comme périphérique de sortie Discord"
    },


    // Paramètres généraux
    showNotifications: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Afficher les notifications"
    }
});

// Variables globales
let selectedPrimaryDevice = "";
let selectedSecondaryDevice = "";

// État du mixeur audio
interface AudioMixerState {
    isActive: boolean;
    audioContext: AudioContext | null;
    primaryStream: MediaStream | null;
    secondaryStream: MediaStream | null;
    primaryGain: GainNode | null;
    secondaryGain: GainNode | null;
    destination: MediaStreamAudioDestinationNode | null;
    mixedStream: MediaStream | null;
}

let mixerState: AudioMixerState = {
    isActive: false,
    audioContext: null,
    primaryStream: null,
    secondaryStream: null,
    primaryGain: null,
    secondaryGain: null,
    destination: null,
    mixedStream: null
};

// État du périphérique virtuel
let virtualOutputDevice = {
    id: "audioCenter-virtual-output",
    name: "AudioCenter - Sortie Virtuelle",
    isActive: false,
    audioContext: null as AudioContext | null,
    destination: null as MediaStreamAudioDestinationNode | null,
    gainNode: null as GainNode | null
};


// ==================== FONCTIONS UTILITAIRES ====================

// Fonction pour injecter le périphérique virtuel dans Discord
function injectVirtualDevice() {
    try {
        console.log("AudioCenter: Injection du périphérique virtuel...");

        // Intercepter la fonction getInputDevices de Discord
        if (configModule && configModule.getInputDevices) {
            const originalGetInputDevices = configModule.getInputDevices.bind(configModule);

            configModule.getInputDevices = () => {
                const originalDevices = originalGetInputDevices();

                // Ajouter le périphérique virtuel à la liste Discord
                const virtualDevice = {
                    id: 'virtual-audio-center',
                    name: 'AudioCenter - Mixeur Virtuel',
                    type: 'audioinput'
                };

                // Créer un nouvel objet avec le périphérique virtuel ajouté
                const devicesWithVirtual = {
                    ...originalDevices,
                    'virtual-audio-center': virtualDevice
                };

                console.log("AudioCenter: Périphérique virtuel ajouté à la liste Discord");

                return devicesWithVirtual;
            };

            console.log("AudioCenter: configModule.getInputDevices intercepté avec succès");
        } else {
            console.error("AudioCenter: configModule ou getInputDevices non disponible");
        }

        // Intercepter le dispatcher Discord pour gérer la sélection du périphérique virtuel
        if (FluxDispatcher && FluxDispatcher.dispatch) {
            const originalDispatch = FluxDispatcher.dispatch.bind(FluxDispatcher);

            FluxDispatcher.dispatch = (action: any) => {
                // Si c'est une sélection de périphérique d'entrée virtuel
                if (action.type === "AUDIO_SET_INPUT_DEVICE" && action.id === 'virtual-audio-center') {
                    console.log("AudioCenter: Périphérique virtuel sélectionné");

                    // Démarrer le mixage si pas déjà actif
                    if (!mixerState.isActive && selectedPrimaryDevice && selectedSecondaryDevice) {
                        startAudioMixing();
                    }
                }

                return originalDispatch(action);
            };
        }

        // Ajouter les patches nécessaires
        patchDiscordComponents();
        addDirectPatch();
        createGlobalFunction();

        console.log("AudioCenter: Périphérique virtuel injecté avec succès");
    } catch (error) {
        console.error("AudioCenter: Erreur lors de l'injection du périphérique virtuel dans Discord:", error);
    }
}

// Fonction pour patcher les composants Discord
function patchDiscordComponents() {
    try {
        console.log("AudioCenter: Patch des composants Discord...");

        // Utiliser une approche plus directe en interceptant les modules Discord
        const { findByPropsLazy } = Vencord.Webpack;

        // Chercher le module qui contient les fonctions de gestion des périphériques
        const AudioDeviceModule = findByPropsLazy("getInputDevices", "getOutputDevices");
        if (AudioDeviceModule) {
            // Intercepter getInputDevices si ce n'est pas déjà fait
            if (AudioDeviceModule.getInputDevices && AudioDeviceModule.getInputDevices !== configModule.getInputDevices) {
                const originalGetInputDevices = AudioDeviceModule.getInputDevices.bind(AudioDeviceModule);

                AudioDeviceModule.getInputDevices = () => {
                    const devices = originalGetInputDevices();

                    // Ajouter le périphérique virtuel
                    const virtualDevice = {
                        id: 'virtual-audio-center',
                        name: 'AudioCenter - Mixeur Virtuel',
                        type: 'audioinput'
                    };

                    const devicesWithVirtual = {
                        ...devices,
                        'virtual-audio-center': virtualDevice
                    };

                    return devicesWithVirtual;
                };
            }
        }

        console.log("AudioCenter: Composants Discord patchés");
    } catch (error) {
        console.error("AudioCenter: Erreur lors du patch des composants Discord:", error);
    }
}

// Fonction pour ajouter un patch direct
function addDirectPatch() {
    try {
        console.log("AudioCenter: Ajout d'un patch direct...");

        // Utiliser l'API de patch de Vencord
        const { addPatch } = Vencord.Patcher;

        // Patcher directement les composants de sélection de périphériques
        addPatch({
            plugin: "AudioCenter",
            patches: [
                {
                    find: "getInputDevices",
                    replacement: {
                        match: /getInputDevices\(\)/g,
                        replace: "getInputDevicesWithVirtual()"
                    }
                }
            ]
        });

        console.log("AudioCenter: Patch direct ajouté");
    } catch (error) {
        console.error("AudioCenter: Erreur lors de l'ajout du patch direct:", error);
    }
}

// Fonction pour créer une fonction globale
function createGlobalFunction() {
    try {
        console.log("AudioCenter: Création d'une fonction globale...");

        // Créer une fonction globale que Discord peut utiliser
        (window as any).getInputDevicesWithVirtual = () => {
            const originalDevices = configModule.getInputDevices();

            const virtualDevice = {
                id: 'virtual-audio-center',
                name: 'AudioCenter - Mixeur Virtuel',
                type: 'audioinput'
            };

            const devicesWithVirtual = {
                ...originalDevices,
                'virtual-audio-center': virtualDevice
            };

            return devicesWithVirtual;
        };

        console.log("AudioCenter: Fonction globale créée");
    } catch (error) {
        console.error("AudioCenter: Erreur lors de la création de la fonction globale:", error);
    }
}

// Fonction pour obtenir la liste des périphériques audio d'entrée
function getInputDevices() {
    try {
        console.log("AudioCenter: Tentative d'obtention des périphériques d'entrée...");
        const devices = Object.values(configModule.getInputDevices());
        console.log("AudioCenter: Périphériques d'entrée obtenus:", devices.length);
        console.log("AudioCenter: Périphériques détaillés:", devices);

        return devices;
    } catch (error) {
        console.error("AudioCenter: Erreur lors de l'obtention des périphériques d'entrée:", error);
        return [];
    }
}

// ==================== PÉRIPHÉRIQUE VIRTUEL ====================

// Fonction pour créer le périphérique virtuel d'entrée
async function createVirtualInputDevice() {
    try {
        console.log("AudioCenter: Début de création du périphérique virtuel d'entrée...");

        const audioContext = new AudioContext();
        console.log("AudioCenter: Contexte audio créé:", audioContext.state);

        const destination = audioContext.createMediaStreamDestination();
        console.log("AudioCenter: Destination créée:", destination);

        const gainNode = audioContext.createGain();
        gainNode.gain.value = 1.0;
        console.log("AudioCenter: Nœud de gain créé avec valeur:", gainNode.gain.value);

        gainNode.connect(destination);
        console.log("AudioCenter: Gain connecté à la destination");

        virtualOutputDevice = {
            ...virtualOutputDevice,
            isActive: true,
            audioContext,
            destination,
            gainNode
        };

        // Créer un stream d'entrée virtuel
        const virtualInputStream = destination.stream;
        console.log("AudioCenter: Stream d'entrée virtuel créé:", virtualInputStream);

        // Exposer le stream comme périphérique d'entrée via une API personnalisée
        if (window.navigator && window.navigator.mediaDevices) {
            // Créer une fonction personnalisée pour obtenir le stream virtuel
            const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

            navigator.mediaDevices.getUserMedia = async (constraints) => {
                console.log("AudioCenter: getUserMedia appelé avec:", constraints);

                // Si c'est une demande pour le périphérique virtuel
                if (constraints.audio && typeof constraints.audio === 'object' &&
                    constraints.audio.deviceId === 'virtual-audio-center') {
                    console.log("AudioCenter: Retour du stream virtuel");
                    return virtualInputStream;
                }

                // Sinon, utiliser la fonction originale
                return originalGetUserMedia(constraints);
            };
        }

        console.log("AudioCenter: Périphérique virtuel d'entrée créé avec succès");
        return { audioContext, destination, gainNode, virtualInputStream };
    } catch (error) {
        console.error("AudioCenter: Erreur lors de la création du périphérique virtuel d'entrée:", error);
        throw error;
    }
}

// Fonction pour définir le périphérique virtuel comme sortie Discord
function setVirtualDeviceAsOutput() {
    try {
        console.log("AudioCenter: Tentative de définition du périphérique virtuel comme sortie...");

        if (!virtualOutputDevice.isActive || !virtualOutputDevice.destination) {
            console.error("AudioCenter: Périphérique virtuel non actif ou destination manquante");
            return;
        }

        const virtualStream = virtualOutputDevice.destination.stream;
        console.log("AudioCenter: Stream virtuel obtenu:", virtualStream);

        const audioElement = new Audio();
        audioElement.srcObject = virtualStream;
        console.log("AudioCenter: Élément audio créé avec stream virtuel");

        audioElement.play().then(() => {
            console.log("AudioCenter: Stream virtuel en cours de lecture");
        }).catch(error => {
            console.error("AudioCenter: Erreur lors de la lecture du stream:", error);
        });

        console.log("AudioCenter: Capacités du navigateur:");
        console.log("- setSinkId support (HTMLAudioElement):", 'setSinkId' in HTMLAudioElement.prototype);
        console.log("- setSinkId support (AudioContext):", 'setSinkId' in AudioContext.prototype);

        if ('setSinkId' in HTMLAudioElement.prototype) {
            console.log("AudioCenter: Tentative de définition du sinkId...");
            // @ts-expect-error
            audioElement.setSinkId(virtualOutputDevice.id).then(() => {
                console.log("AudioCenter: SinkId défini avec succès");
            }).catch(error => {
                console.error("AudioCenter: Erreur lors de la définition du sinkId:", error);
            });
        }

        if (virtualOutputDevice.audioContext && 'setSinkId' in AudioContext.prototype) {
            console.log("AudioCenter: Tentative de définition du sinkId sur le contexte audio...");
            // @ts-expect-error
            virtualOutputDevice.audioContext.setSinkId(virtualOutputDevice.id).then(() => {
                console.log("AudioCenter: SinkId défini sur le contexte audio avec succès");
            }).catch(error => {
                console.error("AudioCenter: Erreur lors de la définition du sinkId sur le contexte audio:", error);
            });
        }

        console.log("AudioCenter: Périphérique virtuel défini comme sortie");

        if (settings.store.showNotifications) {
            showNotification({
                title: "AudioCenter",
                body: "Périphérique virtuel défini comme sortie Discord"
            });
        }
    } catch (error) {
        console.error("AudioCenter: Erreur lors de la définition du périphérique virtuel:", error);
    }
}

// ==================== MIXEUR AUDIO ====================

// Fonction pour créer le contexte audio et mixer les sources
async function createAudioMixer(primaryDeviceId: string, secondaryDeviceId: string) {
    try {
        console.log("AudioCenter: Début de création du mixeur...");

        await createVirtualInputDevice();

        if (!virtualOutputDevice.isActive || !virtualOutputDevice.audioContext) {
            throw new Error("Impossible de créer le périphérique virtuel");
        }

        const audioContext = virtualOutputDevice.audioContext;
        console.log("AudioCenter: Contexte audio du périphérique virtuel utilisé:", audioContext.state);

        const primaryGain = audioContext.createGain();
        const secondaryGain = audioContext.createGain();
        console.log("AudioCenter: Nœuds de gain créés");

        console.log("AudioCenter: Demande d'accès aux périphériques audio...");
        const primaryStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                deviceId: primaryDeviceId,
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });
        console.log("AudioCenter: Stream principal obtenu:", primaryStream);

        const secondaryStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                deviceId: secondaryDeviceId,
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });
        console.log("AudioCenter: Stream secondaire obtenu:", secondaryStream);

        const primarySource = audioContext.createMediaStreamSource(primaryStream);
        const secondarySource = audioContext.createMediaStreamSource(secondaryStream);
        console.log("AudioCenter: Sources audio créées");

        primarySource.connect(primaryGain);
        secondarySource.connect(secondaryGain);
        console.log("AudioCenter: Sources connectées aux nœuds de gain");

        primaryGain.connect(virtualOutputDevice.gainNode!);
        secondaryGain.connect(virtualOutputDevice.gainNode!);
        console.log("AudioCenter: Nœuds de gain connectés au périphérique virtuel");

        primaryGain.gain.value = settings.store.primaryVolume / 100;
        secondaryGain.gain.value = settings.store.secondaryVolume / 100;
        console.log("AudioCenter: Volumes configurés:", {
            primary: primaryGain.gain.value,
            secondary: secondaryGain.gain.value
        });

        if (settings.store.autoSetAsOutput) {
            console.log("AudioCenter: Définition automatique comme sortie activée");
            setVirtualDeviceAsOutput();
        }

        return {
            audioContext,
            destination: virtualOutputDevice.destination,
            primaryGain,
            secondaryGain,
            primaryStream,
            secondaryStream,
            mixedStream: virtualOutputDevice.destination!.stream
        };

    } catch (error) {
        console.error("AudioCenter: Erreur lors de la création du mixer:", error);
        throw error;
    }
}

// Fonction pour démarrer le mixage
async function startAudioMixing() {
    console.log("AudioCenter: Tentative de démarrage du mixage...");

    if (mixerState.isActive) {
        console.log("AudioCenter: Le mixage est déjà actif");
        if (settings.store.showNotifications) {
            showNotification({
                title: "AudioCenter",
                body: "Le mixage audio est déjà actif"
            });
        }
        return;
    }

    if (!selectedPrimaryDevice || !selectedSecondaryDevice) {
        console.error("AudioCenter: Périphériques non sélectionnés");
        if (settings.store.showNotifications) {
            showNotification({
                title: "AudioCenter - Erreur",
                body: "Veuillez sélectionner les deux périphériques audio"
            });
        }
        return;
    }

    try {
        console.log("AudioCenter: Création du mixeur...");
        const mixer = await createAudioMixer(selectedPrimaryDevice, selectedSecondaryDevice);

        mixerState = {
            isActive: true,
            ...mixer
        };
        console.log("AudioCenter: État du mixeur mis à jour:", mixerState);

        console.log("AudioCenter: Mixage démarré avec succès");
        if (settings.store.showNotifications) {
            showNotification({
                title: "AudioCenter",
                body: "Mixage audio démarré avec succès"
            });
        }

    } catch (error) {
        console.error("AudioCenter: Erreur lors du démarrage:", error);
        if (settings.store.showNotifications) {
            showNotification({
                title: "AudioCenter - Erreur",
                body: "Impossible de démarrer le mixage audio"
            });
        }
    }
}

// Fonction pour arrêter le mixage
function stopAudioMixing() {
    if (!mixerState.isActive) {
        if (settings.store.showNotifications) {
            showNotification({
                title: "AudioCenter",
                body: "Le mixage audio n'est pas actif"
            });
        }
        return;
    }

    try {
        if (mixerState.primaryStream) {
            mixerState.primaryStream.getTracks().forEach(track => track.stop());
        }
        if (mixerState.secondaryStream) {
            mixerState.secondaryStream.getTracks().forEach(track => track.stop());
        }

        if (mixerState.audioContext) {
            mixerState.audioContext.close();
        }

        stopVirtualOutputDevice();

        mixerState = {
            isActive: false,
            audioContext: null,
            primaryStream: null,
            secondaryStream: null,
            primaryGain: null,
            secondaryGain: null,
            destination: null,
            mixedStream: null
        };

        if (settings.store.showNotifications) {
            showNotification({
                title: "AudioCenter",
                body: "Mixage audio arrêté"
            });
        }

    } catch (error) {
        console.error("AudioCenter: Erreur lors de l'arrêt:", error);
    }
}


// ==================== FONCTIONS D'ARRÊT ====================

// Fonction pour arrêter le périphérique virtuel
function stopVirtualOutputDevice() {
    try {
        if (virtualOutputDevice.audioContext) {
            virtualOutputDevice.audioContext.close();
        }

        virtualOutputDevice = {
            id: "audioCenter-virtual-output",
            name: "AudioCenter - Sortie Virtuelle",
            isActive: false,
            audioContext: null,
            destination: null,
            gainNode: null
        };

        console.log("AudioCenter: Périphérique virtuel arrêté");
    } catch (error) {
        console.error("AudioCenter: Erreur lors de l'arrêt du périphérique virtuel:", error);
    }
}

// ==================== DIAGNOSTIC ====================

// Fonction de diagnostic complet
async function runFullDiagnostic() {
    console.log("=== DIAGNOSTIC AUDIO CENTER COMPLET ===");

    try {
        // 1. Vérifier les capacités du navigateur
        console.log("1. Vérification des capacités du navigateur:");
        console.log("- User Agent:", navigator.userAgent);
        console.log("- navigator.mediaDevices:", !!navigator.mediaDevices);
        console.log("- getUserMedia support:", !!navigator.mediaDevices?.getUserMedia);
        console.log("- AudioContext support:", !!window.AudioContext || !!window.webkitAudioContext);
        console.log("- MediaStreamAudioDestinationNode support:", !!window.MediaStreamAudioDestinationNode);
        console.log("- setSinkId support (HTMLAudioElement):", 'setSinkId' in HTMLAudioElement.prototype);
        console.log("- setSinkId support (AudioContext):", 'setSinkId' in AudioContext.prototype);
        console.log("- Périphérique virtuel injecté:", navigator.mediaDevices?.enumerateDevices?.toString().includes('virtual-audio-center') || false);

        // 2. Vérifier les permissions
        console.log("2. Vérification des permissions:");
        if (navigator.permissions) {
            try {
                const micPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
                console.log("- Permission microphone:", micPermission.state);
            } catch (error) {
                console.error("- Erreur permission microphone:", error);
            }
        }

        // 3. Lister les périphériques système
        console.log("3. Périphériques système:");
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                console.log("- Nombre total de périphériques:", devices.length);

                const audioInputs = devices.filter(d => d.kind === 'audioinput');
                const audioOutputs = devices.filter(d => d.kind === 'audiooutput');

                console.log("- Périphériques d'entrée audio:", audioInputs.length);
                audioInputs.forEach((device, index) => {
                    console.log(`  ${index}: ${device.label || 'Sans nom'} (${device.deviceId})`);
                });

                console.log("- Périphériques de sortie audio:", audioOutputs.length);
                audioOutputs.forEach((device, index) => {
                    console.log(`  ${index}: ${device.label || 'Sans nom'} (${device.deviceId})`);
                });
            } catch (error) {
                console.error("- Erreur lors de l'énumération des périphériques:", error);
            }
        }

        // 4. Vérifier Discord configModule
        console.log("4. Module de configuration Discord:");
        console.log("- configModule:", configModule);
        console.log("- getInputDevices disponible:", typeof configModule.getInputDevices);
        console.log("- getOutputDevices disponible:", typeof configModule.getOutputDevices);
        console.log("- getInputDeviceId disponible:", typeof configModule.getInputDeviceId);
        console.log("- getOutputDeviceId disponible:", typeof configModule.getOutputDeviceId);

        // 5. Test de création d'un contexte audio
        console.log("5. Test de création d'un contexte audio:");
        try {
            const testContext = new AudioContext();
            console.log("- Contexte audio créé avec succès");
            console.log("- État:", testContext.state);
            console.log("- Sample rate:", testContext.sampleRate);
            console.log("- Base latency:", testContext.baseLatency);

            const testDestination = testContext.createMediaStreamDestination();
            console.log("- Destination créée avec succès");
            console.log("- Stream:", testDestination.stream);
            console.log("- Tracks:", testDestination.stream.getAudioTracks());

            const testGain = testContext.createGain();
            console.log("- Nœud de gain créé avec succès");
            console.log("- Valeur de gain:", testGain.gain.value);

            testContext.close();
            console.log("- Contexte de test fermé");
        } catch (error) {
            console.error("- Erreur lors du test du contexte audio:", error);
        }

        // 6. Test d'accès aux périphériques
        console.log("6. Test d'accès aux périphériques:");
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                const testStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false
                    }
                });
                console.log("- Accès au microphone réussi");
                testStream.getTracks().forEach(track => track.stop());
            } catch (error) {
                console.log("- Permissions microphone non accordées (normal)");
            }
        }

        console.log("=== FIN DU DIAGNOSTIC ===");

        if (settings.store.showNotifications) {
            showNotification({
                title: "AudioCenter",
                body: "Diagnostic complet terminé - Vérifiez la console pour les détails"
            });
        }

    } catch (error) {
        console.error("Erreur lors du diagnostic:", error);
        if (settings.store.showNotifications) {
            showNotification({
                title: "AudioCenter - Erreur",
                body: "Erreur lors du diagnostic - Vérifiez la console"
            });
        }
    }
}

// ==================== COMPOSANTS REACT ====================

// Composant de sélection du périphérique principal
function PrimaryDeviceSelector() {
    const [devices, setDevices] = React.useState<any[]>([]);

    React.useEffect(() => {
        function loadDevices() {
            try {
                console.log("AudioCenter: Chargement des périphériques pour le sélecteur principal...");
                const inputDevices = getInputDevices();
                setDevices(inputDevices);
                console.log("AudioCenter: Périphériques chargés dans le sélecteur principal:", inputDevices.length);

                if (!selectedPrimaryDevice && inputDevices.length > 0) {
                    selectedPrimaryDevice = inputDevices[0].id;
                    console.log("AudioCenter: Périphérique principal par défaut défini:", selectedPrimaryDevice);
                }
            } catch (error) {
                console.error("AudioCenter: Erreur lors du chargement des périphériques:", error);
            }
        }

        loadDevices();
    }, []);

    return (
        <Select
            options={devices.map((device: any) => ({
                value: device.id,
                label: `🎤 ${device.name}`
            }))}
            serialize={identity}
            isSelected={value => value === selectedPrimaryDevice}
            select={id => {
                console.log("AudioCenter: Périphérique principal sélectionné:", id);
                selectedPrimaryDevice = id;
            }}
        />
    );
}

// Composant de sélection du périphérique secondaire
function SecondaryDeviceSelector() {
    const [devices, setDevices] = React.useState<any[]>([]);

    React.useEffect(() => {
        function loadDevices() {
            try {
                console.log("AudioCenter: Chargement des périphériques pour le sélecteur secondaire...");
                const inputDevices = getInputDevices();
                setDevices(inputDevices);
                console.log("AudioCenter: Périphériques chargés dans le sélecteur secondaire:", inputDevices.length);

                if (!selectedSecondaryDevice && inputDevices.length > 1) {
                    selectedSecondaryDevice = inputDevices[1].id;
                    console.log("AudioCenter: Périphérique secondaire par défaut défini:", selectedSecondaryDevice);
                }
            } catch (error) {
                console.error("AudioCenter: Erreur lors du chargement des périphériques:", error);
            }
        }

        loadDevices();
    }, []);

    return (
        <Select
            options={devices.map((device: any) => ({
                value: device.id,
                label: `🎵 ${device.name}`
            }))}
            serialize={identity}
            isSelected={value => value === selectedSecondaryDevice}
            select={id => {
                console.log("AudioCenter: Périphérique secondaire sélectionné:", id);
                selectedSecondaryDevice = id;
            }}
        />
    );
}

// Composant d'affichage du statut
function StatusDisplay() {
    const [mixerActive, setMixerActive] = React.useState(mixerState.isActive);
    const [virtualActive, setVirtualActive] = React.useState(virtualOutputDevice.isActive);

    React.useEffect(() => {
        const interval = setInterval(() => {
            setMixerActive(mixerState.isActive);
            setVirtualActive(virtualOutputDevice.isActive);
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{
            marginTop: "15px",
            padding: "15px",
            backgroundColor: "#2f3136",
            borderRadius: "4px",
            border: "1px solid #40444b"
        }}>
            <Forms.FormTitle>Statut des composants</Forms.FormTitle>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: mixerActive ? "#43b581" : "#ed4245"
                    }} />
                    <span style={{ fontSize: "12px", color: "#b9bbbe" }}>
                        Mixeur Audio
                    </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: virtualActive ? "#43b581" : "#ed4245"
                    }} />
                    <span style={{ fontSize: "12px", color: "#b9bbbe" }}>
                        Périphérique Virtuel
                    </span>
                </div>
            </div>
        </div>
    );
}

// ==================== PLUGIN PRINCIPAL ====================

export default definePlugin({
    name: "AudioCenter",
    description: "Centre audio complet : mixage, périphérique virtuel, limitation et diagnostic",
    authors: [{ name: "Bash", id: 1327483363518582784n }],
    settings,

    settingsAboutComponent: () => (
        <div>
            <h3>AudioCenter</h3>
            <p>Centre audio complet qui combine toutes les fonctionnalités audio en un seul plugin.</p>
            <p><strong>Fonctionnalités:</strong></p>
            <ul>
                <li>🎵 <strong>Mixeur Audio</strong> : Mixe deux sources audio en temps réel</li>
                <li>🔊 <strong>Périphérique Virtuel</strong> : Crée un périphérique de sortie virtuel</li>
                <li>🔍 <strong>Diagnostic</strong> : Outil de diagnostic intégré</li>
            </ul>
            <p><strong>Avantages:</strong></p>
            <ul>
                <li>Tout centralisé en un seul plugin</li>
                <li>Interface unifiée et intuitive</li>
                <li>Logs détaillés pour le débogage</li>
                <li>Compatible avec tous les périphériques audio</li>
            </ul>
        </div>
    ),

    settingsPanel: () => (
        <div style={{ padding: "20px" }}>
            <h2 style={{ marginBottom: "20px" }}>AudioCenter</h2>
            <p style={{ marginBottom: "20px", color: "#b9bbbe" }}>
                Centre audio complet qui combine mixage, périphérique virtuel et diagnostic.
                Toutes les fonctionnalités audio sont maintenant centralisées dans ce plugin.
            </p>

            <StatusDisplay />

            {/* Contrôles du mixeur */}
            <div style={{ marginTop: "20px" }}>
                <Forms.FormTitle>Contrôles du Mixeur</Forms.FormTitle>
                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                    <Button
                        onClick={startAudioMixing}
                        disabled={mixerState.isActive}
                        style={{
                            padding: "8px 16px",
                            backgroundColor: mixerState.isActive ? "#ccc" : "#5865f2",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: mixerState.isActive ? "not-allowed" : "pointer"
                        }}
                    >
                        Démarrer le mixage
                    </Button>

                    <Button
                        onClick={stopAudioMixing}
                        disabled={!mixerState.isActive}
                        style={{
                            padding: "8px 16px",
                            backgroundColor: !mixerState.isActive ? "#ccc" : "#ed4245",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: !mixerState.isActive ? "not-allowed" : "pointer"
                        }}
                    >
                        Arrêter le mixage
                    </Button>
                </div>
            </div>


            {/* Diagnostic */}
            <div style={{ marginTop: "20px" }}>
                <Forms.FormTitle>Diagnostic</Forms.FormTitle>
                <Button
                    onClick={runFullDiagnostic}
                    style={{
                        padding: "10px 20px",
                        backgroundColor: "#5865f2",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "14px",
                        marginTop: "10px"
                    }}
                >
                    Lancer le diagnostic complet
                </Button>
            </div>

            {/* Instructions */}
            <div style={{
                marginTop: "20px",
                padding: "15px",
                backgroundColor: "#2f3136",
                borderRadius: "4px",
                border: "1px solid #40444b"
            }}>
                <h3 style={{ marginBottom: "10px", color: "#ffffff" }}>Instructions:</h3>
                <ol style={{ color: "#b9bbbe", paddingLeft: "20px" }}>
                    <li>Sélectionnez vos périphériques d'entrée dans les paramètres ci-dessus</li>
                    <li>Ajustez les volumes selon vos besoins</li>
                    <li>Démarrez le mixage pour commencer</li>
                    <li>Utilisez le diagnostic en cas de problème</li>
                </ol>
            </div>
        </div>
    ),

    start() {
        console.log("AudioCenter: Plugin démarré");

        // Injecter le périphérique virtuel dans la liste des périphériques
        injectVirtualDevice();

        console.log("AudioCenter: Vérification des permissions audio...");

        // Vérifier les permissions
        if (navigator.permissions) {
            navigator.permissions.query({ name: 'microphone' as PermissionName }).then(result => {
                console.log("AudioCenter: Permission microphone:", result.state);
            }).catch(error => {
                console.error("AudioCenter: Erreur lors de la vérification des permissions microphone:", error);
            });
        }

        // Vérifier les capacités du navigateur
        console.log("AudioCenter: Capacités du navigateur:");
        console.log("- navigator.mediaDevices:", !!navigator.mediaDevices);
        console.log("- getUserMedia support:", !!navigator.mediaDevices?.getUserMedia);
        console.log("- AudioContext support:", !!window.AudioContext || !!window.webkitAudioContext);
        console.log("- MediaStreamAudioDestinationNode support:", !!window.MediaStreamAudioDestinationNode);

        // Lister les périphériques disponibles
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
            navigator.mediaDevices.enumerateDevices().then(devices => {
                console.log("AudioCenter: Périphériques système détectés:", devices.length);
                devices.forEach((device, index) => {
                    console.log(`AudioCenter: Périphérique système ${index}:`, {
                        deviceId: device.deviceId,
                        kind: device.kind,
                        label: device.label,
                        groupId: device.groupId
                    });
                });
            }).catch(error => {
                console.error("AudioCenter: Erreur lors de l'énumération des périphériques:", error);
            });
        }

    },

    stop() {
        stopAudioMixing();
        stopVirtualOutputDevice();
        console.log("AudioCenter: Plugin arrêté");
    }
});
