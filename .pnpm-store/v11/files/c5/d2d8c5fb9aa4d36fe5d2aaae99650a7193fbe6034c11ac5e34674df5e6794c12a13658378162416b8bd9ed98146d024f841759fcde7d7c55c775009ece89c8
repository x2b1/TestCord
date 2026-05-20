"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModuleSource = getModuleSource;
const source_section_1 = require("./source-section");
const module_slice_1 = require("../slice/module-slice");
// endregion
/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */
function getModuleSource(tsModule) {
    const moduleFile = tsModule.getUnpatchedModuleFile();
    const { firstSourceFileStart, fileEnd, wrapperPos, bodyPos, sourceFileStarts, bodyWrapper } = (0, module_slice_1.sliceModule)(moduleFile, tsModule.package.version);
    const fileHeaderEnd = wrapperPos?.start ?? firstSourceFileStart;
    return {
        fileHeader: (0, source_section_1.createSourceSection)(moduleFile, 'file-header', 0, fileHeaderEnd),
        bodyHeader: wrapperPos && (0, source_section_1.createSourceSection)(moduleFile, 'body-header', bodyPos.start, firstSourceFileStart, 2),
        body: sourceFileStarts.map(([srcFileName, startPos], i) => {
            const endPos = sourceFileStarts[i + 1]?.[1] ?? bodyPos?.end ?? fileEnd;
            return (0, source_section_1.createSourceSection)(moduleFile, 'body', startPos, endPos, wrapperPos != null ? 2 : 0, srcFileName);
        }),
        fileFooter: wrapperPos && (0, source_section_1.createSourceSection)(moduleFile, 'file-footer', wrapperPos.end, fileEnd),
        usesTsNamespace: wrapperPos != null,
        getSections() {
            return [
                ['file-header', this.fileHeader],
                ['body-header', this.bodyHeader],
                ...this.body.map((section, i) => [`body`, section]),
                ['file-footer', this.fileFooter],
            ];
        },
        bodyWrapper,
    };
}
// endregion
//# sourceMappingURL=module-source.js.map