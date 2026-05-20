declare namespace ts {
    interface PluginConfig {
        [x: string]: any;
        name?: string;
        transform?: string;
        resolvePathAliases?: boolean;
        tsConfig?: string;
        import?: string;
        isEsm?: boolean;
        type?: 'ls' | 'program' | 'config' | 'checker' | 'raw' | 'compilerOptions';
        after?: boolean;
        afterDeclarations?: boolean;
        transformProgram?: boolean;
    }
    type TransformerList = Required<ts.CustomTransformers>;
    type TransformerPlugin = TransformerBasePlugin | TsTransformerFactory;
    type TsTransformerFactory = ts.TransformerFactory<ts.SourceFile>;
    type PluginFactory = LSPattern | ProgramPattern | ConfigPattern | CompilerOptionsPattern | TypeCheckerPattern | RawPattern;
    interface TransformerBasePlugin {
        before?: ts.TransformerFactory<ts.SourceFile> | ts.TransformerFactory<ts.SourceFile>[];
        after?: ts.TransformerFactory<ts.SourceFile> | ts.TransformerFactory<ts.SourceFile>[];
        afterDeclarations?: ts.TransformerFactory<ts.SourceFile | ts.Bundle> | ts.TransformerFactory<ts.SourceFile | ts.Bundle>[];
    }
    type DiagnosticMap = WeakMap<ts.Program, ts.Diagnostic[]>;
    type TransformerExtras = {
        ts: typeof ts;
        library: string;
        addDiagnostic: (diag: ts.Diagnostic) => number;
        removeDiagnostic: (index: number) => void;
        diagnostics: readonly ts.Diagnostic[];
    };
    type ProgramTransformerExtras = {
        ts: typeof ts;
    };
    type ProgramTransformer = (program: ts.Program, host: ts.CompilerHost | undefined, config: PluginConfig, extras: ProgramTransformerExtras) => ts.Program;
    type LSPattern = (ls: ts.LanguageService, config: {}) => TransformerPlugin;
    type CompilerOptionsPattern = (compilerOpts: ts.CompilerOptions, config: {}) => TransformerPlugin;
    type ConfigPattern = (config: {}) => TransformerPlugin;
    type TypeCheckerPattern = (checker: ts.TypeChecker, config: {}) => TransformerPlugin;
    type ProgramPattern = (program: ts.Program, config: {}, extras: TransformerExtras) => TransformerPlugin;
    type RawPattern = (context: ts.TransformationContext, program: ts.Program, config: {}) => ts.Transformer<ts.SourceFile>;
    interface PluginPackageConfig {
        tscOptions?: {
            parseAllJsDoc?: boolean;
        };
    }
}
declare namespace ts {
    const originalCreateProgram: typeof ts.createProgram;
}
