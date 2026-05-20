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
Object.defineProperty(exports, "__esModule", { value: true });
exports.fixTsEarlyReturnTransformer = fixTsEarlyReturnTransformer;
const typescript_1 = __importStar(require("typescript"));
/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */
function fixTsEarlyReturnTransformer(context) {
    const { factory } = context;
    let patchSuccess = false;
    return (sourceFile) => {
        if (sourceFile.fileName !== 'src/typescript/typescript.ts')
            throw new Error('Wrong emitter file sent to transformer! This should be unreachable.');
        const res = factory.updateSourceFile(sourceFile, typescript_1.default.visitNodes(sourceFile.statements, visitNodes));
        if (!patchSuccess)
            throw new Error('Failed to patch typescript early return!');
        return res;
        function visitNodes(node) {
            if ((0, typescript_1.isReturnStatement)(node)) {
                patchSuccess = true;
                return factory.createVariableStatement(undefined, factory.createVariableDeclarationList([factory.createVariableDeclaration(factory.createIdentifier("returnResult"), undefined, undefined, node.expression)], typescript_1.default.NodeFlags.None));
            }
            return node;
        }
    };
}
// endregion
//# sourceMappingURL=fix-ts-early-return.js.map