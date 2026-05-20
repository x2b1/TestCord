"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHelpMenu = getHelpMenu;
const chalk_1 = __importDefault(require("chalk"));
const strip_ansi_1 = __importDefault(require("strip-ansi"));
const commands_1 = require("./commands");
const options_1 = require("./options");
/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */
const LINE_INDENT = '\r\n\t';
const COL_WIDTH = 45;
// endregion
/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */
function getHelpMenu() {
    return LINE_INDENT + chalk_1.default.bold.blue('ts-patch [command] ') + chalk_1.default.blue('<options>') + '\r\n' + LINE_INDENT +
        // Commands
        Object
            .entries(commands_1.cliCommandsConfig)
            .map(([cmd, { short, caption, paramCaption }]) => formatLine([cmd, short], caption, paramCaption))
            .join(LINE_INDENT) +
        // Options
        '\r\n' + LINE_INDENT + chalk_1.default.bold('Options') + LINE_INDENT +
        Object
            .entries(options_1.cliOptionsConfig)
            .map(([long, { short, inverse, caption, paramCaption }]) => formatLine([
            short && `${chalk_1.default.cyanBright('-' + short)}`,
            long && `${chalk_1.default.cyanBright(`${inverse ? '--no-' : '--'}${long}`)}`
        ], caption, paramCaption))
            .join(LINE_INDENT);
    function formatLine(left, caption, paramCaption = '') {
        const leftCol = left.filter(Boolean).join(chalk_1.default.blue(', ')) + ' ' + chalk_1.default.yellow(paramCaption);
        const dots = chalk_1.default.grey('.'.repeat(COL_WIDTH - (0, strip_ansi_1.default)(leftCol).length));
        return `${leftCol} ${dots} ${caption}`;
    }
}
// endregion
//# sourceMappingURL=help-menu.js.map