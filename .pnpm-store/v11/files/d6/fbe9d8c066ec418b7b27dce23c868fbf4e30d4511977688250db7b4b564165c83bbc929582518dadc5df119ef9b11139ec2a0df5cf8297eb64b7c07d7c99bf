"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cliCommandsConfig = void 0;
exports.getCliCommand = getCliCommand;
const chalk_1 = __importDefault(require("chalk"));
/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */
/** @internal */
exports.cliCommandsConfig = {
    install: { short: 'i', caption: `Installs ts-patch (to main libraries)` },
    uninstall: { short: 'u', caption: 'Restores original typescript files' },
    check: {
        short: 'c', caption: `Check patch status (use with ${chalk_1.default.cyanBright('--dir')} to specify TS package location)`
    },
    patch: {
        short: void 0, paramCaption: '<module_file>', caption: 'Patch specific module(s) ' + chalk_1.default.yellow('(advanced)')
    },
    unpatch: {
        short: void 0, paramCaption: '<module_file>', caption: 'Un-patch specific module(s) ' + chalk_1.default.yellow('(advanced)')
    },
    'clear-cache': { caption: 'Clears cache and lock-files' },
    version: { short: 'v', caption: 'Show version' },
    help: { short: '/?', caption: 'Show help menu' },
};
// endregion
/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */
function getCliCommand(args) {
    let cmd = args._[0] ? args._[0].toLowerCase() : void 0;
    /* Handle special cases */
    if ((args.v) && (!cmd))
        return 'version';
    if (args.h)
        return 'help';
    if (!cmd)
        return cmd;
    /* Get long command */
    cmd = Object
        .entries(exports.cliCommandsConfig)
        .find(([long, { short }]) => long === cmd || short === cmd)?.[0];
    return cmd;
}
// endregion
//# sourceMappingURL=commands.js.map