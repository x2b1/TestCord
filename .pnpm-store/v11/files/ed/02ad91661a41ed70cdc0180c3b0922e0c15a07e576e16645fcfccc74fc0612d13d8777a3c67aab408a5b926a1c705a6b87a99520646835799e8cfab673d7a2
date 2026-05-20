import { Logger, LogLevel } from './system';
export interface InstallerOptions {
    logLevel: LogLevel;
    useColor: boolean;
    dir: string;
    silent: boolean;
    logger: Logger;
    skipCache: boolean;
}
export declare namespace InstallerOptions {
    function getDefaults(): {
        logLevel: LogLevel.normal;
        useColor: true;
        dir: string;
        silent: false;
        skipCache: false;
    };
}
export declare function getInstallerOptions(options?: Partial<InstallerOptions>): InstallerOptions;
