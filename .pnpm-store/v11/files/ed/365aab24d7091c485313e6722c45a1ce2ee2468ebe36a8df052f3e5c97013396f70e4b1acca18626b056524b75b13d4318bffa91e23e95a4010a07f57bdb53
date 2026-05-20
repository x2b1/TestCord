import type { Channel } from './channel';
export declare type RemoteSpec = Record<string, (...input: any[]) => Promise<any>>;
/** An RPC host, can be connected to by multiple clients */
export declare class RemoteHost<RS extends RemoteSpec> {
    channel: Channel;
    constructor(channel: Channel, spec: RS);
}
export declare class RemoteClient<RS extends RemoteSpec> {
    hostName: string;
    channel: Channel;
    constructor(hostName: string, channel: Channel);
    connect(): Promise<void>;
    run<K extends keyof RS & string>(name: K, ...output: Parameters<RS[K]>): ReturnType<RS[K]>;
}
