
export function getMemory() {
    const memory = process.memoryUsage();
    return {
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal
    };
}
