"use strict";
/*!
 * virtual-merge
 * Copyright (c) 2023 Vendicated
 * SPDX-License-Identifier: MIT
 */
Object.defineProperty(exports, "__esModule", { value: true });
function virtualMerge(...objects) {
    const fallback = {};
    function findObjectByProp(prop) {
        for (let i = objects.length - 1; i >= 0; i--) {
            if (prop in objects[i])
                return objects[i];
        }
        return fallback;
    }
    const handler = {
        ownKeys() {
            return objects.reduce((acc, obj) => {
                acc.push(...Reflect.ownKeys(obj));
                return acc;
            }, Reflect.ownKeys(fallback));
        }
    };
    for (const method of ["defineProperty", "deleteProperty", "get", "getOwnPropertyDescriptor", "has", "set"]) {
        handler[method] = function (_, ...args) {
            return Reflect[method](findObjectByProp(args[0]), ...args);
        };
    }
    return new Proxy(fallback, handler);
}
exports.default = virtualMerge;
if (typeof module !== "undefined")
    module.exports = virtualMerge;
