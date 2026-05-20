import type { TsPackage } from '../ts-package';
import { ModuleSource } from './module-source';
import { ModuleFile } from './module-file';
export declare namespace TsModule {
    const names: readonly ["tsc.js", "tsserverlibrary.js", "typescript.js", "tsserver.js"];
    const contentFileMap: Record<string, string>;
    function getContentFileName(moduleName: typeof names[number]): string;
    function getContentFilePathForModulePath(modulePath: string): string;
}
export interface TsModule {
    package: TsPackage;
    majorVer: number;
    minorVer: number;
    isPatched: boolean;
    moduleName: TsModule.Name;
    modulePath: string;
    moduleContentFilePath: string;
    moduleFile: ModuleFile;
    dtsPath: string | undefined;
    cacheKey: string;
    backupCachePaths: {
        js: string;
        dts?: string;
    };
    patchedCachePaths: {
        js: string;
        dts?: string;
    };
    getUnpatchedModuleFile(): ModuleFile;
    getUnpatchedSource(): ModuleSource;
}
export declare namespace TsModule {
    type Name = (typeof names)[number] | string;
}
export interface GetTsModuleOptions {
    skipCache?: boolean;
}
export declare function getTsModule(tsPackage: TsPackage, moduleName: TsModule.Name, options?: GetTsModuleOptions): TsModule;
export declare function getTsModule(tsPackage: TsPackage, moduleFile: ModuleFile, options?: GetTsModuleOptions): TsModule;
