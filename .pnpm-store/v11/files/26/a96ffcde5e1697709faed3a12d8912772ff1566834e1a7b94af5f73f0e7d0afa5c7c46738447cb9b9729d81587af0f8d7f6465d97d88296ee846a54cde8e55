import ts from 'typescript';
import { ModuleFile } from './module-file';
export interface SourceSection {
    readonly sectionName: 'file-header' | 'body-header' | 'body' | 'file-footer';
    readonly srcFileName?: string;
    readonly pos: {
        start: number;
        end: number;
    };
    indentLevel: number;
    hasTransformed?: boolean;
    hasUpdatedSourceText?: boolean;
    get sourceText(): string;
    updateSourceText(newText: string): void;
    getSourceFile(): ts.SourceFile;
    getOriginalSourceFile(): ts.SourceFile;
    transform(transformers: ts.TransformerFactory<ts.SourceFile>[]): void;
    print(printer?: ts.Printer): string;
}
export declare function createSourceSection(moduleFile: ModuleFile, sectionName: SourceSection['sectionName'], startPos: number, endPos: number, indentLevel?: number, srcFileName?: string): SourceSection;
