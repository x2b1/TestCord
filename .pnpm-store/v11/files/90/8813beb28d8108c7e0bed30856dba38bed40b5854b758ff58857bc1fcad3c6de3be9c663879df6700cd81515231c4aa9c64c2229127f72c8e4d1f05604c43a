"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleSlice = void 0;
exports.sliceModule = sliceModule;
const semver_1 = __importDefault(require("semver"));
const ts54_1 = require("./ts54");
const ts55_1 = require("./ts55");
const ts552_1 = require("./ts552");
// endregion
/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */
function sliceModule(moduleFile, tsVersion) {
    const baseVersion = semver_1.default.coerce(tsVersion, { includePrerelease: false });
    if (!baseVersion)
        throw new Error(`Could not parse TS version: ${tsVersion}`);
    if (semver_1.default.lt(baseVersion, '5.0.0')) {
        throw new Error(`Cannot patch TS version <5`);
    }
    if (semver_1.default.lt(baseVersion, '5.5.0')) {
        return (0, ts54_1.sliceTs54)(moduleFile);
    }
    if (semver_1.default.lt(baseVersion, '5.5.2')) {
        return (0, ts55_1.sliceTs55)(moduleFile);
    }
    return (0, ts552_1.sliceTs552)(moduleFile);
}
/** @internal */
var ModuleSlice;
(function (ModuleSlice) {
    ModuleSlice.createError = (msg) => new Error(`Could not recognize TS format during slice!` + (msg ? ` — ${msg}` : ''));
})(ModuleSlice || (exports.ModuleSlice = ModuleSlice = {}));
// endregion
//# sourceMappingURL=module-slice.js.map