"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mkdirIfNotExist = void 0;
exports.getGlobalTsDir = getGlobalTsDir;
exports.withFileLock = withFileLock;
exports.writeFileWithLock = writeFileWithLock;
exports.readFileWithLock = readFileWithLock;
exports.copyFileWithLock = copyFileWithLock;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const ts_package_1 = require("../ts-package");
const system_1 = require("../system");
const general_1 = require("./general");
/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */
const lockFileWaitMs = 2000;
// endregion
/* ****************************************************************************************************************** */
// region: Helpers
/* ****************************************************************************************************************** */
function waitForLockRelease(lockFilePath) {
    const start = Date.now();
    while (fs_1.default.existsSync(lockFilePath)) {
        sleep(100);
        if ((Date.now() - start) > lockFileWaitMs)
            throw new Error(`Could not acquire lock to write file. If problem persists, run ts-patch clear-cache and try again.
      `);
    }
    function sleep(ms) {
        const wakeUpTime = Date.now() + ms;
        while (Date.now() < wakeUpTime) { }
    }
}
// endregion
/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */
/**
 * Attempts to locate global installation of TypeScript
 */
function getGlobalTsDir() {
    const errors = [];
    const dir = require('global-prefix');
    const check = (dir) => {
        try {
            return (0, ts_package_1.getTsPackage)(dir);
        }
        catch (e) {
            errors.push(e);
            return {};
        }
    };
    const { packageDir } = (check(dir) || check(path_1.default.join(dir, 'lib')));
    if (!packageDir)
        throw new system_1.PackageError(`Could not find global TypeScript installation! Are you sure it's installed globally?`);
    return packageDir;
}
const mkdirIfNotExist = (dir) => !fs_1.default.existsSync(dir) && fs_1.default.mkdirSync(dir, { recursive: true });
exports.mkdirIfNotExist = mkdirIfNotExist;
function withFileLock(filePath, fn) {
    const lockFileName = (0, general_1.getHash)(filePath) + '.lock';
    const lockFilePath = (0, system_1.getLockFilePath)(lockFileName);
    try {
        const lockFileDir = path_1.default.dirname(lockFilePath);
        if (!fs_1.default.existsSync(lockFileDir))
            fs_1.default.mkdirSync(lockFileDir, { recursive: true });
        waitForLockRelease(lockFilePath);
        fs_1.default.writeFileSync(lockFilePath, '');
        return fn();
    }
    finally {
        if (fs_1.default.existsSync(lockFilePath))
            fs_1.default.rmSync(lockFilePath, { force: true });
    }
}
function writeFileWithLock(filePath, content) {
    withFileLock(filePath, () => {
        fs_1.default.writeFileSync(filePath, content);
    });
}
function readFileWithLock(filePath) {
    return withFileLock(filePath, () => {
        return fs_1.default.readFileSync(filePath, 'utf8');
    });
}
function copyFileWithLock(src, dest) {
    withFileLock(src, () => {
        withFileLock(dest, () => {
            fs_1.default.copyFileSync(src, dest);
        });
    });
}
// endregion
//# sourceMappingURL=file-utils.js.map