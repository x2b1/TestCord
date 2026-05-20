"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.install = install;
const chalk_1 = __importDefault(require("chalk"));
const __1 = require("..");
const config_1 = require("../config");
/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */
/**
 * Patch TypeScript modules
 */
function install(opts) {
    const options = (0, __1.getInstallerOptions)(opts);
    const { logger: log } = options;
    const ret = (0, __1.patch)(config_1.defaultInstallLibraries, options);
    if (ret)
        log(['+', chalk_1.default.green(`ts-patch installed!`)]);
    return ret;
}
// endregion
//# sourceMappingURL=install.js.map