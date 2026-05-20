import { SourceSection } from './source-section';
import { TsModule } from './ts-module';
export interface ModuleSource {
    fileHeader: SourceSection;
    bodyHeader?: SourceSection;
    body: SourceSection[];
    fileFooter?: SourceSection;
    usesTsNamespace: boolean;
    getSections(): [sectionName: SourceSection['sectionName'], section: SourceSection | undefined][];
    bodyWrapper?: {
        start: string;
        end: string;
    };
}
export declare function getModuleSource(tsModule: TsModule): ModuleSource;
