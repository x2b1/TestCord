"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevel = void 0;
exports.createLogger = createLogger;
const chalk_1 = __importDefault(require("chalk"));
const strip_ansi_1 = __importDefault(require("strip-ansi"));
/* ****************************************************************************************************************** */
// region: Types
/* ****************************************************************************************************************** */
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["system"] = 0] = "system";
    LogLevel[LogLevel["normal"] = 1] = "normal";
    LogLevel[LogLevel["verbose"] = 2] = "verbose";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
// endregion
/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */
function createLogger(logLevel, useColour = true, isSilent = false) {
    return function log(msg, msgLogLevel = LogLevel.normal) {
        if (isSilent || msgLogLevel > logLevel)
            return;
        /* Handle Icon */
        const printIcon = (icon) => chalk_1.default.bold.cyanBright(`[${icon}] `);
        let icon = '';
        if (Array.isArray(msg)) {
            icon = msg[0];
            // @formatter:off
            msg = (icon === '!') ? printIcon(chalk_1.default.bold.yellow(icon)) + chalk_1.default.yellow(msg[1]) :
                (icon === '~') ? printIcon(chalk_1.default.bold.cyanBright(icon)) + msg[1] :
                    (icon === '=') ? printIcon(chalk_1.default.bold.greenBright(icon)) + msg[1] :
                        (icon === '+') ? printIcon(chalk_1.default.bold.green(icon)) + msg[1] :
                            (icon === '-') ? printIcon(chalk_1.default.bold.white(icon)) + msg[1] :
                                msg[1];
            // @formatter:on
        }
        /* Print message */
        const isError = (icon === '!');
        msg = !useColour ? (0, strip_ansi_1.default)(msg) : msg;
        (isError ? console.error : console.log)(msg);
    };
}
// endregion
//# sourceMappingURL=logger.js.map