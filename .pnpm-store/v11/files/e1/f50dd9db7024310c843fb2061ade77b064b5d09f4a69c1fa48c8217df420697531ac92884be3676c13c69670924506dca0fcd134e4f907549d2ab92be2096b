declare type Logger = {
    log: (...args: any[]) => void;
};
/**
 * An edge is a channel's understanding of another channel.
 *
 * `id` is the other channel,
 * `channelIds` is the set of channels that the other channel knows about
 */
export declare type ChannelEdge = {
    id: string;
    channelIds: string[];
};
export declare type ChannelMessageIn = {
    name: string;
    destination: string;
    data: any;
};
export declare type ChannelMessageOut = ChannelMessageIn & {
    source: string;
    proxiedBy?: string;
    nonce?: string;
};
/** A pipe is the communication layer between a channel and an edge. */
export declare type ChannelPipe = {
    emit: (event: string, data: any) => void;
    listen: (event: string, callback: (data: any) => void) => void;
};
/** A port essentially a broadcast network for pipes,
 * meaning that emissions from one pipe are sent to all other pipes.
 */
export declare class ChannelPort {
    _pipes: Map<string, ChannelPipe>;
    _listeners: Map<string, ReturnType<ChannelPort['_createListenerMap']>>;
    _createListenerMap(): Map<string, (...data: any[]) => void>;
    _emit(sourceName: string, event: string, ...data: any[]): void;
    createPipe(name: string): ChannelPipe;
    getPipe(name: string): ChannelPipe | null;
}
/** A channel is a node in a decentralized ipc network.
 * Each channel can talk to other channels through pipes,
 * and channels identify each other through handshakes.
 * The handshake will also let other channels know which channels
 * they can redirect messages to.
 * This implementation does **NOT** account for [ring topologies](https://en.wikipedia.org/wiki/Ring_network).
 **/
export declare class Channel {
    id: string;
    /** edge id -> edge */
    _edges: Map<string, ChannelEdge>;
    /** nonce -> callback */
    _callbacks: Map<string, (...data: any[]) => void>;
    /** message name -> caller */
    _callers: Map<string, (...data: any[]) => Promise<any>>;
    /** edge id -> pipe */
    _edgePipes: Map<string, ChannelPipe>;
    _pipes: ChannelPipe[];
    _emitter: import("eventemitter3")<string | symbol, any>;
    _logger?: Logger;
    _destroyed: boolean;
    constructor(id: string);
    addPipe(pipe: ChannelPipe): void;
    setLogger(logger: Logger): void;
    _handleHandshake(pipe: ChannelPipe, edge: ChannelEdge): void;
    _handleMessage(pipe: ChannelPipe, message: ChannelMessageOut): void;
    _emitHandshake(pipe: ChannelPipe): void;
    _emitMessage(message: ChannelMessageOut): void;
    getEdge(): ChannelEdge;
    findEdgeId(destinaton: string): string | null;
    waitForEdge(destination: string): Promise<string>;
    createNonce(): string;
    send(messageData: ChannelMessageIn): void;
    call(messageData: ChannelMessageIn, opts?: {
        timeout: number;
        signal?: AbortSignal;
    }): Promise<any>;
    on(name: string, fn: (...data: any) => void): this;
    off(name: string, fn?: (...data: any) => void): this;
    once(name: string, fn: (...data: any) => void): void;
    onCall(name: string, caller: (...data: any) => any): void;
    removeCaller(): void;
    handshakeAll(): void;
    destroy(): void;
}
export {};
