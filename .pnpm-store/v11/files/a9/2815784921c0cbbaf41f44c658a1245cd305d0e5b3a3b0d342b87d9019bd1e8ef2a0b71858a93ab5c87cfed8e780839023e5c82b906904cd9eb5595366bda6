"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchModule = patchModule;
const typescript_1 = __importDefault(require("typescript"));
const fs_1 = __importDefault(require("fs"));
const config_1 = require("../config");
const module_1 = require("../module");
const transformers_1 = require("./transformers");
const system_1 = require("../system");
const utils_1 = require("../utils");
const patch_detail_1 = require("./patch-detail");
/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */
const dtsPatchSrc = '\n' + fs_1.default.readFileSync(config_1.dtsPatchFilePath, 'utf-8');
const jsPatchSrc = fs_1.default.readFileSync(config_1.modulePatchFilePath, 'utf-8');
// endregion
/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */
function patchModule(tsModule, skipDts = false) {
    let shouldWrap = false;
    switch (tsModule.moduleName) {
        case 'tsc.js':
        case 'tsserver.js':
        case 'tsserverlibrary.js':
        case 'typescript.js':
            shouldWrap = true;
    }
    const source = tsModule.getUnpatchedSource();
    const { bodyWrapper } = source;
    const printableBodyFooters = [];
    const printableFooters = [];
    /* Splice in full compiler functionality (if not already present) */
    if (tsModule.moduleName !== 'typescript.js') {
        const typescriptModule = (0, module_1.getTsModule)(tsModule.package, 'typescript.js');
        const tsSource = typescriptModule.getUnpatchedSource();
        /* Merge Headers & Footer */
        mergeStatements(source.fileHeader, tsSource.fileHeader);
        source.bodyHeader = tsSource.bodyHeader;
        mergeStatements(source.fileFooter, tsSource.fileFooter);
        /* Replace body */
        for (let i = source.body.length - 1; i >= 0; i--) {
            const bodySection = source.body[i];
            if (tsSource.body.some(s => s.srcFileName === bodySection.srcFileName)) {
                source.body.splice(i, 1);
            }
        }
        source.body.unshift(...tsSource.body);
        /* Fix early return */
        // NOTE - This exists up until TS 5.4, but isn't there for 5.5+
        if (tsModule.majorVer <= 5 && tsModule.minorVer <= 4) {
            const typescriptSection = source.body.find(s => s.srcFileName === 'src/typescript/typescript.ts');
            if (!typescriptSection)
                throw new system_1.PatchError(`Could not find Typescript source section`);
            typescriptSection.transform([transformers_1.fixTsEarlyReturnTransformer]);
            printableBodyFooters.push(`return returnResult;`);
        }
    }
    /* Patch Program */
    const programSection = source.body.find(s => s.srcFileName === 'src/compiler/program.ts');
    if (!programSection)
        throw new system_1.PatchError(`Could not find Program source section`);
    programSection.transform([transformers_1.patchCreateProgramTransformer]);
    /* Add originalCreateProgram to exports */
    let createProgramAdded = false;
    for (const fileName of transformers_1.createProgramExportFiles) {
        // As of TS 5.5, we have to handle cases of multiple instances of the same file name. In this case, we need to
        // handle both src/typescript/typescript.ts
        const sections = source.body.filter(s => s.srcFileName === fileName);
        for (const section of sections) {
            try {
                section.transform([transformers_1.addOriginalCreateProgramTransformer]);
                createProgramAdded = true;
            }
            catch (e) {
                if (!(e instanceof system_1.PatchError))
                    throw e;
            }
        }
    }
    if (!createProgramAdded)
        throw new system_1.PatchError(`Could not find any of the createProgram export files`);
    /* Patch emitter (for diagnostics tools) */
    const emitterSection = source.body.find(s => s.srcFileName === 'src/compiler/watch.ts');
    if (!emitterSection)
        throw new system_1.PatchError(`Could not find Emitter source section`);
    emitterSection.transform([transformers_1.patchEmitterTransformer]);
    /* Move executeCommandLine outside of closure */
    if (tsModule.moduleName === 'tsc.js') {
        const tscSection = source.body.find(s => s.srcFileName === 'src/tsc/tsc.ts');
        if (!tscSection)
            throw new system_1.PatchError(`Could not find Tsc source section`);
        tscSection.transform([transformers_1.hookTscExecTransformer]);
        printableFooters.push(`tsp.${config_1.execTscCmd}();`);
    }
    /* Print the module */
    const printedJs = printModule();
    /* Get Dts */
    let dts;
    if (!skipDts && tsModule.dtsPath) {
        const dtsText = (0, utils_1.readFileWithLock)(tsModule.dtsPath);
        dts =
            dtsPatchSrc + '\n' +
                dtsText;
    }
    /* Get JS */
    const libraryName = tsModule.moduleName.replace(/\.js$/, '');
    const patchDetail = patch_detail_1.PatchDetail.fromModule(tsModule, printedJs);
    const js = patchDetail.toHeader() + '\n' +
        jsPatchSrc + '\n' +
        `tsp.currentLibrary = '${libraryName}';\n` +
        printedJs;
    return { dts, js };
    function getPrintList() {
        const list = [];
        let indentLevel = 0;
        /* File Header */
        list.push([source.fileHeader, indentLevel]);
        /* Body Wrapper Open */
        if (shouldWrap) {
            if (bodyWrapper)
                list.push([`\n${bodyWrapper.start}\n`, indentLevel]);
            indentLevel = 2;
        }
        /* Body Header*/
        list.push([source.bodyHeader, indentLevel]);
        /* Body */
        source.body.forEach(section => list.push([section, indentLevel]));
        /* Body Footers */
        printableBodyFooters.forEach(f => list.push([f, indentLevel]));
        /* Body Wrapper Close */
        if (shouldWrap) {
            indentLevel = 0;
            if (bodyWrapper)
                list.push([`\n${bodyWrapper.end}\n`, indentLevel]);
        }
        /* File Footer */
        list.push([source.fileFooter, indentLevel]);
        printableFooters.forEach(f => list.push([f, indentLevel]));
        return list;
    }
    function printModule() {
        const printer = typescript_1.default.createPrinter(config_1.defaultNodePrinterOptions);
        let outputStr = ``;
        for (const [item, indentLevel] of getPrintList()) {
            let printed;
            let addedIndent;
            if (item === undefined)
                continue;
            if (typeof item === 'string') {
                printed = item;
            }
            else {
                printed = item.print(printer);
                if (indentLevel && item.indentLevel < indentLevel) {
                    addedIndent = indentLevel - item.indentLevel;
                }
            }
            if (addedIndent)
                printed = printed.replace(/^/gm, ' '.repeat(addedIndent));
            outputStr += printed;
        }
        return outputStr;
    }
    function mergeStatements(baseSection, addedSection) {
        if (!baseSection || !addedSection) {
            if (addedSection)
                baseSection = addedSection;
            return;
        }
        const baseSourceFile = baseSection.getSourceFile();
        const addedSourceFile = addedSection.getSourceFile();
        const transformer = (0, transformers_1.createMergeStatementsTransformer)(baseSourceFile, addedSourceFile);
        baseSection.transform([transformer]);
    }
}
// endregion
//# sourceMappingURL=patch-module.js.map