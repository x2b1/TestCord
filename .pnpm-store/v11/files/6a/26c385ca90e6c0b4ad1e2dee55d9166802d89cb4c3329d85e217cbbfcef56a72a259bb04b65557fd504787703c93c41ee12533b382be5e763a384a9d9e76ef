"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHash = getHash;
const crypto_1 = __importDefault(require("crypto"));
// endregion
/* ****************************************************************************************************************** */
// region: Crypto Utils
/* ****************************************************************************************************************** */
function getHash(fileContent) {
    return crypto_1.default.createHash('md5').update(fileContent).digest('hex');
}
// endregion
//# sourceMappingURL=general.js.map