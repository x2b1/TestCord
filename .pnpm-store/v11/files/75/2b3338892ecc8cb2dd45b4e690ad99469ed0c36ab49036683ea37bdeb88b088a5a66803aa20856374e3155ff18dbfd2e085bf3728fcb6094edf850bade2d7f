"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sliceTs552 = sliceTs552;
const module_slice_1 = require("./module-slice");
/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */
/**
 * Slice 5.5.2+
 */
function sliceTs552(moduleFile) {
    let firstSourceFileStart;
    let wrapperStart;
    let wrapperEnd;
    let bodyStart;
    let bodyEnd;
    let sourceFileStarts = [];
    const { content } = moduleFile;
    /* Find Wrapper or First File */
    let matcher = /^(?:\s*\/\/\s*src\/)|(?:var\s+ts\s*=.+)/gm;
    const firstMatch = matcher.exec(content);
    if (!firstMatch?.[0])
        throw module_slice_1.ModuleSlice.createError();
    let bodyWrapper = undefined;
    /* Handle wrapped */
    if (firstMatch[0].startsWith('var')) {
        wrapperStart = firstMatch.index;
        bodyStart = firstMatch.index + firstMatch[0].length + 1;
        /* Find First File */
        matcher = /^\s*\/\/\s*src\//gm;
        matcher.lastIndex = wrapperStart;
        const firstFileMatch = matcher.exec(content);
        if (!firstFileMatch?.[0])
            throw module_slice_1.ModuleSlice.createError();
        firstSourceFileStart = firstFileMatch.index;
        /* Find Wrapper end */
        // TODO - We may later want to find a better approach, but this will work for now
        matcher = /^}\)\({ get exports\(\) { return ts; }.+$/gm;
        matcher.lastIndex = firstFileMatch.index;
        const wrapperEndMatch = matcher.exec(content);
        if (!wrapperEndMatch?.[0])
            throw module_slice_1.ModuleSlice.createError();
        bodyEnd = wrapperEndMatch.index - 1;
        wrapperEnd = wrapperEndMatch.index + wrapperEndMatch[0].length;
        bodyWrapper = { start: firstMatch[0], end: wrapperEndMatch[0] };
    }
    /* Handle non-wrapped */
    else {
        firstSourceFileStart = firstMatch.index;
        bodyStart = firstMatch.index + firstMatch[0].length;
        bodyEnd = content.length;
    }
    /* Get Source File Positions */
    matcher = /^\s*\/\/\s*(src\/.+)$/gm;
    matcher.lastIndex = firstSourceFileStart;
    for (let match = matcher.exec(content); match != null; match = matcher.exec(content)) {
        sourceFileStarts.push([match[1], match.index]);
    }
    return {
        moduleFile,
        firstSourceFileStart,
        wrapperPos: wrapperStart != null ? { start: wrapperStart, end: wrapperEnd } : undefined,
        fileEnd: content.length,
        bodyPos: { start: bodyStart, end: bodyEnd },
        sourceFileStarts,
        bodyWrapper
    };
}
// endregion
//# sourceMappingURL=ts552.js.map