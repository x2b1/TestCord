"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.check = check;
const system_1 = require("../system");
const chalk_1 = __importDefault(require("chalk"));
const ts_package_1 = require("../ts-package");
const module_1 = require("../module");
const options_1 = require("../options");
function check(moduleNameOrNames, opts) {
    let targetModuleNames = moduleNameOrNames ? [moduleNameOrNames].flat() : undefined;
    const options = (0, options_1.getInstallerOptions)(opts);
    const { logger: log, dir } = options;
    /* Load Package */
    const tsPackage = (0, ts_package_1.getTsPackage)(dir);
    const { packageDir, version } = tsPackage;
    targetModuleNames ?? (targetModuleNames = tsPackage.moduleNames);
    /* Check Modules */
    log(`Checking TypeScript ${chalk_1.default.blueBright(`v${version}`)} installation in ${chalk_1.default.blueBright(packageDir)}\r\n`);
    let res = {};
    for (const moduleName of targetModuleNames) {
        /* Validate */
        if (!tsPackage.moduleNames.includes(moduleName))
            throw new system_1.PatchError(`${moduleName} is not a valid TypeScript module in ${packageDir}`);
        /* Report */
        const tsModule = (0, module_1.getTsModule)(tsPackage, moduleName, { skipCache: options.skipCache });
        const { patchDetail } = tsModule.moduleFile;
        if (patchDetail !== undefined) {
            const { isOutdated } = patchDetail;
            log(['+',
                `${chalk_1.default.blueBright(moduleName)} is patched with ts-patch version ` +
                    `${chalk_1.default[isOutdated ? 'redBright' : 'blueBright'](patchDetail.tspVersion)} ${isOutdated ? '(out of date)' : ''}`
            ]);
        }
        else
            log(['-', `${chalk_1.default.blueBright(moduleName)} is not patched.`]);
        res[moduleName] = patchDetail;
        log('', system_1.LogLevel.verbose);
    }
    return res;
}
// endregion
//# sourceMappingURL=check.js.map