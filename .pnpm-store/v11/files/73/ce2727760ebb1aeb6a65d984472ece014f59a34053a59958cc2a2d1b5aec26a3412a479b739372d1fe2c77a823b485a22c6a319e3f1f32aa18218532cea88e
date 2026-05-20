"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProgramExportFiles = void 0;
exports.addOriginalCreateProgramTransformer = addOriginalCreateProgramTransformer;
const typescript_1 = __importDefault(require("typescript"));
const system_1 = require("../../system");
/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */
exports.createProgramExportFiles = [
    /* TS < 5.4 */
    'src/typescript/_namespaces/ts.ts',
    /* TS >= 5.4 */
    'src/server/_namespaces/ts.ts',
    'src/typescript/typescript.ts'
];
// endregion
/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */
function addOriginalCreateProgramTransformer(context) {
    const { factory } = context;
    let patchSuccess = false;
    return (sourceFile) => {
        if (!exports.createProgramExportFiles.includes(sourceFile.fileName))
            throw new Error('Wrong emitter file sent to transformer! This should be unreachable.');
        const res = factory.updateSourceFile(sourceFile, typescript_1.default.visitNodes(sourceFile.statements, visitNodes));
        if (!patchSuccess)
            throw new system_1.PatchError('Failed to patch typescript originalCreateProgram!');
        return res;
        function visitNodes(node) {
            /* Handle: __export({ ... }) */
            if (typescript_1.default.isExpressionStatement(node) &&
                typescript_1.default.isCallExpression(node.expression) &&
                node.expression.expression.getText() === '__export') {
                const exportObjectLiteral = node.expression.arguments[1];
                if (typescript_1.default.isObjectLiteralExpression(exportObjectLiteral)) {
                    const originalCreateProgramProperty = factory.createPropertyAssignment('originalCreateProgram', factory.createArrowFunction(undefined, undefined, [], undefined, factory.createToken(typescript_1.default.SyntaxKind.EqualsGreaterThanToken), factory.createIdentifier('originalCreateProgram')));
                    const updatedExportObjectLiteral = factory.updateObjectLiteralExpression(exportObjectLiteral, [...exportObjectLiteral.properties, originalCreateProgramProperty]);
                    const updatedNode = factory.updateExpressionStatement(node, factory.updateCallExpression(node.expression, node.expression.expression, undefined, [node.expression.arguments[0], updatedExportObjectLiteral]));
                    patchSuccess = true;
                    return updatedNode;
                }
            }
            /* Handle: 1 && (module.exports = { ... }) (ts5.5+) */
            if (typescript_1.default.isExpressionStatement(node) && typescript_1.default.isBinaryExpression(node.expression) &&
                node.expression.operatorToken.kind === typescript_1.default.SyntaxKind.AmpersandAmpersandToken &&
                typescript_1.default.isParenthesizedExpression(node.expression.right) &&
                typescript_1.default.isBinaryExpression(node.expression.right.expression) &&
                node.expression.right.expression.operatorToken.kind === typescript_1.default.SyntaxKind.EqualsToken &&
                typescript_1.default.isPropertyAccessExpression(node.expression.right.expression.left) &&
                node.expression.right.expression.left.expression.getText() === 'module' &&
                node.expression.right.expression.left.name.getText() === 'exports' &&
                typescript_1.default.isObjectLiteralExpression(node.expression.right.expression.right)) {
                // Add originalCreateProgram to the object literal
                const originalCreateProgramProperty = factory.createShorthandPropertyAssignment('originalCreateProgram');
                const updatedObjectLiteral = factory.updateObjectLiteralExpression(node.expression.right.expression.right, [...node.expression.right.expression.right.properties, originalCreateProgramProperty]);
                // Update the node
                const updatedNode = factory.updateExpressionStatement(node, factory.updateBinaryExpression(node.expression, node.expression.left, node.expression.operatorToken, factory.updateParenthesizedExpression(node.expression.right, factory.updateBinaryExpression(node.expression.right.expression, node.expression.right.expression.left, node.expression.right.expression.operatorToken, updatedObjectLiteral))));
                patchSuccess = true;
                return updatedNode;
            }
            return node;
        }
    };
}
// endregion
//# sourceMappingURL=add-original-create-program.js.map