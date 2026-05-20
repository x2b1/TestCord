"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerClient = exports.createWorkerHost = void 0;
const channel_1 = require("./channel");
const rpc_1 = require("./rpc");
const createWorkerHost = (name, spec) => {
    const channel = new channel_1.Channel(name);
    channel.addPipe({
        emit: (event, data) => postMessage({ event, data }),
        listen: (event, callback) => addEventListener('message', ({ data }) => {
            if (data.event === event)
                callback(data.data);
        }),
    });
    return new rpc_1.RemoteHost(channel, spec);
};
exports.createWorkerHost = createWorkerHost;
class WorkerClient extends rpc_1.RemoteClient {
    workerOpts;
    worker;
    workerListeners = [];
    url;
    constructor(name, hostName, source, workerOpts = {}) {
        const channel = new channel_1.Channel(name);
        super(hostName, channel);
        this.workerOpts = workerOpts;
        if (source instanceof Blob) {
            const blob = new Blob([source], { type: 'text/javascript' });
            this.url = URL.createObjectURL(blob);
        }
        else
            this.url = source;
    }
    async init() {
        const worker = (this.worker = new Worker(this.url, this.workerOpts));
        this.channel.addPipe({
            emit: (event, data) => worker.postMessage({ event, data }),
            listen: (event, callback) => {
                const listener = (ev) => {
                    const { event: evName, data } = ev.data;
                    if (evName === event)
                        callback(data);
                };
                this.workerListeners.push(listener);
                worker.addEventListener('message', listener);
            },
        });
        await this.connect();
    }
    destroy() {
        if (this.worker) {
            for (const listener of this.workerListeners)
                this.worker.removeEventListener('message', listener);
            this.worker.terminate();
        }
        this.channel.destroy();
        if (this.url.startsWith('blob:'))
            URL.revokeObjectURL(this.url);
    }
}
exports.WorkerClient = WorkerClient;
