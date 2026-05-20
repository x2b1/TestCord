import { RemoteSpec, RemoteClient, RemoteHost } from './rpc';
export declare const createWorkerHost: <RS extends RemoteSpec>(name: string, spec: RS) => RemoteHost<RS>;
export declare class WorkerClient<RS extends RemoteSpec> extends RemoteClient<RS> {
    workerOpts: WorkerOptions;
    worker?: Worker;
    workerListeners: EventListener[];
    url: string;
    constructor(name: string, hostName: string, source: string | Blob, workerOpts?: WorkerOptions);
    init(): Promise<void>;
    destroy(): void;
}
