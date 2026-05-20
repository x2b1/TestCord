import minimist from 'minimist';
import type { CliConfig } from './cli';
import { InstallerOptions } from "../options";
export interface CliOptions {
    silent: boolean;
    global: boolean;
    verbose: boolean;
    dir: string;
    color: boolean;
}
/** @internal */
export declare const cliOptionsConfig: CliConfig;
export declare function getCliOptions(args: minimist.ParsedArgs): CliOptions;
export declare function getInstallerOptionsFromCliOptions(cliOptions: CliOptions): InstallerOptions;
