"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TsModule = void 0;
exports.getTsModule = getTsModule;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const module_source_1 = require("./module-source");
const system_1 = require("../system");
const module_file_1 = require("./module-file");
const config_1 = require("../config");
/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */
var TsModule;
(function (TsModule) {
    TsModule.names = ['tsc.js', 'tsserverlibrary.js', 'typescript.js', 'tsserver.js'];
    TsModule.contentFileMap = {
        'tsc.js': '_tsc.js',
        'tsserver.js': '_tsserver.js'
    };
    function getContentFileName(moduleName) {
        return TsModule.contentFileMap[moduleName] || moduleName;
    }
    TsModule.getContentFileName = getContentFileName;
    /* Determine shim redirect file - see: https://github.com/nonara/ts-patch/issues/174 */
    function getContentFilePathForModulePath(modulePath) {
        const baseName = path_1.default.basename(modulePath);
        const redirectFile = TsModule.contentFileMap[baseName];
        const maybeModuleContentPath = redirectFile && path_1.default.join(path_1.default.dirname(modulePath), redirectFile);
        const moduleContentPath = maybeModuleContentPath && fs_1.default.existsSync(maybeModuleContentPath)
            ? maybeModuleContentPath
            : modulePath;
        return moduleContentPath;
    }
    TsModule.getContentFilePathForModulePath = getContentFilePathForModulePath;
})(TsModule || (exports.TsModule = TsModule = {}));
function getTsModule(tsPackage, moduleNameOrModuleFile, options) {
    const skipCache = options?.skipCache;
    /* Get Module File */
    let moduleFile;
    let moduleName;
    let modulePath;
    if (typeof moduleNameOrModuleFile === "object" && moduleNameOrModuleFile.content) {
        moduleFile = moduleNameOrModuleFile;
        moduleName = moduleFile.moduleName;
        modulePath = moduleFile.filePath;
    }
    else {
        moduleName = moduleNameOrModuleFile;
    }
    /* Handle Local Cache */
    if (!skipCache && tsPackage.moduleCache.has(moduleName))
        return tsPackage.moduleCache.get(moduleName);
    /* Load File (if not already) */
    if (!modulePath)
        modulePath = path_1.default.join(tsPackage.libDir, moduleName);
    if (!moduleFile)
        moduleFile = (0, module_file_1.getModuleFile)(modulePath);
    /* Get DTS if exists */
    const maybeDtsFile = modulePath.replace(/\.js$/, '.d.ts');
    const dtsPath = fs_1.default.existsSync(maybeDtsFile) ? maybeDtsFile : undefined;
    const dtsName = dtsPath && path_1.default.basename(dtsPath);
    /* Get Cache Paths */
    const cacheKey = moduleFile.patchDetail?.originalHash || moduleFile.getHash();
    const backupCachePaths = {
        js: (0, system_1.getCachePath)(cacheKey, moduleName),
        dts: dtsName && (0, system_1.getCachePath)(cacheKey, dtsName)
    };
    const patchedCachePaths = {
        js: (0, system_1.getCachePath)(cacheKey, config_1.cachedFilePatchedPrefix + moduleName),
        dts: dtsName && (0, system_1.getCachePath)(cacheKey, config_1.cachedFilePatchedPrefix + dtsName)
    };
    /* Create Module */
    const isPatched = !!moduleFile.patchDetail;
    let originalModuleFile;
    const tsModule = {
        package: tsPackage,
        majorVer: tsPackage.majorVer,
        minorVer: tsPackage.minorVer,
        isPatched,
        moduleName,
        modulePath,
        moduleFile,
        moduleContentFilePath: moduleFile.contentFilePath,
        dtsPath,
        cacheKey,
        backupCachePaths,
        patchedCachePaths,
        getUnpatchedSource() {
            return (0, module_source_1.getModuleSource)(this);
        },
        getUnpatchedModuleFile() {
            if (!originalModuleFile) {
                if (isPatched) {
                    if (!fs_1.default.existsSync(backupCachePaths.js))
                        throw new system_1.TspError(`Cannot find backup cache file for ${moduleName}. Please wipe node_modules and reinstall.`);
                    originalModuleFile = (0, module_file_1.getModuleFile)(backupCachePaths.js);
                }
                else {
                    originalModuleFile = isPatched ? (0, module_file_1.getModuleFile)(backupCachePaths.js) : moduleFile;
                }
            }
            return originalModuleFile;
        }
    };
    tsPackage.moduleCache.set(moduleName, tsModule);
    return tsModule;
}
// endregion
//# sourceMappingURL=ts-module.js.map