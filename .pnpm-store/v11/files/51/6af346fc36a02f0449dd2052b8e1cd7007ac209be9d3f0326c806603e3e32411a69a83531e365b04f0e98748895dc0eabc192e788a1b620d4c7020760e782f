"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoteClient = exports.RemoteHost = void 0;
/** An RPC host, can be connected to by multiple clients */
class RemoteHost {
    channel;
    constructor(channel, spec) {
        this.channel = channel;
        for (const [name, fn] of Object.entries(spec)) {
            channel.onCall(name, async (input) => {
                const result = await fn(...input);
                return result;
            });
        }
        channel.handshakeAll();
    }
}
exports.RemoteHost = RemoteHost;
class RemoteClient {
    hostName;
    channel;
    constructor(hostName, channel) {
        this.hostName = hostName;
        this.channel = channel;
    }
    async connect() {
        await this.channel.waitForEdge(this.hostName);
    }
    run(name, ...output) {
        return this.channel.call({
            name,
            destination: this.hostName,
            data: output,
        });
    }
}
exports.RemoteClient = RemoteClient;
