"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const minimist_1 = __importDefault(require("minimist"));
const system_1 = require("../system");
const ts_package_1 = require("../ts-package");
const chalk_1 = __importDefault(require("chalk"));
const actions = __importStar(require("../actions"));
const options_1 = require("./options");
const commands_1 = require("./commands");
const help_menu_1 = require("./help-menu");
const config_1 = require("../config");
const fs_1 = __importDefault(require("fs"));
// endregion
/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */
function run(opt) {
    /* Parse Input */
    const args = (0, minimist_1.default)(opt?.cmdArgs?.split(' ') ?? process.argv.slice(2));
    const cliOptions = (0, options_1.getCliOptions)(args);
    const cmd = (0, commands_1.getCliCommand)(args);
    /* Setup */
    const options = (0, options_1.getInstallerOptionsFromCliOptions)(cliOptions);
    const log = (0, system_1.createLogger)(options.logLevel, options.useColor, options.silent);
    try {
        /* Handle commands */
        (() => {
            switch (cmd) {
                case 'help':
                    return log((0, help_menu_1.getHelpMenu)(), system_1.LogLevel.system);
                case 'version':
                    const { version: tsVersion, packageDir } = (0, ts_package_1.getTsPackage)(options.dir);
                    return log('\r\n' +
                        chalk_1.default.bold.blue('ts-patch:    ') + config_1.tspPackageJSON.version + '\r\n' +
                        chalk_1.default.bold.blue('typescript:  ') + tsVersion + chalk_1.default.gray(`   [${packageDir}]`), system_1.LogLevel.system);
                case 'install':
                    return actions.install(options);
                case 'uninstall':
                    return actions.uninstall(options);
                case 'patch':
                    return actions.patch(args._.slice(1).join(' '), options);
                case 'unpatch':
                    return actions.unpatch(args._.slice(1).join(' '), options);
                case 'check':
                    return actions.check(undefined, options);
                case 'clear-cache':
                    const cacheRoot = (0, system_1.getCacheRoot)();
                    /* Clear dir */
                    fs_1.default.rmSync(cacheRoot, { recursive: true, force: true });
                    /* Recreate Dirs */
                    (0, system_1.getCacheRoot)();
                    (0, system_1.getLockFilePath)('');
                    return log(['+', 'Cleared cache & lock-files'], system_1.LogLevel.system);
                default:
                    log(['!', 'Invalid command. Try ts-patch /? for more info'], system_1.LogLevel.system);
            }
        })();
    }
    catch (e) {
        log([
            '!',
            chalk_1.default.bold.yellow(e.name && (e.name !== 'Error') ? `[${e.name}]: ` : 'Error: ') + chalk_1.default.red(e.message)
        ], system_1.LogLevel.system);
    }
    // Output for analysis by tests
    return ({ cmd, args, options });
}
// endregion
//# sourceMappingURL=cli.js.map