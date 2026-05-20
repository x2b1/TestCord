"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchEmitterTransformer = patchEmitterTransformer;
const typescript_1 = __importDefault(require("typescript"));
/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */
function patchEmitterTransformer(context) {
    const { factory } = context;
    let patchSuccess = false;
    return (sourceFile) => {
        if (sourceFile.fileName !== 'src/compiler/watch.ts')
            throw new Error('Wrong emitter file sent to transformer! This should be unreachable.');
        const res = factory.updateSourceFile(sourceFile, typescript_1.default.visitNodes(sourceFile.statements, visitRootNodes));
        if (!patchSuccess)
            throw new Error('Failed to patch emitFilesAndReportErrors function!');
        return res;
        function visitRootNodes(node) {
            if (typescript_1.default.isFunctionDeclaration(node) && node.name && node.name.getText() === 'emitFilesAndReportErrors') {
                const newBodyStatements = typescript_1.default.visitNodes(node.body.statements, visitEmitterNodes);
                return factory.updateFunctionDeclaration(node, node.modifiers, node.asteriskToken, node.name, node.typeParameters, node.parameters, node.type, factory.updateBlock(node.body, newBodyStatements));
            }
            return node;
        }
        function visitEmitterNodes(node) {
            if (typescript_1.default.isVariableStatement(node) &&
                node.declarationList.declarations.some((declaration) => typescript_1.default.isVariableDeclaration(declaration) && declaration.name.getText() === 'emitResult')) {
                // tsp.diagnosticMap.set(program, allDiagnostics);
                const insertedMapSetterNode = factory.createExpressionStatement(factory.createCallExpression(factory.createPropertyAccessExpression(factory.createPropertyAccessExpression(factory.createIdentifier('tsp'), factory.createIdentifier('diagnosticMap')), factory.createIdentifier('set')), undefined, [
                    factory.createIdentifier('program'),
                    factory.createIdentifier('allDiagnostics')
                ]));
                patchSuccess = true;
                return [insertedMapSetterNode, node];
            }
            return node;
        }
    };
}
// endregion
//# sourceMappingURL=patch-emitter.js.map