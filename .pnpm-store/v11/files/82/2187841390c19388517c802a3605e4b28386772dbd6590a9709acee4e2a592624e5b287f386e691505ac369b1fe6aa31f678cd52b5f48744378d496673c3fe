import { TsModule } from './module';
export interface TsPackage {
    majorVer: number;
    minorVer: number;
    version: string;
    packageFile: string;
    packageDir: string;
    cacheDir: string;
    libDir: string;
    moduleNames: TsModule.Name[];
    /** @internal */
    moduleCache: Map<TsModule.Name, TsModule>;
    getModulePath: (name: TsModule.Name) => string;
}
/**
 * Get TypeScript package info - Resolve from dir, throws if not cannot find TS package
 */
export declare function getTsPackage(dir?: string): TsPackage;
