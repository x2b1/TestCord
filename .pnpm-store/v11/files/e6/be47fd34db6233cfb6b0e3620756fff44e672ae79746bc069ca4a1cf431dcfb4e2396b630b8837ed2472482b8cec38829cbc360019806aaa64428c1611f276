"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cliOptionsConfig = void 0;
exports.getCliOptions = getCliOptions;
exports.getInstallerOptionsFromCliOptions = getInstallerOptionsFromCliOptions;
const system_1 = require("../system");
const options_1 = require("../options");
const utils_1 = require("../utils");
// endregion
/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */
/** @internal */
exports.cliOptionsConfig = {
    silent: { short: 's', caption: 'Run silently' },
    global: { short: 'g', caption: 'Target global TypeScript installation' },
    verbose: { short: 'v', caption: 'Chat it up' },
    cache: { inverse: true, caption: 'Skip cache' },
    dir: {
        short: 'd',
        paramCaption: '<dir>',
        caption: 'TypeScript directory or directory to resolve typescript package from'
    },
    color: { inverse: true, caption: 'Strip ansi colours from output' }
};
// endregion
/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */
function getCliOptions(args) {
    let res = {};
    for (const [key, { short }] of Object.entries(exports.cliOptionsConfig)) {
        if (args.hasOwnProperty(key) || (short && args.hasOwnProperty(short))) {
            res[key] = args.hasOwnProperty(key) ? args[key] : args[short];
        }
    }
    return res;
}
function getInstallerOptionsFromCliOptions(cliOptions) {
    let partialOptions = {};
    /* Dir option */
    if (cliOptions.global && cliOptions.dir)
        throw new system_1.OptionsError(`Cannot specify both --global and --dir`);
    if ('dir' in cliOptions)
        partialOptions.dir = cliOptions.dir;
    if ('global' in cliOptions)
        partialOptions.dir = (0, utils_1.getGlobalTsDir)();
    /* LogLevel option */
    if (cliOptions.silent && cliOptions.verbose)
        throw new system_1.OptionsError(`Cannot specify both --silent and --verbose`);
    if (cliOptions.silent) {
        partialOptions.logLevel = system_1.LogLevel.system;
        partialOptions.silent = true;
    }
    else if (cliOptions.verbose)
        partialOptions.logLevel = system_1.LogLevel.verbose;
    /* Color option */
    if (cliOptions.color)
        partialOptions.useColor = cliOptions.color;
    return (0, options_1.getInstallerOptions)(partialOptions);
}
// endregion
//# sourceMappingURL=options.js.map