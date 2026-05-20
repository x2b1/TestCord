"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.patch = patch;
const system_1 = require("../system");
const ts_package_1 = require("../ts-package");
const chalk_1 = __importDefault(require("chalk"));
const module_1 = require("../module");
const path_1 = __importDefault(require("path"));
const options_1 = require("../options");
const utils_1 = require("../utils");
const get_patched_source_1 = require("../patch/get-patched-source");
function patch(moduleNameOrNames, opts) {
    const targetModuleNames = [moduleNameOrNames].flat();
    if (!targetModuleNames.length)
        throw new system_1.PatchError(`Must provide at least one module name to patch`);
    const options = (0, options_1.getInstallerOptions)(opts);
    const { logger: log, dir, skipCache } = options;
    /* Load Package */
    const tsPackage = (0, ts_package_1.getTsPackage)(dir);
    /* Get modules to patch and patch info */
    const moduleFiles = targetModuleNames.map(m => [m, (0, module_1.getModuleFile)(tsPackage.getModulePath(m))]);
    /* Determine files not already patched or outdated  */
    const patchableFiles = moduleFiles.filter(entry => {
        const [moduleName, moduleFile] = entry;
        if (!moduleFile.patchDetail || moduleFile.patchDetail.isOutdated)
            return true;
        else {
            log(['!',
                `${chalk_1.default.blueBright(moduleName)} is already patched with the latest version. For details, run: ` +
                    chalk_1.default.bgBlackBright('ts-patch check')
            ]);
            return false;
        }
    });
    if (!patchableFiles.length)
        return true;
    /* Patch modules */
    const failedModulePaths = [];
    for (let entry of patchableFiles) {
        /* Load Module */
        const { 1: moduleFile } = entry;
        const tsModule = (0, module_1.getTsModule)(tsPackage, moduleFile, { skipCache: true });
        const { moduleName, modulePath, moduleContentFilePath } = tsModule;
        log(['~', `Patching ${chalk_1.default.blueBright(moduleName)} in ${chalk_1.default.blueBright(path_1.default.dirname(modulePath))}`], system_1.LogLevel.verbose);
        try {
            const { js, dts, loadedFromCache } = (0, get_patched_source_1.getPatchedSource)(tsModule, { skipCache, log });
            /* Write Patched Module */
            log([
                '~',
                `Writing patched ${chalk_1.default.blueBright(moduleName)} to ` +
                    `${chalk_1.default.blueBright(moduleContentFilePath)}${loadedFromCache ? ' (cached)' : ''}`
            ], system_1.LogLevel.verbose);
            (0, utils_1.writeFileWithLock)(moduleContentFilePath, js);
            if (dts)
                (0, utils_1.writeFileWithLock)(tsModule.dtsPath, dts);
            log(['+', chalk_1.default.green(`Successfully patched ${chalk_1.default.bold.yellow(moduleName)}.\r\n`)], system_1.LogLevel.verbose);
        }
        catch (e) {
            if (e instanceof system_1.TspError || options.logLevel >= system_1.LogLevel.verbose)
                log(['!', e.message]);
            failedModulePaths.push(tsModule.modulePath);
        }
    }
    if (failedModulePaths.length > 1) {
        log(['!',
            `Some files can't be patched! You can run again with --verbose to get specific error detail. The following files are unable to be ` +
                `patched:\n  - ${failedModulePaths.join('\n  - ')}`
        ]);
        return false;
    }
    return true;
}
// endregion
//# sourceMappingURL=patch.js.map