import { Logger } from '../system';
import { TsModule } from '../module';
export interface GetPatchedSourceOptions {
    log?: Logger;
    skipCache?: boolean;
    skipDts?: boolean;
}
export declare function getPatchedSource(tsModule: TsModule, options?: GetPatchedSourceOptions): {
    js: string;
    dts: string | undefined;
    loadedFromCache: boolean;
};
