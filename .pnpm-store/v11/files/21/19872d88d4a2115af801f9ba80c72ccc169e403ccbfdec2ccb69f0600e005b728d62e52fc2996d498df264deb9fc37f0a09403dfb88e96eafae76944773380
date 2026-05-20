"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModuleFile = getModuleFile;
const fs_1 = __importDefault(require("fs"));
const patch_detail_1 = require("../patch/patch-detail");
const path_1 = __importDefault(require("path"));
const utils_1 = require("../utils");
const ts_module_1 = require("./ts-module");
/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */
const SHORT_CHUNK_SIZE = 1024;
const LONG_CHUNK_SIZE = 64536;
// endregion
/* ****************************************************************************************************************** */
// region: Helpers
/* ****************************************************************************************************************** */
function readFile(filePath, headersOnly) {
    return (0, utils_1.withFileLock)(filePath, () => {
        let CHUNK_SIZE = headersOnly ? SHORT_CHUNK_SIZE : LONG_CHUNK_SIZE;
        let result = '';
        let doneReadingHeaders = false;
        let bytesRead;
        let buffer = Buffer.alloc(CHUNK_SIZE);
        const headerLines = [];
        let isLastHeaderIncomplete = false;
        const fd = fs_1.default.openSync(filePath, 'r');
        try {
            readFileLoop: while ((bytesRead = fs_1.default.readSync(fd, buffer, 0, CHUNK_SIZE, null)) > 0) {
                const chunkString = buffer.toString('utf-8', 0, bytesRead);
                /* Handle Header */
                if (!doneReadingHeaders) {
                    const lines = chunkString.split('\n');
                    lineLoop: for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        if (i === 0 && isLastHeaderIncomplete) {
                            headerLines[headerLines.length - 1] += line;
                        }
                        else {
                            if (line.startsWith('///')) {
                                headerLines.push(line);
                            }
                            else {
                                doneReadingHeaders = true;
                                if (!headersOnly) {
                                    result += lines.slice(i).join('\n');
                                    CHUNK_SIZE = LONG_CHUNK_SIZE;
                                    buffer = Buffer.alloc(CHUNK_SIZE);
                                    break lineLoop;
                                }
                                else {
                                    break readFileLoop;
                                }
                            }
                        }
                    }
                    if (!doneReadingHeaders)
                        isLastHeaderIncomplete = !chunkString.endsWith('\n');
                }
                else {
                    /* Handle content */
                    result += chunkString;
                }
            }
            return { headerLines, content: headersOnly ? undefined : result };
        }
        finally {
            fs_1.default.closeSync(fd);
        }
    });
}
// endregion
/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */
function getModuleFile(filePath, loadFullContent) {
    /* Determine shim redirect file - see: https://github.com/nonara/ts-patch/issues/174 */
    const moduleName = path_1.default.basename(filePath);
    const contentFilePath = ts_module_1.TsModule.getContentFilePathForModulePath(filePath);
    /* Get PatchDetail */
    let { headerLines, content } = readFile(contentFilePath, !loadFullContent);
    const patchDetail = patch_detail_1.PatchDetail.fromHeader(headerLines);
    return {
        moduleName,
        filePath,
        contentFilePath,
        patchDetail,
        get content() {
            if (content == null)
                content = readFile(this.contentFilePath, false).content;
            return content;
        },
        getHash() {
            return (0, utils_1.getHash)(this.content);
        }
    };
}
// endregion
//# sourceMappingURL=module-file.js.map