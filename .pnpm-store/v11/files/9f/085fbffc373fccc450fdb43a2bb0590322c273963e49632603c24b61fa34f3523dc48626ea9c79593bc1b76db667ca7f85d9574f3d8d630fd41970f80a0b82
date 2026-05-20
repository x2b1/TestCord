"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hookTscExecTransformer = hookTscExecTransformer;
const typescript_1 = __importDefault(require("typescript"));
/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */
function hookTscExecTransformer(context) {
    const { factory } = context;
    let patchSuccess = false;
    return (sourceFile) => {
        if (sourceFile.fileName !== 'src/tsc/tsc.ts')
            throw new Error('Wrong emitter file sent to transformer! This should be unreachable.');
        const res = factory.updateSourceFile(sourceFile, typescript_1.default.visitNodes(sourceFile.statements, visitNodes));
        if (!patchSuccess)
            throw new Error('Failed to patch tsc exec statement early return!');
        return res;
        function visitNodes(node) {
            if (typescript_1.default.isExpressionStatement(node) && typescript_1.default.isCallExpression(node.expression) &&
                typescript_1.default.isIdentifier(node.expression.expression) && node.expression.expression.text === 'executeCommandLine') {
                patchSuccess = true;
                return factory.createExpressionStatement(factory.createBinaryExpression(factory.createPropertyAccessExpression(factory.createIdentifier("tsp"), factory.createIdentifier("execTsc")), factory.createToken(typescript_1.default.SyntaxKind.EqualsToken), factory.createArrowFunction(undefined, undefined, [], undefined, factory.createToken(typescript_1.default.SyntaxKind.EqualsGreaterThanToken), node.expression)));
            }
            return node;
        }
    };
}
// endregion
//# sourceMappingURL=hook-tsc-exec.js.map