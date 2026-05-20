"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatchDetail = exports.currentPatchDetailVersion = exports.tspHeaderBlockStop = exports.tspHeaderBlockStart = void 0;
const config_1 = require("../config");
const semver_1 = __importDefault(require("semver"));
const utils_1 = require("../utils");
/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */
exports.tspHeaderBlockStart = '/// tsp-module:';
exports.tspHeaderBlockStop = '/// :tsp-module';
exports.currentPatchDetailVersion = '0.1.0';
// endregion
/* ****************************************************************************************************************** */
// region: PatchDetail (class)
/* ****************************************************************************************************************** */
class PatchDetail {
    /* ********************************************************* */
    // region: Methods
    /* ********************************************************* */
    get isOutdated() {
        const packageVersion = config_1.tspPackageJSON.version;
        return semver_1.default.gt(packageVersion, this.tspVersion);
    }
    toHeader() {
        const lines = JSON.stringify(this, null, 2)
            .split('\n')
            .map(line => `/// ${line}`)
            .join('\n');
        return `${exports.tspHeaderBlockStart}\n${lines}\n${exports.tspHeaderBlockStop}`;
    }
    static fromHeader(header) {
        const headerLines = Array.isArray(header) ? header : header.split('\n');
        let patchDetail;
        const startIdx = headerLines.findIndex(line => line === exports.tspHeaderBlockStart) + 1;
        let endIdx = headerLines.findIndex(line => line === exports.tspHeaderBlockStop);
        if (endIdx === -1)
            headerLines.length;
        if (startIdx && endIdx) {
            const patchInfoStr = headerLines
                .slice(startIdx, endIdx)
                .map(line => line.replace('/// ', ''))
                .join('\n');
            patchDetail = Object.assign(new PatchDetail(), JSON.parse(patchInfoStr));
        }
        return patchDetail;
    }
    static fromModule(tsModule, patchedContent, patches = []) {
        patches.unshift({ library: 'ts-patch', patchName: config_1.corePatchName, version: config_1.tspPackageJSON.version });
        const patchDetail = {
            tsVersion: tsModule.package.version,
            tspVersion: config_1.tspPackageJSON.version,
            patchDetailVersion: exports.currentPatchDetailVersion,
            moduleName: tsModule.moduleName,
            originalHash: tsModule.cacheKey,
            hash: (0, utils_1.getHash)(patchedContent),
            patches: patches
        };
        return Object.assign(new PatchDetail(), patchDetail);
    }
}
exports.PatchDetail = PatchDetail;
// endregion
//# sourceMappingURL=patch-detail.js.map