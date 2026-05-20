"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLiveModule = getLiveModule;
const path_1 = __importDefault(require("path"));
const ts_module_1 = require("./ts-module");
const ts_package_1 = require("../ts-package");
const get_patched_source_1 = require("../patch/get-patched-source");
/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */
function getLiveModule(moduleName) {
    const skipCache = process.env.TSP_SKIP_CACHE === 'true';
    const tsPath = process.env.TSP_COMPILER_TS_PATH ? path_1.default.resolve(process.env.TSP_COMPILER_TS_PATH) : require.resolve('typescript');
    /* Open the TypeScript module */
    const tsPackage = (0, ts_package_1.getTsPackage)(tsPath);
    const tsModule = (0, ts_module_1.getTsModule)(tsPackage, moduleName, { skipCache });
    /* Get patched version */
    const { js } = (0, get_patched_source_1.getPatchedSource)(tsModule, { skipCache, skipDts: true });
    return { js, tsModule };
}
// endregion
//# sourceMappingURL=get-live-module.js.map