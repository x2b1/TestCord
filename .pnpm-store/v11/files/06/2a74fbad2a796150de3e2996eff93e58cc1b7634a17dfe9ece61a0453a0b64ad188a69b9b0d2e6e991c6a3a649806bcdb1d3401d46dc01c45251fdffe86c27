"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unpatch = unpatch;
const system_1 = require("../system");
const chalk_1 = __importDefault(require("chalk"));
const path_1 = __importDefault(require("path"));
const ts_package_1 = require("../ts-package");
const module_1 = require("../module");
const fs_1 = __importDefault(require("fs"));
const options_1 = require("../options");
const utils_1 = require("../utils");
function unpatch(moduleNameOrNames, opts) {
    let res = false;
    const targetModuleNames = [moduleNameOrNames].flat();
    if (!targetModuleNames.length)
        throw new system_1.PatchError(`Must provide at least one module name to patch`);
    const options = (0, options_1.getInstallerOptions)(opts);
    const { logger: log, dir } = options;
    /* Load Package */
    const tsPackage = (0, ts_package_1.getTsPackage)(dir);
    /* Get modules to patch and patch info */
    const moduleFiles = targetModuleNames.map(m => [m, (0, module_1.getModuleFile)(tsPackage.getModulePath(m))]);
    /* Determine patched files */
    const unpatchableFiles = moduleFiles.filter(entry => {
        const [moduleName, moduleFile] = entry;
        if (moduleFile.patchDetail)
            return true;
        else {
            log(['!', `${chalk_1.default.blueBright(moduleName)} is not patched. For details, run: ` + chalk_1.default.bgBlackBright('ts-patch check')]);
            return false;
        }
    });
    /* Restore files */
    const errors = {};
    for (const entry of unpatchableFiles) {
        /* Load Module */
        const { 1: moduleFile } = entry;
        const tsModule = (0, module_1.getTsModule)(tsPackage, moduleFile, { skipCache: true });
        try {
            /* Get Backups */
            const backupPaths = [];
            backupPaths.push(tsModule.backupCachePaths.js);
            if (tsModule.backupCachePaths.dts)
                backupPaths.push(tsModule.backupCachePaths.dts);
            const baseNames = backupPaths.map(p => path_1.default.basename(p)).join(' & ');
            log([
                '~',
                `Restoring ${chalk_1.default.blueBright(baseNames)} in ${chalk_1.default.blueBright(path_1.default.dirname(tsPackage.libDir))}`
            ], system_1.LogLevel.verbose);
            /* Restore files */
            for (const backupPath of backupPaths) {
                if (!fs_1.default.existsSync(backupPath))
                    throw new Error(`Cannot find backup file: ${backupPath}. Try reinstalling typescript.`);
                const moduleDir = path_1.default.dirname(tsModule.modulePath);
                /* Determine destination path (Need to use moduleContentPath if we're working with a cached module file */
                const baseFileName = path_1.default.basename(backupPath);
                const destPathName = baseFileName === tsModule.moduleName
                    ? path_1.default.basename(tsModule.moduleContentFilePath)
                    : baseFileName;
                const destPath = path_1.default.join(moduleDir, destPathName);
                (0, utils_1.copyFileWithLock)(backupPath, destPath);
            }
            log(['+', chalk_1.default.green(`Successfully restored ${chalk_1.default.bold.yellow(baseNames)}.\r\n`)], system_1.LogLevel.verbose);
        }
        catch (e) {
            errors[tsModule.moduleName] = e;
        }
    }
    /* Handle errors */
    if (Object.keys(errors).length > 0) {
        Object.values(errors).forEach(e => {
            log(['!', e.message], system_1.LogLevel.verbose);
        });
        log('');
        throw new system_1.RestoreError(`[${Object.keys(errors).join(', ')}]`, 'Try reinstalling typescript.' +
            (options.logLevel < system_1.LogLevel.verbose ? ' (Or, run uninstall again with --verbose for specific error detail)' : ''));
    }
    else {
        res = true;
    }
    return res;
}
// endregion
//# sourceMappingURL=unpatch.js.map