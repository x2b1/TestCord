/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Toasts } from "@webpack/common";

export default class ProgressDisplay {
    private message = "";
    private toastId: string;
    private dots = 0;
    private timer: ReturnType<typeof setInterval> | null = null;

    constructor(message: string) {
        this.toastId = Toasts.genId();
        this.setLoading(message);
    }

    private show(message: string) {
        Toasts.show({
            message,
            type: Toasts.Type.MESSAGE,
            id: this.toastId
        });
    }

    private formatLoading() {
        return `${this.message}${".".repeat(this.dots)}`;
    }

    private startDots() {
        if (this.timer) return;
        this.dots = 0;
        this.show(this.formatLoading());
        this.timer = setInterval(() => {
            this.dots = (this.dots + 1) % 4;
            this.show(this.formatLoading());
        }, 500);
    }

    private stopDots() {
        if (!this.timer) return;
        clearInterval(this.timer);
        this.timer = null;
        this.dots = 0;
    }

    setLoading(message: string) {
        this.message = message;
        this.startDots();
    }

    setStatus(message: string) {
        this.message = message;
        this.stopDots();
        this.show(message);
    }

    close() {
        this.stopDots();
    }
}
