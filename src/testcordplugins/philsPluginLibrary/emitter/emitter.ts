/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import EventEmitter from "events";
import TypedEmitter from "typed-emitter";

export type TypedEmitterEvents<J extends TypedEmitter<any>> = J extends TypedEmitter<
    infer N
>
    ? N
    : never;

export interface EmitterEvent {
    emitter: TypedEmitter<any> | EventEmitter;
    event: any;
    fn: (...args: any[]) => any;
    plugin?: string;
}

export class Emitter {
    private static events: EmitterEvent[] = [];

    public static addListener<
        T extends TypedEmitter<any>,
        U extends keyof TypedEmitterEvents<T>,
        V extends TypedEmitterEvents<T>[U]
    >(
        emitter: T,
        type: keyof Pick<EventEmitter, "on" | "once">,
        event: U,
        fn: V,
        plugin?: string
    ): () => void;

    public static addListener(
        emitter: EventEmitter,
        type: keyof Pick<EventEmitter, "on" | "once">,
        event: string,
        fn: (...args: any[]) => void,
        plugin?: string
    ): () => void {
        emitter[type](event, fn);
        const emitterEvent: EmitterEvent = {
            emitter,
            event,
            fn,
            plugin: plugin
        };
        this.events.push(emitterEvent);

        return () => this.removeListener(emitterEvent);
    }

    private static isTypedEmitter(emitter: any): emitter is TypedEmitter<any> {
        return typeof emitter.off === "function";
    }

    public static removeListener(emitterEvent: EmitterEvent) {
        if (this.isTypedEmitter(emitterEvent.emitter)) {
            emitterEvent.emitter.off(emitterEvent.event, emitterEvent.fn);
        } else {
            (emitterEvent.emitter as EventEmitter).removeListener(emitterEvent.event, emitterEvent.fn);
        }
        this.events = this.events.filter(
            emitterEvent_ => emitterEvent_ !== emitterEvent
        );
    }

    public static removeAllListeners(plugin?: string) {
        if (!plugin) {
            this.events.forEach(emitterEvent =>
                this.removeListener(emitterEvent)
            );
        } else {
            this.events.forEach(emitterEvent =>
                plugin === emitterEvent.plugin && this.removeListener(emitterEvent)
            );
        }
    }
}
