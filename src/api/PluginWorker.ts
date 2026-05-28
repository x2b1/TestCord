/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { Logger } from "@utils/Logger";

const logger = new Logger("PluginWorker", "#a6d189");

interface WorkerTask {
    id: number;
    resolve: (value: any) => void;
    reject: (reason: any) => void;
}

let taskCounter = 0;

function createInlineWorker(fn: Function): Worker {
    const fnStr = fn.toString();

    const workerCode = `
self.onmessage = async function(e) {
    const { id, args } = e.data;
    try {
        const fn = ${fnStr};
        const result = await fn.apply(null, args);
        self.postMessage({ id, result });
    } catch (error) {
        self.postMessage({ id, error: { message: error.message, stack: error.stack } });
    }
};`;

    const blob = new Blob([workerCode], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    return worker;
}

export class WorkerHandle {
    private worker: Worker | null = null;
    private tasks: Map<number, WorkerTask> = new Map();
    private _terminated = false;

    private constructor() { }

    static create(): WorkerHandle {
        const instance = new WorkerHandle();
        return instance;
    }

    init(fn: Function): void {
        if (this.worker) {
            this.worker.terminate();
            this.tasks.clear();
        }

        this.worker = createInlineWorker(fn);
        this._terminated = false;

        this.worker.onmessage = (e: MessageEvent) => {
            const { id, result, error } = e.data;
            const task = this.tasks.get(id);
            if (!task) return;

            this.tasks.delete(id);
            if (error) {
                const err = new Error(error.message);
                err.stack = error.stack;
                task.reject(err);
            } else {
                task.resolve(result);
            }
        };

        this.worker.onerror = (e: ErrorEvent) => {
            logger.error("Worker error:", e.message);
        };
    }

    post(...args: any[]): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.worker || this._terminated) {
                reject(new Error("Worker is not initialized or has been terminated"));
                return;
            }

            const id = ++taskCounter;
            this.tasks.set(id, { id, resolve, reject });
            this.worker.postMessage({ id, args });
        });
    }

    terminate(): void {
        if (this.worker) {
            this._terminated = true;
            this.worker.terminate();
            this.worker = null;
        }
        for (const task of this.tasks.values()) {
            task.reject(new Error("Worker was terminated"));
        }
        this.tasks.clear();
    }

    get isActive(): boolean {
        return this.worker !== null && !this._terminated;
    }
}

const defaultWorkerPool: WorkerHandle[] = [];
const POOL_SIZE = 2;

function getPoolWorker(index: number): WorkerHandle {
    if (!defaultWorkerPool[index]) {
        defaultWorkerPool[index] = WorkerHandle.create();
    }
    return defaultWorkerPool[index];
}

export function resetPool(): void {
    for (const w of defaultWorkerPool) {
        w.terminate();
    }
    defaultWorkerPool.length = 0;
}

export async function exec<T>(fn: (...args: any[]) => T, ...args: any[]): Promise<T> {
    const worker = getPoolWorker(0);
    worker.init(fn);
    try {
        return await worker.post(...args);
    } finally {
        worker.terminate();
    }
}

export async function execBatch<T>(fn: (...args: any[]) => T, items: any[][]): Promise<T[]> {
    const workers: WorkerHandle[] = [];
    const results: T[] = new Array(items.length);

    for (let i = 0; i < Math.min(items.length, POOL_SIZE); i++) {
        const w = WorkerHandle.create();
        w.init(fn);
        workers.push(w);
    }

    if (workers.length === 0) return results;

    let nextIndex = 0;
    const runNext = (workerIndex: number): Promise<void> => {
        if (nextIndex >= items.length) return Promise.resolve();
        const idx = nextIndex++;
        const worker = workers[workerIndex];
        return worker.post(...items[idx])
            .then(result => { results[idx] = result as T; })
            .catch(err => { results[idx] = err as T; })
            .then(() => runNext(workerIndex));
    };

    await Promise.all(workers.map((_, i) => runNext(i)));
    for (const w of workers) w.terminate();
    return results;
}

export type { WorkerHandle as PluginWorkerInstance };
