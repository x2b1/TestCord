"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSourceSection = createSourceSection;
const typescript_1 = __importDefault(require("typescript"));
const path_1 = __importDefault(require("path"));
// endregion
/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */
function createSourceSection(moduleFile, sectionName, startPos, endPos, indentLevel = 0, srcFileName) {
    let sourceText;
    let originalSourceFile;
    let sourceFile;
    let sourceFileName;
    return {
        hasTransformed: false,
        hasUpdatedSourceText: false,
        sectionName,
        srcFileName,
        indentLevel,
        pos: { start: startPos, end: endPos },
        get sourceText() {
            return sourceText ?? (sourceText = moduleFile.content.slice(startPos, endPos));
        },
        getSourceFile() {
            if (!sourceFile) {
                if (this.hasUpdatedSourceText)
                    return createSourceFile(this);
                else
                    return this.getOriginalSourceFile();
            }
            return sourceFile;
        },
        updateSourceText(newText) {
            sourceText = newText;
            sourceFile = undefined;
        },
        getOriginalSourceFile() {
            originalSourceFile ?? (originalSourceFile = createSourceFile(this));
            return originalSourceFile;
        },
        transform(transformers) {
            const result = typescript_1.default.transform(this.getSourceFile(), transformers);
            sourceFile = result.transformed[0];
            this.hasTransformed = true;
            this.indentLevel = 0;
        },
        print(printer) {
            if (!this.hasTransformed)
                return this.sourceText;
            printer ?? (printer = typescript_1.default.createPrinter());
            return printer.printFile(this.getSourceFile());
        }
    };
    function createSourceFile(sourceSection) {
        return typescript_1.default.createSourceFile(getSourceFileName(), sourceSection.sourceText, typescript_1.default.ScriptTarget.Latest, true, typescript_1.default.ScriptKind.JS);
    }
    function getSourceFileName() {
        if (!sourceFileName) {
            sourceFileName = srcFileName;
            if (!sourceFileName) {
                const baseName = path_1.default.basename(moduleFile.filePath, path_1.default.extname(moduleFile.filePath));
                sourceFileName = `${baseName}.${sectionName}.ts`;
            }
        }
        return sourceFileName;
    }
}
// endregion
//# sourceMappingURL=source-section.js.map