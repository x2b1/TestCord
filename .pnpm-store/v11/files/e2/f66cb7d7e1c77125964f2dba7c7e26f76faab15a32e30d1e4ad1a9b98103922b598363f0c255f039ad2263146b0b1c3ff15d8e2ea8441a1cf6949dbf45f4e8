"use strict";
/**
 * @credit https://github.com/sindresorhus/find-cache-di
 * @license MIT
 * @author Sindre Sorhus
 * @author James Talmage
 *
 * MIT License
 *
 * Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
 * Copyright (c) James Talmage <james@talmage.io> (https://github.com/jamestalmage)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findCacheDirectory = findCacheDirectory;
const node_process_1 = __importDefault(require("node:process"));
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
// endregion
/* ****************************************************************************************************************** */
// region: Helpers
/* ****************************************************************************************************************** */
const isWritable = (path) => {
    try {
        node_fs_1.default.accessSync(path, node_fs_1.default.constants.W_OK);
        return true;
    }
    catch {
        return false;
    }
};
function useDirectory(directory, options) {
    if (options.create) {
        node_fs_1.default.mkdirSync(directory, { recursive: true });
    }
    return directory;
}
function getNodeModuleDirectory(directory) {
    const nodeModules = node_path_1.default.join(directory, 'node_modules');
    if (!isWritable(nodeModules)
        && (node_fs_1.default.existsSync(nodeModules) || !isWritable(node_path_1.default.join(directory)))) {
        return;
    }
    return nodeModules;
}
function findNearestPackageDir(startPath) {
    const visitedDirs = new Set();
    let currentPath = node_path_1.default.resolve(startPath);
    while (true) {
        const packageJsonPath = node_path_1.default.join(currentPath, 'package.json');
        if (node_fs_1.default.existsSync(packageJsonPath)) {
            return node_path_1.default.dirname(packageJsonPath);
        }
        // Mark the current directory as visited
        visitedDirs.add(currentPath);
        // Move to the parent directory
        const parentPath = node_path_1.default.dirname(currentPath);
        // Check for a circular loop
        if (visitedDirs.has(parentPath) || parentPath === currentPath) {
            return null;
        }
        currentPath = parentPath;
    }
}
// endregion
/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */
function findCacheDirectory(options) {
    /* Use ENV Cache Dir if present */
    if (node_process_1.default.env.CACHE_DIR && !['true', 'false', '1', '0'].includes(node_process_1.default.env.CACHE_DIR))
        return useDirectory(node_path_1.default.join(node_process_1.default.env.CACHE_DIR, options.name), options);
    /* Find Package Dir */
    const startDir = options.cwd || node_process_1.default.cwd();
    const pkgDir = findNearestPackageDir(startDir);
    if (!pkgDir)
        return undefined;
    /* Find Node Modules Dir */
    const nodeModules = getNodeModuleDirectory(pkgDir);
    if (!nodeModules)
        return undefined;
    return useDirectory(node_path_1.default.join(pkgDir, 'node_modules', '.cache', options.name), options);
}
// endregion
//# sourceMappingURL=find-cache-dir.js.map