"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPatchedSource = getPatchedSource;
const system_1 = require("../system");
const chalk_1 = __importDefault(require("chalk"));
const path_1 = __importDefault(require("path"));
const utils_1 = require("../utils");
const fs_1 = __importDefault(require("fs"));
const module_1 = require("../module");
const patch_module_1 = require("./patch-module");
// endregion
/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */
function getPatchedSource(tsModule, options) {
    const { backupCachePaths, patchedCachePaths } = tsModule;
    const { log, skipCache } = options || {};
    /* Write backup if not patched */
    if (!tsModule.isPatched) {
        for (const [key, backupPath] of Object.entries(backupCachePaths)) {
            const srcPath = key === 'dts' ? tsModule.dtsPath : tsModule.moduleContentFilePath;
            if (key === 'dts' && options?.skipDts)
                continue;
            if (!srcPath)
                continue;
            log?.(['~', `Writing backup cache to ${chalk_1.default.blueBright(backupPath)}`], system_1.LogLevel.verbose);
            const cacheDir = path_1.default.dirname(backupPath);
            (0, utils_1.mkdirIfNotExist)(cacheDir);
            (0, utils_1.copyFileWithLock)(srcPath, backupPath);
        }
    }
    /* Get Patched Module */
    const canUseCache = !skipCache
        && !tsModule.moduleFile.patchDetail?.isOutdated
        && (!patchedCachePaths.dts || fs_1.default.existsSync(patchedCachePaths.dts))
        && fs_1.default.existsSync(patchedCachePaths.js)
        && !(0, module_1.getModuleFile)(patchedCachePaths.js).patchDetail?.isOutdated;
    let js;
    let dts;
    if (canUseCache) {
        js = (0, utils_1.readFileWithLock)(patchedCachePaths.js);
        dts = !options?.skipDts && patchedCachePaths.dts ? (0, utils_1.readFileWithLock)(patchedCachePaths.dts) : undefined;
    }
    else {
        const res = (0, patch_module_1.patchModule)(tsModule, options?.skipDts);
        js = res.js;
        dts = res.dts;
        /* Write patched cache */
        if (!skipCache) {
            const cacheDir = path_1.default.dirname(patchedCachePaths.js);
            for (const [key, patchPath] of Object.entries(patchedCachePaths)) {
                const srcPath = key === 'dts' ? dts : js;
                if (key === 'dts' && options?.skipDts)
                    continue;
                if (!srcPath)
                    continue;
                log?.(['~', `Writing patched cache to ${chalk_1.default.blueBright(patchPath)}`], system_1.LogLevel.verbose);
                (0, utils_1.mkdirIfNotExist)(cacheDir);
                (0, utils_1.writeFileWithLock)(patchPath, srcPath);
            }
        }
    }
    return { js, dts, loadedFromCache: canUseCache };
}
// endregion
//# sourceMappingURL=get-patched-source.js.map