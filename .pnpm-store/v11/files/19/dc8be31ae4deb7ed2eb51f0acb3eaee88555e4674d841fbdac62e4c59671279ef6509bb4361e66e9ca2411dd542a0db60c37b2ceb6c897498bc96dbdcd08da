"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uninstall = uninstall;
const chalk_1 = __importDefault(require("chalk"));
const config_1 = require("../config");
const unpatch_1 = require("./unpatch");
const options_1 = require("../options");
/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */
/**
 * Remove patches from TypeScript modules
 */
function uninstall(opts) {
    const options = (0, options_1.getInstallerOptions)(opts);
    const { logger: log } = options;
    const ret = (0, unpatch_1.unpatch)(config_1.defaultInstallLibraries, opts);
    if (ret)
        log(['-', chalk_1.default.green(`ts-patch removed!`)]);
    return ret;
}
// endregion
//# sourceMappingURL=uninstall.js.map