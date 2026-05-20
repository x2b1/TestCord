"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMergeStatementsTransformer = createMergeStatementsTransformer;
const typescript_1 = __importDefault(require("typescript"));
/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */
function createMergeStatementsTransformer(baseSourceFile, sourceFile) {
    const replacements = new Map();
    for (const node of sourceFile.statements) {
        if (typescript_1.default.isVariableStatement(node)) {
            const name = node.declarationList.declarations[0].name.text;
            replacements.set(name, node);
        }
        else if (typescript_1.default.isFunctionDeclaration(node) && node.name) {
            const name = node.name.text;
            replacements.set(name, node);
        }
    }
    return (context) => {
        const { factory } = context;
        return (node) => {
            if (node.fileName !== baseSourceFile.fileName)
                return node;
            const transformedStatements = [];
            node.statements.forEach((statement) => {
                if (typescript_1.default.isVariableStatement(statement)) {
                    const name = statement.declarationList.declarations[0].name.text;
                    if (replacements.has(name)) {
                        transformedStatements.push(replacements.get(name));
                        replacements.delete(name);
                    }
                    else {
                        transformedStatements.push(statement);
                    }
                }
                else if (typescript_1.default.isFunctionDeclaration(statement) && statement.name) {
                    const name = statement.name.text;
                    if (replacements.has(name)) {
                        transformedStatements.push(replacements.get(name));
                        replacements.delete(name);
                    }
                    else {
                        transformedStatements.push(statement);
                    }
                }
                else {
                    transformedStatements.push(statement);
                }
            });
            replacements.forEach((value) => transformedStatements.push(value));
            return factory.updateSourceFile(node, transformedStatements);
        };
    };
}
// endregion
//# sourceMappingURL=merge-statements.js.map