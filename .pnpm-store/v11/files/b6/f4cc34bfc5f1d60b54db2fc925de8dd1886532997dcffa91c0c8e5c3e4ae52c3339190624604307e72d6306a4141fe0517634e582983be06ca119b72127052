"use strict";
/* ********************************************************************************************************************
 * Errors Classes
 * ********************************************************************************************************************/
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileWriteError = exports.BackupError = exports.RestoreError = exports.NPMError = exports.OptionsError = exports.PersistenceError = exports.PatchError = exports.PackageError = exports.FileNotFound = exports.WrongTSVersion = exports.TspError = void 0;
class TspError extends Error {
}
exports.TspError = TspError;
class WrongTSVersion extends TspError {
    constructor() {
        super(...arguments);
        this.name = 'WrongTSVersion';
    }
}
exports.WrongTSVersion = WrongTSVersion;
class FileNotFound extends TspError {
    constructor() {
        super(...arguments);
        this.name = 'FileNotFound';
    }
}
exports.FileNotFound = FileNotFound;
class PackageError extends TspError {
    constructor() {
        super(...arguments);
        this.name = 'PackageError';
    }
}
exports.PackageError = PackageError;
class PatchError extends TspError {
    constructor() {
        super(...arguments);
        this.name = 'PatchError';
    }
}
exports.PatchError = PatchError;
class PersistenceError extends TspError {
    constructor() {
        super(...arguments);
        this.name = 'PersistenceError';
    }
}
exports.PersistenceError = PersistenceError;
class OptionsError extends TspError {
    constructor() {
        super(...arguments);
        this.name = 'OptionsError';
    }
}
exports.OptionsError = OptionsError;
class NPMError extends TspError {
    constructor() {
        super(...arguments);
        this.name = 'NPMError';
    }
}
exports.NPMError = NPMError;
class RestoreError extends TspError {
    constructor(filename, message) {
        super(`Error restoring: ${filename}${message ? ' - ' + message : ''}`);
        this.filename = filename;
        this.name = 'RestoreError';
    }
}
exports.RestoreError = RestoreError;
class BackupError extends TspError {
    constructor(filename, message) {
        super(`Error backing up ${filename}${message ? ' - ' + message : ''}`);
        this.filename = filename;
        this.name = 'BackupError';
    }
}
exports.BackupError = BackupError;
class FileWriteError extends TspError {
    constructor(filename, message) {
        super(`Error while trying to write to ${filename}${message ? `: ${message}` : ''}`);
        this.filename = filename;
    }
}
exports.FileWriteError = FileWriteError;
//# sourceMappingURL=errors.js.map