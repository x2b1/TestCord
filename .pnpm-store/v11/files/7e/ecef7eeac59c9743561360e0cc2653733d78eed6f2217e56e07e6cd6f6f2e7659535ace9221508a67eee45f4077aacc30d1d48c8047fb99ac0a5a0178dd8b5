var tsp = (function () {
    "use strict";
    var tsp;
    (function (tsp) {
        const os = require("os");
        const path = require("path");
        const fs = require("fs");
        tsp.diagnosticMap = new WeakMap();
        tsp.supportedExtensions = [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"];
        tsp.tsExtensions = [".ts", ".mts", ".cts"];
        function diagnosticExtrasFactory(program) {
            const diagnostics = tsp.diagnosticMap.get(program) || tsp.diagnosticMap.set(program, []).get(program);
            const addDiagnostic = (diag) => diagnostics.push(diag);
            const removeDiagnostic = (index) => { diagnostics.splice(index, 1); };
            return { addDiagnostic, removeDiagnostic, diagnostics };
        }
        tsp.diagnosticExtrasFactory = diagnosticExtrasFactory;
        function getTmpDir(subPath) {
            const tmpDir = path.resolve(os.tmpdir(), "tsp", subPath);
            if (!fs.existsSync(tmpDir))
                fs.mkdirSync(tmpDir, { recursive: true });
            return tmpDir;
        }
        tsp.getTmpDir = getTmpDir;
        function getTsInstance() {
            return (typeof ts !== "undefined" ? ts : module.exports);
        }
        tsp.getTsInstance = getTsInstance;
        class TsPatchError extends Error {
            constructor(message, diagnostic) {
                super(message);
                this.diagnostic = diagnostic;
            }
        }
        tsp.TsPatchError = TsPatchError;
    })(tsp || (tsp = {}));
    var tsp;
    (function (tsp) {
        const Module = require("module");
        const path = require("path");
        const fs = require("fs");
        const crypto = require("crypto");
        function getEsmLibrary() {
            try {
                return require("esm");
            }
            catch (e) {
                if (e.code === "MODULE_NOT_FOUND")
                    throw new tsp.TsPatchError(`Plugin is an ESM module. To enable experimental ESM support, ` +
                        `install the 'esm' package as a (dev)-dependency or global.`);
                else
                    throw e;
            }
        }
        function registerEsmIntercept(registerConfig) {
            const originalRequire = Module.prototype.require;
            const builtFiles = new Map();
            const getHash = () => {
                let hash;
                do {
                    hash = crypto.randomBytes(16).toString("hex");
                } while (builtFiles.has(hash));
                return hash;
            };
            const cleanup = () => {
                for (const { 1: filePath } of builtFiles) {
                    delete require.cache[filePath];
                    try {
                        fs.rmSync(filePath, { force: true, maxRetries: 3 });
                    }
                    catch (e) {
                        if (process.env.NODE_ENV !== "production")
                            console.warn(`[ts-patch] Warning: Failed to delete temporary esm cache file: ${filePath}.`);
                    }
                }
                builtFiles.clear();
                Module.prototype.require = originalRequire;
            };
            try {
                Module.prototype.require = wrappedRequire;
            }
            catch (e) {
                cleanup();
            }
            function wrappedRequire(request) {
                try {
                    return originalRequire.apply(this, arguments);
                }
                catch (e) {
                    if (e.code === "ERR_REQUIRE_ESM") {
                        const resolvedPath = Module._resolveFilename(request, this, false);
                        const resolvedPathExt = path.extname(resolvedPath);
                        if (Module._cache[resolvedPath])
                            return Module._cache[resolvedPath].exports;
                        let targetFilePath;
                        if (tsp.tsExtensions.includes(resolvedPathExt)) {
                            if (!builtFiles.has(resolvedPath)) {
                                const tsCode = fs.readFileSync(resolvedPath, "utf8");
                                const newPath = resolvedPath.replace(/\.ts$/, ".mts");
                                const jsCode = registerConfig.tsNodeInstance.compile(tsCode, newPath);
                                const outputFileName = getHash() + ".mjs";
                                const outputFilePath = path.join(tsp.getTmpDir("esm"), outputFileName);
                                fs.writeFileSync(outputFilePath, jsCode, "utf8");
                                builtFiles.set(resolvedPath, outputFilePath);
                                targetFilePath = outputFilePath;
                            }
                            else {
                                targetFilePath = builtFiles.get(resolvedPath);
                            }
                        }
                        else {
                            targetFilePath = resolvedPath;
                        }
                        const newModule = new Module(request, this);
                        newModule.filename = resolvedPath;
                        newModule.paths = Module._nodeModulePaths(resolvedPath);
                        Module._cache[resolvedPath] = newModule;
                        const res = getEsmLibrary()(newModule)(targetFilePath);
                        newModule.filename = resolvedPath;
                        return res;
                    }
                    throw e;
                }
            }
            return cleanup;
        }
        tsp.registerEsmIntercept = registerEsmIntercept;
    })(tsp || (tsp = {}));
    var tsp;
    (function (tsp) {
        const crypto = require("crypto");
        function createTransformersFromPattern(opt) {
            const { factory, config, program, ls, registerConfig } = opt;
            const { transform, after, afterDeclarations, name, type, transformProgram, ...cleanConfig } = config;
            if (!transform)
                throw new tsp.TsPatchError("Not a valid config entry: \"transform\" key not found");
            const transformerKind = after ? "after" :
                afterDeclarations ? "afterDeclarations" :
                    "before";
            let pluginFactoryResult;
            switch (config.type) {
                case "ls":
                    if (!ls)
                        throw new tsp.TsPatchError(`Plugin ${transform} needs a LanguageService`);
                    pluginFactoryResult = factory(ls, cleanConfig);
                    break;
                case "config":
                    pluginFactoryResult = factory(cleanConfig);
                    break;
                case "compilerOptions":
                    pluginFactoryResult = factory(program.getCompilerOptions(), cleanConfig);
                    break;
                case "checker":
                    pluginFactoryResult = factory(program.getTypeChecker(), cleanConfig);
                    break;
                case undefined:
                case "program":
                    const { addDiagnostic, removeDiagnostic, diagnostics } = tsp.diagnosticExtrasFactory(program);
                    pluginFactoryResult = factory(program, cleanConfig, {
                        ts: tsp.getTsInstance(),
                        addDiagnostic,
                        removeDiagnostic,
                        diagnostics,
                        library: tsp.currentLibrary
                    });
                    break;
                case "raw":
                    pluginFactoryResult = (ctx) => factory(ctx, program, cleanConfig);
                    break;
                default:
                    throw new tsp.TsPatchError(`Invalid plugin type found in tsconfig.json: '${config.type}'`);
            }
            let transformerFactories;
            switch (typeof pluginFactoryResult) {
                case "function":
                    transformerFactories = [pluginFactoryResult];
                    break;
                case "object":
                    const factoryOrFactories = pluginFactoryResult[transformerKind];
                    if (typeof factoryOrFactories === "function") {
                        transformerFactories = [pluginFactoryResult[transformerKind]];
                        break;
                    }
                    else if (Array.isArray(factoryOrFactories)) {
                        transformerFactories = [...factoryOrFactories];
                        break;
                    }
                default:
                    throw new tsp.TsPatchError(`Invalid plugin result: expected a function or an object with a '${transformerKind}' property`);
            }
            const wrappedFactories = [];
            for (const transformerFactory of transformerFactories) {
                if (!transformerFactory || typeof transformerFactory !== "function")
                    throw new tsp.TsPatchError(`Invalid plugin entry point! Expected a transformer factory function or an object with a '${transformerKind}' property`);
                const wrapper = wrapTransformerFactory(transformerFactory, registerConfig, true);
                wrappedFactories.push(wrapper);
            }
            const res = {
                [transformerKind]: wrappedFactories
            };
            return res;
        }
        function wrapTransformerFactory(transformerFn, requireConfig, wrapInnerFunction) {
            const wrapper = function tspWrappedFactory(...args) {
                let res;
                try {
                    tsp.registerPlugin(requireConfig);
                    if (!wrapInnerFunction) {
                        res = transformerFn(...args);
                    }
                    else {
                        const resFn = transformerFn(...args);
                        if (typeof resFn !== "function")
                            throw new tsp.TsPatchError("Invalid plugin: expected a function");
                        res = wrapTransformerFactory(resFn, requireConfig, false);
                    }
                }
                finally {
                    tsp.unregisterPlugin();
                }
                return res;
            };
            return wrapper;
        }
        class PluginCreator {
            constructor(configs, options) {
                this.plugins = [];
                this.configs = configs;
                this.options = options;
                const { resolveBaseDir } = options;
                this.plugins = configs
                    .filter(config => config.transform !== undefined)
                    .map(config => new tsp.TspPlugin(config, { resolveBaseDir }));
                this.needsTscJsDocParsing = this.plugins.some(plugin => plugin.packageConfig?.tscOptions?.parseAllJsDoc === true);
            }
            mergeTransformers(into, source) {
                const slice = (input) => (Array.isArray(input) ? input.slice() : [input]);
                if (source.before)
                    into.before.push(...slice(source.before));
                if (source.after)
                    into.after.push(...slice(source.after));
                if (source.afterDeclarations)
                    into.afterDeclarations.push(...slice(source.afterDeclarations));
                return this;
            }
            createSourceTransformers(params, customTransformers) {
                const transformers = { before: [], after: [], afterDeclarations: [] };
                const [ls, program] = ("ls" in params) ? [params.ls, params.ls.getProgram()] : [void 0, params.program];
                for (const plugin of this.plugins) {
                    if (plugin.kind !== "SourceTransformer")
                        continue;
                    const { config } = plugin;
                    const createFactoryResult = plugin.createFactory();
                    if (!createFactoryResult)
                        continue;
                    const { factory, registerConfig } = createFactoryResult;
                    this.mergeTransformers(transformers, createTransformersFromPattern({
                        factory: factory,
                        registerConfig,
                        config,
                        program,
                        ls
                    }));
                }
                if (customTransformers)
                    this.mergeTransformers(transformers, customTransformers);
                return transformers;
            }
            createProgramTransformers() {
                const res = new Map();
                for (const plugin of this.plugins) {
                    if (plugin.kind !== "ProgramTransformer")
                        continue;
                    const { config } = plugin;
                    const createFactoryResult = plugin.createFactory();
                    if (createFactoryResult === undefined)
                        continue;
                    const { registerConfig, factory: unwrappedFactory } = createFactoryResult;
                    const factory = wrapTransformerFactory(unwrappedFactory, registerConfig, false);
                    const transformerKey = crypto
                        .createHash("md5")
                        .update(JSON.stringify({ factory, config }))
                        .digest("hex");
                    res.set(transformerKey, [factory, config]);
                }
                return res;
            }
        }
        tsp.PluginCreator = PluginCreator;
    })(tsp || (tsp = {}));
    var tsp;
    (function (tsp) {
        const path = require("path");
        const fs = require("fs");
        const requireStack = [];
        function getPackagePath(entryFilePath) {
            let currentDir = path.dirname(entryFilePath);
            const seenPaths = new Set();
            while (currentDir !== path.parse(currentDir).root) {
                if (seenPaths.has(currentDir))
                    return undefined;
                seenPaths.add(currentDir);
                const potentialPkgPath = path.join(currentDir, "package.json");
                if (fs.existsSync(potentialPkgPath))
                    return potentialPkgPath;
                currentDir = path.resolve(currentDir, "..");
            }
            return undefined;
        }
        class TspPlugin {
            constructor(config, createOptions) {
                this.config = { ...config };
                this.validateConfig();
                this._createOptions = createOptions;
                this.importKey = config.import || "default";
                this.kind = config.transformProgram === true ? "ProgramTransformer" : "SourceTransformer";
                const { resolveBaseDir } = createOptions;
                const configTransformValue = config.transform;
                this.tsConfigPath = config.tsConfig && path.resolve(resolveBaseDir, config.tsConfig);
                const entryFilePath = require.resolve(configTransformValue, { paths: [resolveBaseDir] });
                this.entryFilePath = entryFilePath;
                let pluginPackageConfig;
                const modulePackagePath = getPackagePath(entryFilePath);
                if (modulePackagePath) {
                    const modulePkgJsonContent = fs.readFileSync(modulePackagePath, "utf8");
                    const modulePkgJson = JSON.parse(modulePkgJsonContent);
                    pluginPackageConfig = modulePkgJson.tsp;
                    if (pluginPackageConfig === null || typeof pluginPackageConfig !== "object")
                        pluginPackageConfig = undefined;
                }
                this.packageConfig = pluginPackageConfig;
            }
            validateConfig() {
                const { config } = this;
                const configTransformValue = config.transform;
                if (!configTransformValue)
                    throw new tsp.TsPatchError(`Invalid plugin config: missing "transform" value`);
                if (config.resolvePathAliases && !config.tsConfig) {
                    console.warn(`[ts-patch] Warning: resolvePathAliases needs a tsConfig value pointing to a tsconfig.json for transformer" ${configTransformValue}.`);
                }
            }
            createFactory() {
                const { entryFilePath, config, tsConfigPath, importKey } = this;
                const configTransformValue = config.transform;
                if (requireStack.includes(entryFilePath))
                    return;
                requireStack.push(entryFilePath);
                let isEsm = config.isEsm;
                if (isEsm == null) {
                    const impliedModuleFormat = tsp.tsShim.getImpliedNodeFormatForFile(entryFilePath, undefined, tsp.tsShim.sys, { moduleResolution: tsp.tsShim.ModuleResolutionKind.Node16 });
                    isEsm = impliedModuleFormat === tsp.tsShim.ModuleKind.ESNext;
                }
                const isTs = configTransformValue.match(/\.[mc]?ts$/) != null;
                const registerConfig = {
                    isTs,
                    isEsm,
                    tsConfig: tsConfigPath,
                    pluginConfig: config
                };
                tsp.registerPlugin(registerConfig);
                try {
                    const commonjsModule = loadEntryFile();
                    const factoryModule = (typeof commonjsModule === "function") ? { default: commonjsModule } : commonjsModule;
                    const factory = factoryModule[importKey];
                    if (!factory)
                        throw new tsp.TsPatchError(`tsconfig.json > plugins: "${configTransformValue}" does not have an export "${importKey}": ` +
                            require("util").inspect(factoryModule));
                    if (typeof factory !== "function") {
                        throw new tsp.TsPatchError(`tsconfig.json > plugins: "${configTransformValue}" export "${importKey}" is not a plugin: ` +
                            require("util").inspect(factory));
                    }
                    return {
                        factory,
                        registerConfig: registerConfig
                    };
                }
                finally {
                    requireStack.pop();
                    tsp.unregisterPlugin();
                }
                function loadEntryFile() {
                    let res;
                    try {
                        res = require(entryFilePath);
                    }
                    catch (e) {
                        if (e.code === "ERR_REQUIRE_ESM") {
                            if (!registerConfig.isEsm) {
                                tsp.unregisterPlugin();
                                registerConfig.isEsm = true;
                                tsp.registerPlugin(registerConfig);
                                return loadEntryFile();
                            }
                            else {
                                throw new tsp.TsPatchError(`Cannot load ESM transformer "${configTransformValue}" from "${entryFilePath}". Please file a bug report`);
                            }
                        }
                        else
                            throw e;
                    }
                    return res;
                }
            }
        }
        tsp.TspPlugin = TspPlugin;
    })(tsp || (tsp = {}));
    var tsp;
    (function (tsp) {
        const path = require("path");
        let configStack = [];
        function getTsNode() {
            try {
                return require("ts-node");
            }
            catch (e) {
                if (e.code === "MODULE_NOT_FOUND")
                    throw new tsp.TsPatchError(`Cannot use a typescript-based transformer without ts-node installed. ` +
                        `Add ts-node as a (dev)-dependency or install globally.`);
                else
                    throw e;
            }
        }
        function getTsConfigPaths() {
            try {
                return require("tsconfig-paths");
            }
            catch (e) {
                if (e.code === "MODULE_NOT_FOUND")
                    throw new tsp.TsPatchError(`resolvePathAliases requires the library: tsconfig-paths. ` +
                        `Add tsconfig-paths as a (dev)-dependency or install globally.`);
                else
                    throw e;
            }
        }
        function getCompilerOptions(tsConfig) {
            const configFile = tsp.tsShim.readConfigFile(tsConfig, tsp.tsShim.sys.readFile);
            const parsedConfig = configFile && tsp.tsShim.parseJsonConfigFileContent(configFile.config, tsp.tsShim.sys, path.dirname(tsConfig));
            return parsedConfig.options;
        }
        function unregisterPlugin() {
            const activeRegisterConfig = configStack.pop();
            if (activeRegisterConfig.tsConfigPathsCleanup) {
                activeRegisterConfig.tsConfigPathsCleanup();
                delete activeRegisterConfig.tsConfigPathsCleanup;
            }
            if (activeRegisterConfig.tsNodeInstance) {
                activeRegisterConfig.tsNodeInstance.enabled(false);
            }
            if (activeRegisterConfig.esmInterceptCleanup) {
                activeRegisterConfig.esmInterceptCleanup();
                delete activeRegisterConfig.esmInterceptCleanup;
            }
        }
        tsp.unregisterPlugin = unregisterPlugin;
        function registerPlugin(registerConfig) {
            if (!registerConfig)
                throw new tsp.TsPatchError("requireConfig is required");
            configStack.push(registerConfig);
            const { isTs, isEsm, tsConfig, pluginConfig } = registerConfig;
            if (isEsm) {
                registerConfig.esmInterceptCleanup = tsp.registerEsmIntercept(registerConfig);
            }
            if (isTs) {
                const tsNode = getTsNode();
                let tsNodeInstance;
                if (registerConfig.tsNodeInstance) {
                    tsNodeInstance = registerConfig.tsNodeInstance;
                    tsNode.register(tsNodeInstance);
                }
                else {
                    tsNodeInstance = tsNode.register({
                        transpileOnly: true,
                        ...(tsConfig ? { project: tsConfig } : { skipProject: true }),
                        compilerOptions: {
                            target: isEsm ? "ESNext" : "ES2018",
                            jsx: "react",
                            esModuleInterop: true,
                            module: isEsm ? "ESNext" : "commonjs",
                        }
                    });
                }
                tsNodeInstance.enabled(true);
                registerConfig.tsNodeInstance = tsNodeInstance;
            }
            if (tsConfig && pluginConfig.resolvePathAliases) {
                registerConfig.compilerOptions ?? (registerConfig.compilerOptions = getCompilerOptions(tsConfig));
                const { paths, baseUrl } = registerConfig.compilerOptions;
                if (paths && baseUrl) {
                    registerConfig.tsConfigPathsCleanup = getTsConfigPaths().register({ baseUrl, paths });
                }
            }
        }
        tsp.registerPlugin = registerPlugin;
    })(tsp || (tsp = {}));
    var tsp;
    (function (tsp) {
        const activeProgramTransformers = new Set();
        const { dirname } = require("path");
        function getProjectDir(compilerOptions) {
            return compilerOptions.configFilePath && dirname(compilerOptions.configFilePath);
        }
        function getProjectConfig(compilerOptions, rootFileNames) {
            let configFilePath = compilerOptions.configFilePath;
            let projectDir = getProjectDir(compilerOptions);
            if (configFilePath === undefined) {
                const baseDir = (rootFileNames.length > 0) ? dirname(rootFileNames[0]) : projectDir ?? process.cwd();
                configFilePath = tsp.tsShim.findConfigFile(baseDir, tsp.tsShim.sys.fileExists);
                if (configFilePath) {
                    const config = readConfig(configFilePath);
                    compilerOptions = { ...config.options, ...compilerOptions };
                    projectDir = getProjectDir(compilerOptions);
                }
            }
            return ({ projectDir, compilerOptions });
        }
        function readConfig(configFileNamePath) {
            const projectDir = dirname(configFileNamePath);
            const result = tsp.tsShim.readConfigFile(configFileNamePath, tsp.tsShim.sys.readFile);
            if (result.error)
                throw new tsp.TsPatchError("Error in tsconfig.json: " + result.error.messageText);
            return tsp.tsShim.parseJsonConfigFileContent(result.config, tsp.tsShim.sys, projectDir, undefined, configFileNamePath);
        }
        function preparePluginsFromCompilerOptions(plugins) {
            if (!plugins)
                return [];
            if ((plugins.length === 1) && plugins[0].customTransformers) {
                const { before = [], after = [] } = plugins[0].customTransformers;
                return [
                    ...before.map((item) => ({ transform: item })),
                    ...after.map((item) => ({ transform: item, after: true })),
                ];
            }
            return plugins;
        }
        function createProgram(rootNamesOrOptions, options, host, oldProgram, configFileParsingDiagnostics) {
            let rootNames;
            const createOpts = !Array.isArray(rootNamesOrOptions) ? rootNamesOrOptions : void 0;
            if (createOpts) {
                rootNames = createOpts.rootNames;
                options = createOpts.options;
                host = createOpts.host;
                oldProgram = createOpts.oldProgram;
                configFileParsingDiagnostics = createOpts.configFileParsingDiagnostics;
            }
            else {
                options = options;
                rootNames = rootNamesOrOptions;
            }
            const projectConfig = getProjectConfig(options, rootNames);
            if (["tsc", "tsserver", "tsserverlibrary"].includes(tsp.currentLibrary)) {
                options = projectConfig.compilerOptions;
                if (createOpts)
                    createOpts.options = options;
            }
            const plugins = preparePluginsFromCompilerOptions(options.plugins);
            const pluginCreator = new tsp.PluginCreator(plugins, { resolveBaseDir: projectConfig.projectDir ?? process.cwd() });
            if (tsp.currentLibrary === "tsc" && tsp.tsShim.JSDocParsingMode && pluginCreator.needsTscJsDocParsing) {
                host.jsDocParsingMode = tsp.tsShim.JSDocParsingMode.ParseAll;
            }
            let program = createOpts ?
                tsp.tsShim.originalCreateProgram(createOpts) :
                tsp.tsShim.originalCreateProgram(rootNames, options, host, oldProgram, configFileParsingDiagnostics);
            const programTransformers = pluginCreator.createProgramTransformers();
            for (const [transformerKey, [programTransformer, config]] of programTransformers) {
                if (activeProgramTransformers.has(transformerKey))
                    continue;
                activeProgramTransformers.add(transformerKey);
                const newProgram = programTransformer(program, host, config, { ts: tsp.getTsInstance() });
                if (typeof newProgram?.["emit"] === "function")
                    program = newProgram;
                activeProgramTransformers.delete(transformerKey);
            }
            if (!program.originalEmit) {
                program.originalEmit = program.emit;
                program.emit = newEmit;
            }
            function newEmit(targetSourceFile, writeFile, cancellationToken, emitOnlyDtsFiles, customTransformers, ...additionalArgs) {
                const transformers = pluginCreator.createSourceTransformers({ program }, customTransformers);
                const result = program.originalEmit(targetSourceFile, writeFile, cancellationToken, emitOnlyDtsFiles, transformers, ...additionalArgs);
                for (const diagnostic of tsp.diagnosticMap.get(program) || [])
                    if (!result.diagnostics.includes(diagnostic))
                        result.diagnostics.push(diagnostic);
                return result;
            }
            return program;
        }
        tsp.createProgram = createProgram;
    })(tsp || (tsp = {}));
    var tsp;
    (function (tsp) {
        tsp.tsShim = new Proxy({}, {
            get(_, key) {
                const target = tsp.getTsInstance();
                if (target) {
                    return target[key];
                }
                else {
                    try {
                        return eval(key);
                    }
                    catch (e) {
                        throw new tsp.TsPatchError(`Failed to find "${key}" in TypeScript shim`, e);
                    }
                }
            },
        });
    })(tsp || (tsp = {}));
    return tsp;
})();
