# Installation
> `npm install --save @types/yazl`

# Summary
This package contains type definitions for yazl (https://github.com/thejoshwolfe/yazl).

# Details
Files were exported from https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/yazl.
## [index.d.ts](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/yazl/index.d.ts)
````ts
/// <reference types="node" />

import { Buffer } from "buffer";
import { EventEmitter } from "events";

export interface Options {
    mtime: Date;
    mode: number;
    compress: boolean;
    forceZip64Format: boolean;
    forceDosTimestamp: boolean;
    compressionLevel: number;
}

export interface FileOptions extends Options {
    fileComment: string;
}

export interface ReadStreamOptions extends FileOptions {
    size: number;
}

export interface DirectoryOptions {
    mtime: Date;
    mode: number;
    forceDosTimestamp: boolean;
}

export interface EndOptions {
    forceZip64Format: boolean;
    comment: string;
}

export interface DosDateTime {
    date: number;
    time: number;
}

export class ZipFile extends EventEmitter {
    addFile(realPath: string, metadataPath: string, options?: Partial<FileOptions>): void;
    outputStream: NodeJS.ReadableStream;
    addReadStream(input: NodeJS.ReadableStream, metadataPath: string, options?: Partial<ReadStreamOptions>): void;
    addReadStreamLazy(
        metadataPath: string,
        getReadStreamFunction: (cb: (err: any, readStream: NodeJS.ReadableStream) => void) => void,
    ): void;
    addReadStreamLazy(
        metadataPath: string,
        options: Partial<ReadStreamOptions>,
        getReadStreamFunction: (cb: (err: any, readStream: NodeJS.ReadableStream) => void) => void,
    ): void;
    addBuffer(buffer: Buffer, metadataPath: string, options?: Partial<Options>): void;
    end(options?: EndOptions, calculatedTotalSizeCallback?: () => void): void;

    addEmptyDirectory(metadataPath: string, options?: Partial<DirectoryOptions>): void;

    /**
     * @deprecated since yazl 3.3.0
     */
    dateToDosDateTime(jsDate: Date): DosDateTime;
}

````

### Additional Details
 * Last updated: Tue, 07 Apr 2026 22:11:24 GMT
 * Dependencies: [@types/node](https://npmjs.com/package/@types/node)

# Credits
These definitions were written by [taoqf](https://github.com/taoqf), and [Sean Marvi Oliver Genabe](https://github.com/seangenabe).
