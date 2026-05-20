import { TsModule } from '../module';
export declare const tspHeaderBlockStart = "/// tsp-module:";
export declare const tspHeaderBlockStop = "/// :tsp-module";
export declare const currentPatchDetailVersion = "0.1.0";
export interface PatchDetail {
    tsVersion: string;
    tspVersion: string;
    patchDetailVersion: string;
    moduleName: TsModule.Name;
    originalHash: string;
    hash: string;
    patches: PatchDetail.PatchEntry[];
}
export declare namespace PatchDetail {
    interface PatchEntry {
        library: string;
        version: string;
        patchName?: string;
        hash?: string;
        blocksCache?: boolean;
    }
}
export declare class PatchDetail {
    get isOutdated(): boolean;
    toHeader(): string;
    static fromHeader(header: string | string[]): PatchDetail | undefined;
    static fromModule(tsModule: TsModule, patchedContent: string, patches?: PatchDetail.PatchEntry[]): PatchDetail & {
        tsVersion: string;
        tspVersion: any;
        patchDetailVersion: string;
        moduleName: string;
        originalHash: string;
        hash: string;
        patches: PatchDetail.PatchEntry[];
    };
}
