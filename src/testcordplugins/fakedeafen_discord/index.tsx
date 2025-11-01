/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types"; // Função para registrar o plugin no Vencord
import { findByProps, findComponentByCodeLazy } from "@webpack"; // Helpers para buscar módulos internos
import { React } from "@webpack/common"; // React usado para criar componentes

let originalVoiceStateUpdate: any; // Guarda o método original de voiceStateUpdate
let fakeDeafenEnabled = false; // Flag que indica se o “fake deafen” está ativo

// Componente Button genérico obtido via busca de código
const Button = findComponentByCodeLazy(".NONE,disabled:", ".PANEL_BUTTON");

/** Ícone que muda de cor quando o fake deafen está ativado/desativado */
function FakeDeafenIcon() {
    return (
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            {/* Chapéu */}
            <rect x="6" y="8" width="20" height="4" rx="2" fill={fakeDeafenEnabled ? "#fff" : "#888"} />
            <rect x="11" y="3" width="10" height="8" rx="3" fill={fakeDeafenEnabled ? "#fff" : "#888"} />
            {/* Óculos */}
            <circle cx="10" cy="21" r="4" stroke={fakeDeafenEnabled ? "#fff" : "#888"} strokeWidth="2" fill="none" />
            <circle cx="22" cy="21" r="4" stroke={fakeDeafenEnabled ? "#fff" : "#888"} strokeWidth="2" fill="none" />
            {/* Ponte dos óculos */}
            <path d="M14 21c1 1 3 1 4 0" stroke={fakeDeafenEnabled ? "#fff" : "#888"} strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

/** Componente de botão que ativa/desativa o fake deafen */
function FakeDeafenButton() {
    return (
        <Button
            tooltipText={fakeDeafenEnabled ? "Disable Fake Deafen" : "Enable Fake Deafen"}
            icon={FakeDeafenIcon}
            role="switch"
            aria-checked={fakeDeafenEnabled}
            redGlow={fakeDeafenEnabled}
            onClick={() => {
                // Inverte o estado
                fakeDeafenEnabled = !fakeDeafenEnabled;

                // Obtém stores necessários
                const ChannelStore = findByProps("getChannel", "getDMFromUserId");
                const SelectedChannelStore = findByProps("getVoiceChannelId");
                const GatewayConnection = findByProps("voiceStateUpdate", "voiceServerPing");
                const MediaEngineStore = findByProps("isDeaf", "isMute");

                if (ChannelStore && SelectedChannelStore && GatewayConnection && typeof GatewayConnection.voiceStateUpdate === "function") {
                    const channelId = SelectedChannelStore.getVoiceChannelId?.();
                    const channel = channelId ? ChannelStore.getChannel?.(channelId) : null;

                    if (channel) {
                        if (fakeDeafenEnabled) {
                            // Ao ativar, força mute+deaf falsos
                            GatewayConnection.voiceStateUpdate({
                                channelId: channel.id,
                                guildId: channel.guild_id,
                                selfMute: true,
                                selfDeaf: true
                            });
                        } else {
                            // Ao desativar, restaura estado real do usuário
                            const selfMute = MediaEngineStore?.isMute?.() ?? false;
                            const selfDeaf = MediaEngineStore?.isDeaf?.() ?? false;
                            GatewayConnection.voiceStateUpdate({
                                channelId: channel.id,
                                guildId: channel.guild_id,
                                selfMute,
                                selfDeaf
                            });
                        }
                    }
                }
            }}
        />
    );
}

// Registro do plugin
export default definePlugin({
    name: "FakeDeafen",
    description: "Sahte sağırmı çok açıklamaya gerek yok aç ve dene.",
    authors: [Devs.feelslove],
    patches: [
        {
            // Injeta o botão na UI de “falando enquanto está mudo”
            find: "#{intl::ACCOUNT_SPEAKING_WHILE_MUTED}",
            replacement: {
                match: /className:\i\.buttons,.{0,50}children:\[/,
                replace: "$&$self.FakeDeafenButton(),"
            }
        }
    ],
    FakeDeafenButton, // Expõe o componente para patch
    start() {
        // Ao iniciar, sobrescreve voiceStateUpdate para sempre aplicar fakeDeafenEnabled
        const GatewayConnection = findByProps("voiceStateUpdate", "voiceServerPing");
        if (!GatewayConnection || typeof GatewayConnection.voiceStateUpdate !== "function") {
            console.warn("[FakeDeafen] GatewayConnection.voiceStateUpdate não encontrado");
        } else {
            originalVoiceStateUpdate = GatewayConnection.voiceStateUpdate;
            GatewayConnection.voiceStateUpdate = function (args) {
                if (fakeDeafenEnabled && args && typeof args === "object") {
                    args.selfMute = true;
                    args.selfDeaf = true;
                }
                return originalVoiceStateUpdate.apply(this, arguments);
            };
        }
    },
    stop() {
        // Ao parar, restaura o método original
        const GatewayConnection = findByProps("voiceStateUpdate", "voiceServerPing");
        if (GatewayConnection && originalVoiceStateUpdate) {
            GatewayConnection.voiceStateUpdate = originalVoiceStateUpdate;
        }
    }
});
