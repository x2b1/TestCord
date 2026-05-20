import minimist from 'minimist';
export type CliConfig = Record<string, {
    short?: string;
    caption: string;
    paramCaption?: string;
    inverse?: boolean;
}>;
export declare function run(opt?: {
    cmdArgs?: string;
}): {
    cmd: string | undefined;
    args: minimist.ParsedArgs;
    options: import("..").InstallerOptions;
};
