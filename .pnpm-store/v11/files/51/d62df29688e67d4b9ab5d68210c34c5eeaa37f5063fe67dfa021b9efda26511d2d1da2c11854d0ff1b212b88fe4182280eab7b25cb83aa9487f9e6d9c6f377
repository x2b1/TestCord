"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTsPackage = getTsPackage;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const resolve_1 = __importDefault(require("resolve"));
const system_1 = require("./system");
const module_1 = require("./module");
// endregion
/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */
/**
 * Get TypeScript package info - Resolve from dir, throws if not cannot find TS package
 */
function getTsPackage(dir = process.cwd()) {
    if (!fs_1.default.existsSync(dir))
        throw new system_1.PackageError(`${dir} is not a valid directory`);
    const possiblePackageDirs = [dir, () => path_1.default.dirname(resolve_1.default.sync(`typescript/package.json`, { basedir: dir }))];
    for (const d of possiblePackageDirs) {
        let packageDir;
        try {
            packageDir = typeof d === 'function' ? d() : d;
        }
        catch {
            break;
        }
        /* Parse package.json data */
        const packageFile = path_1.default.join(packageDir, 'package.json');
        if (!fs_1.default.existsSync(packageFile))
            continue;
        const { name, version } = (() => {
            try {
                return JSON.parse(fs_1.default.readFileSync(packageFile, 'utf8'));
            }
            catch (e) {
                throw new system_1.PackageError(`Could not parse json data in ${packageFile}`);
            }
        })();
        /* Validate */
        if (name === 'typescript') {
            const [sMajor, sMinor] = version.split('.');
            const libDir = path_1.default.join(packageDir, 'lib');
            const cacheDir = path_1.default.resolve(packageDir, '../.tsp/cache/');
            /* Get all available module names in libDir */
            const moduleNames = [];
            for (const fileName of fs_1.default.readdirSync(libDir))
                if (module_1.TsModule.names.includes(fileName))
                    moduleNames.push(fileName);
            const res = {
                version,
                majorVer: +sMajor,
                minorVer: +sMinor,
                packageFile,
                packageDir,
                moduleNames,
                cacheDir,
                libDir,
                moduleCache: new Map(),
                getModulePath: (moduleName) => {
                    return path_1.default.join(libDir, moduleName);
                }
            };
            return res;
        }
    }
    throw new system_1.PackageError(`Could not find typescript package from ${dir}`);
}
// endregion
//# sourceMappingURL=ts-package.js.map