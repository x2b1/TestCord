"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockFileDir = exports.cachedFilePatchedPrefix = exports.execTscCmd = exports.dtsPatchFilePath = exports.modulePatchFilePath = exports.corePatchName = exports.defaultInstallLibraries = exports.defaultNodePrinterOptions = exports.RESOURCES_PATH = exports.tspPackageJSON = exports.appRoot = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const typescript_1 = __importDefault(require("typescript"));
/* ****************************************************************************************************************** */
// region: Library Config
/* ****************************************************************************************************************** */
/**
 * Root directory for ts-patch
 */
// TODO - This should be improved at some point
exports.appRoot = (() => {
    const moduleDir = __dirname;
    const chkFile = (pkgFile) => (fs_1.default.existsSync(pkgFile) && (require(pkgFile).name === 'ts-patch')) ? path_1.default.dirname(pkgFile) : void 0;
    const res = chkFile(path_1.default.join(moduleDir, 'package.json')) || chkFile(path_1.default.join(moduleDir, '../../../package.json'));
    if (!res)
        throw new Error(`Error getting app root. No valid ts-patch package file found in ` + moduleDir);
    return res;
})();
/**
 * Package json for ts-patch
 */
exports.tspPackageJSON = require(path_1.default.resolve(exports.appRoot, 'package.json'));
exports.RESOURCES_PATH = path_1.default.join(exports.appRoot, exports.tspPackageJSON.directories.resources);
exports.defaultNodePrinterOptions = {
    newLine: typescript_1.default.NewLineKind.LineFeed,
    removeComments: false
};
// endregion
/* ****************************************************************************************************************** */
// region: Patch Config
/* ****************************************************************************************************************** */
exports.defaultInstallLibraries = ['tsc.js', 'typescript.js'];
exports.corePatchName = `<core>`;
exports.modulePatchFilePath = path_1.default.resolve(exports.appRoot, exports.tspPackageJSON.directories.resources, 'module-patch.js');
exports.dtsPatchFilePath = path_1.default.resolve(exports.appRoot, exports.tspPackageJSON.directories.resources, 'module-patch.d.ts');
exports.execTscCmd = 'execTsc';
// endregion
/* ****************************************************************************************************************** */
// region: Cache Config
/* ****************************************************************************************************************** */
exports.cachedFilePatchedPrefix = 'patched.';
exports.lockFileDir = 'locks';
// endregion
//# sourceMappingURL=config.js.map