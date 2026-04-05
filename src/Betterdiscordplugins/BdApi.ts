/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Settings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import { wreq } from "@webpack";
import { FluxDispatcher, React, ReactDOM } from "@webpack/common";

const bdLogger = new Logger("BdApi", "#7289da");

// ============================================================================
// Patcher Implementation (Enhanced with caller tracking)
// ============================================================================

interface Patch {
    caller: string;
    type: "before" | "after" | "instead";
    id: number;
    callback: Function;
    unpatch: () => void;
}

interface PatchRecord {
    name: string;
    module: any;
    functionName: string;
    originalFunction: Function;
    proxyFunction: Function | null;
    children: Patch[];
    revert: () => void;
    counter: number;
}

class PatcherManager {
    private patches: PatchRecord[] = [];
    private pluginName: string;

    constructor(pluginName?: string) {
        this.pluginName = pluginName || "BdApi";
    }

    getPatchesByCaller(name?: string): Patch[] {
        if (!name) return [];
        const patches: Patch[] = [];
        for (const patch of this.patches) {
            for (const childPatch of patch.children) {
                if (childPatch.caller === name) patches.push(childPatch);
            }
        }
        return patches;
    }

    unpatchAll(caller?: string): void {
        const patchesToUnpatch = typeof caller === "string" ? this.getPatchesByCaller(caller) : [];
        for (const patch of patchesToUnpatch) {
            patch.unpatch();
        }
    }

    private resolveModule(module: any): any {
        if (!module || typeof module === "function" || (typeof module === "object" && !Array.isArray(module))) return module;
        if (typeof module === "string") {
            // Try to find module by displayName/name
            return null; // Would need webpack lookup
        }
        if (Array.isArray(module)) {
            // Try to find by props - use type assertion to access modules
            const wreqAny = wreq as any;
            if (wreqAny.m) {
                return Object.values(wreqAny.m).find((m: any) => {
                    if (!m) return false;
                    try {
                        const exports = m.exports || {};
                        return module.every(prop => prop in exports);
                    } catch {
                        return false;
                    }
                });
            }
        }
        return null;
    }

    private makeOverride(patch: PatchRecord): Function {
        return function (this: any, ...args: any[]) {
            let returnValue: any;
            if (!patch.children || !patch.children.length) {
                return patch.originalFunction.apply(this, args);
            }

            // Run "before" patches
            for (const superPatch of patch.children.filter(c => c.type === "before")) {
                try {
                    superPatch.callback(this, args);
                } catch (err) {
                    bdLogger.error(`Could not fire before callback of ${patch.functionName} for ${superPatch.caller}`, err);
                }
            }

            // Run "instead" patches
            const insteads = patch.children.filter(c => c.type === "instead");
            if (!insteads.length) {
                returnValue = patch.originalFunction.apply(this, args);
            } else {
                for (const insteadPatch of insteads) {
                    try {
                        const tempReturn = insteadPatch.callback(this, args, patch.originalFunction.bind(this));
                        if (typeof tempReturn !== "undefined") returnValue = tempReturn;
                    } catch (err) {
                        bdLogger.error(`Could not fire instead callback of ${patch.functionName} for ${insteadPatch.caller}`, err);
                    }
                }
            }

            // Run "after" patches
            for (const slavePatch of patch.children.filter(c => c.type === "after")) {
                try {
                    const tempReturn = slavePatch.callback(this, args, returnValue);
                    if (typeof tempReturn !== "undefined") returnValue = tempReturn;
                } catch (err) {
                    bdLogger.error(`Could not fire after callback of ${patch.functionName} for ${slavePatch.caller}`, err);
                }
            }

            return returnValue;
        };
    }

    private rePatch(patch: PatchRecord): void {
        patch.proxyFunction = patch.module[patch.functionName] = this.makeOverride(patch);
    }

    private makePatch(module: any, functionName: string, name: string): PatchRecord {
        const patch: PatchRecord = {
            name,
            module,
            functionName,
            originalFunction: module[functionName],
            proxyFunction: null,
            revert: () => {
                patch.module[patch.functionName] = patch.originalFunction;
                patch.proxyFunction = null;
                patch.children = [];
            },
            counter: 0,
            children: []
        };

        patch.proxyFunction = module[functionName] = this.makeOverride(patch);
        // Copy properties from original
        if (patch.originalFunction) {
            Object.assign(module[functionName], patch.originalFunction);
            (module[functionName] as any).__originalFunction = patch.originalFunction;
            module[functionName].toString = () => patch.originalFunction.toString();
        }

        this.patches.push(patch);
        return patch;
    }

    private pushChildPatch(
        moduleToPatch: any,
        functionName: string,
        callback: Function,
        options: { type?: "before" | "after" | "instead"; forcePatch?: boolean; displayName?: string; } = {}
    ): (() => void) | null {
        const { type = "after", forcePatch = true } = options;
        const module = this.resolveModule(moduleToPatch) || moduleToPatch;

        if (!module) return null;
        if (!module[functionName] && forcePatch) module[functionName] = function () { };
        if (!(module[functionName] instanceof Function)) return null;

        const displayName = options.displayName || module.displayName || module.name || "Unknown";
        const patchId = `${displayName}.${functionName}`;

        let patch = this.patches.find(p => p.module === module && p.functionName === functionName);
        if (!patch) {
            patch = this.makePatch(module, functionName, patchId);
        } else if (!patch.proxyFunction) {
            this.rePatch(patch);
        }

        const child: Patch = {
            caller: this.pluginName,
            type,
            id: patch.counter,
            callback,
            unpatch: () => {
                const idx = patch!.children.findIndex(c => c.id === child.id && c.type === type);
                if (idx !== -1) {
                    patch!.children.splice(idx, 1);
                }
                if (patch!.children.length <= 0) {
                    const patchNum = this.patches.findIndex(p => p.module === module && p.functionName === functionName);
                    if (patchNum >= 0) {
                        this.patches[patchNum].revert();
                        this.patches.splice(patchNum, 1);
                    }
                }
            }
        };

        patch.children.push(child);
        patch.counter++;
        return child.unpatch;
    }

    before(moduleToPatch: object, functionName: string, callback: Function, options = {}): () => void {
        return this.pushChildPatch(moduleToPatch, functionName, callback, { ...options, type: "before" }) || (() => { });
    }

    after(moduleToPatch: object, functionName: string, callback: Function, options = {}): () => void {
        return this.pushChildPatch(moduleToPatch, functionName, callback, { ...options, type: "after" }) || (() => { });
    }

    instead(moduleToPatch: object, functionName: string, callback: Function, options = {}): () => void {
        return this.pushChildPatch(moduleToPatch, functionName, callback, { ...options, type: "instead" }) || (() => { });
    }
}

// ============================================================================
// Webpack Module Access (Enhanced)
// ============================================================================

const BdWebpack = {
    Filters: {
        byProps: (...props: string[]) => (m: any) => m && props.every(p => m[p] !== undefined),
        byKeys: (...props: string[]) => (m: any) => m && props.every(p => p in m),
        byDisplayName: (displayName: string) => (m: any) => m?.displayName === displayName,
        byName: (name: string) => (m: any) => m?.name === name,
        byStrings: (...strings: string[]) => (m: any) => {
            if (typeof m !== "function") return false;
            try {
                const str = String(m);
                return strings.every(s => str.includes(s));
            } catch {
                return false;
            }
        },
        bySource: (...something: (string | RegExp)[]) => {
            return (_unused: unknown, module: { id?: number; }) => {
                if (!module?.id) return false;
                let source: string;
                try {
                    source = String((wreq as any).m[module.id]);
                } catch {
                    return false;
                }
                return something.every(search =>
                    typeof search === "string" ? source.includes(search) : search.test(source)
                );
            };
        },
        byPrototypeKeys: (...keys: string[]) => (m: any) => m?.prototype && keys.every(k => k in m.prototype),
        byStoreName: (name: string) => (m: any) => m?._dispatchToken && m?.getName?.() === name,
        byRegex: (regex: RegExp, filterFn: (m: any) => any = m => m) => (m: any) => {
            const method = filterFn(m);
            if (!method) return false;
            let methodString = "";
            try {
                methodString = method.toString();
            } catch {
                return false;
            }
            return methodString.search(regex) !== -1;
        },
        combine: (...filters: ((exports: any, module?: any, id?: any) => boolean)[]) =>
            (exports: any, module: any, id: any) => filters.every(f => f(exports, module, id)),
        not: (filter: (exports: any, module?: any, id?: any) => boolean) =>
            (exports: any, module: any, id: any) => !filter(exports, module, id),
        byComponentType: (filterFn: (component: any) => boolean) => (exports: any) => {
            const component = getReactComponentType(exports);
            return typeof component === "function" && filterFn(component);
        }
    },

    getModule: (filterFn: Function, options: { first?: boolean; defaultExport?: boolean; searchExports?: boolean; raw?: boolean; } = {}): any => {
        const { first = true, defaultExport = true, searchExports = false, raw = false } = options;
        const modules = (wreq as any).c || {};
        const found: any[] = [];

        for (const id in modules) {
            if (!modules.hasOwnProperty(id)) continue;
            let module: any;
            try {
                module = modules[id];
            } catch {
                continue;
            }

            const { exports } = module;
            if (!exports || exports === window) continue;

            // Skip DOM/Map-like exports
            if (exports.remove && exports.set && exports.clear && exports.get && !exports.sort) continue;
            if (exports?.default?.remove && exports?.default?.set && exports?.default?.clear && exports?.default?.get && !exports?.default?.sort) continue;
            // Skip token-related modules
            if (exports?.default?.getToken || exports?.default?.getEmail || exports?.default?.showToken) continue;
            if (exports.getToken || exports.getEmail || exports.showToken) continue;

            try {
                if (searchExports && typeof exports === "object" && !exports.TypedArray) {
                    if (filterFn(exports, module, id)) {
                        const foundModule = raw ? module : exports;
                        if (first) return foundModule;
                        found.push(foundModule);
                    }
                    for (const key in exports) {
                        let wrappedExport: any;
                        try {
                            wrappedExport = exports[key];
                        } catch {
                            continue;
                        }
                        if (!wrappedExport) continue;
                        if (typeof wrappedExport !== "object" && typeof wrappedExport !== "function") continue;
                        if (filterFn(wrappedExport, module, id)) {
                            if (raw) {
                                if (first) return module;
                                found.push(module);
                            } else {
                                if (first) return wrappedExport;
                                found.push(wrappedExport);
                            }
                        }
                    }
                } else {
                    let testExport = exports;
                    if (exports.__esModule && exports.default) {
                        testExport = defaultExport ? exports.default : exports;
                    } else if (exports.A && !exports.Ay) {
                        testExport = defaultExport ? exports.A : exports;
                    } else if (exports.Ay) {
                        testExport = defaultExport ? exports.Ay : exports;
                    }

                    if (filterFn(testExport, module, id)) {
                        if (raw) {
                            if (first) return module;
                            found.push(module);
                        } else {
                            if (first) return testExport;
                            found.push(testExport);
                        }
                    }
                }
            } catch {
                continue;
            }
        }

        return first || found.length === 0 ? undefined : found;
    },

    getModuleByProps: (...props: string[]): any => {
        return BdWebpack.getModule(BdWebpack.Filters.byProps(...props));
    },

    getModuleByDisplayName: (displayName: string): any => {
        return BdWebpack.getModule(BdWebpack.Filters.byDisplayName(displayName));
    },

    getModuleByName: (name: string): any => {
        return BdWebpack.getModule(BdWebpack.Filters.byName(name));
    },

    getByKeys: (...keys: string[]): any => {
        return BdWebpack.getModule(BdWebpack.Filters.byKeys(...keys));
    },

    getModuleByKeys: (...keys: string[]): any => {
        return BdWebpack.getModule(BdWebpack.Filters.byKeys(...keys));
    },

    getModuleByStrings: (...strings: string[]): any => {
        return BdWebpack.getModule(BdWebpack.Filters.byStrings(...strings), { searchExports: true });
    },

    getModuleBySource: (source: string): any => {
        return BdWebpack.getModule(BdWebpack.Filters.bySource(source));
    },

    getModuleByPrototypeKeys: (...keys: string[]): any => {
        return BdWebpack.getModule(BdWebpack.Filters.byPrototypeKeys(...keys));
    },

    getStore: (name: string): any => {
        return BdWebpack.getModule(BdWebpack.Filters.byStoreName(name));
    },

    waitForModule: (filterFn: Function, timeout: number = 3000): Promise<any> => {
        return new Promise((resolve, reject) => {
            const module = BdWebpack.getModule(filterFn);
            if (module) {
                resolve(module);
                return;
            }

            const timeoutId = setTimeout(() => {
                reject(new Error(`Module not found within ${timeout}ms`));
            }, timeout);

            const checkInterval = setInterval(() => {
                const found = BdWebpack.getModule(filterFn);
                if (found) {
                    clearInterval(checkInterval);
                    clearTimeout(timeoutId);
                    resolve(found);
                }
            }, 100);
        });
    },

    Bulk: async (queries: Array<{ filter: Function; defaultExport?: boolean; }>): Promise<any[]> => {
        return Promise.all(
            queries.map(q => BdWebpack.getModule(q.filter, { searchExports: q.defaultExport ?? true }))
        );
    },

    getLazy: (filterFn: Function, options: { timeout?: number; } = {}): { cancel: () => void; promise: Promise<any>; } => {
        let cancelFn: () => void = () => { };
        const promise = new Promise<any>((resolve, reject) => {
            const module = BdWebpack.getModule(filterFn);
            if (module) {
                resolve(module);
                cancelFn = () => { };
                return;
            }

            const timeout = options.timeout ?? 5000;
            const timeoutId = setTimeout(() => {
                reject(new Error(`Module not found within ${timeout}ms`));
            }, timeout);

            const checkInterval = setInterval(() => {
                const found = BdWebpack.getModule(filterFn);
                if (found) {
                    clearInterval(checkInterval);
                    clearTimeout(timeoutId);
                    resolve(found);
                }
            }, 100);

            cancelFn = () => {
                clearInterval(checkInterval);
                clearTimeout(timeoutId);
                reject(new Error("Cancelled"));
            };
        });

        return { cancel: cancelFn, promise };
    },

    require: wreq
};

// ============================================================================
// React Utilities (from BetterEquicord)
// ============================================================================

const exoticComponents = {
    memo: Symbol.for("react.memo"),
    forwardRef: Symbol.for("react.forward_ref"),
    lazy: Symbol.for("react.lazy")
};

function getReactComponentType(component: any): any {
    if (!component) return component;

    let inner = component;

    // Unwrap Vencord's LazyComponent wrapper if present
    if (typeof inner.$$vencordGetWrappedComponent === "function") {
        const unwrapped = inner.$$vencordGetWrappedComponent();
        if (unwrapped) inner = unwrapped;
    }

    // Unwrap React exotic components
    while (true) {
        const typeOf = inner?.$$typeof;

        if (typeOf === exoticComponents.memo) {
            inner = inner.type;
        } else if (typeOf === exoticComponents.forwardRef) {
            inner = inner.render;
        } else if (typeOf === exoticComponents.lazy) {
            const payload = inner._payload;
            if (payload?._status === 1) {
                inner = payload._result?.default ?? payload._result;
            } else {
                return () => { };
            }
        } else {
            break;
        }
    }

    return inner;
}

const HOOKS_ERR_MSG = "Cannot read properties of null (reading 'useState')";

const patchedReactHooks: Record<string, (...args: any[]) => any> = {
    useMemo(factory: () => any) { return factory(); },
    useState(initialState: any) {
        if (typeof initialState === "function") initialState = initialState();
        return [initialState, () => { }];
    },
    useReducer(reducer: any, initialArg: any, init?: (arg: any) => any) {
        const initialState = init ? init(initialArg) : initialArg;
        return [initialState, () => { }];
    },
    useEffect() { },
    useLayoutEffect() { },
    useRef(initialValue: any) { return { current: initialValue }; },
    useCallback(callback: any) { return callback; },
    useContext(context: any) { return context._currentValue; },
    useImperativeHandle() { },
    useDebugValue() { },
    useDeferredValue(value: any) { return value; },
    useTransition() { return [false, (callback: () => void) => callback()]; },
    useId() { return ""; },
    useSyncExternalStore(_subscribe: any, getSnapshot: () => any) { return getSnapshot(); },
    useInsertionEffect() { }
};

function wrapInHooks(functionComponent: Function, customPatches: Array<Function> = []): Function {
    return function (this: any, ...args: any[]) {
        const R = React;
        const originalHooks: Record<string, any> = {};
        for (const key in patchedReactHooks) {
            originalHooks[key] = R[key as keyof typeof R];
            (R as any)[key] = (patchedReactHooks as any)[key];
        }
        try {
            return functionComponent.apply(this, args);
        } catch (err: any) {
            if (err.message?.includes(HOOKS_ERR_MSG)) {
                console.warn("[BdApi.ReactUtils] Hooks called outside render context");
                return null;
            }
            throw err;
        } finally {
            for (const key in originalHooks) {
                (R as any)[key] = originalHooks[key];
            }
        }
    };
}

const ReactUtils = {
    getInternalInstance(node: HTMLElement): any {
        return (node as any)?.[Object.keys(node).find(k => k.startsWith("__reactFiber")) || ""] || null;
    },

    getType: getReactComponentType,

    getOwnerInstance(el: HTMLElement, options: { includePrototype?: boolean; } = {}): any {
        const { includePrototype = false } = options;
        let current = el;
        while (current) {
            const fiber = (current as any)[Object.keys(current).find(k => k.startsWith("__reactFiber$")) || ""];
            if (fiber) {
                let node = fiber;
                while (node) {
                    if (node.stateNode && typeof node.stateNode === "object") {
                        if (includePrototype || node.stateNode.constructor?.name !== "Object") {
                            return node.stateNode;
                        }
                    }
                    node = node.return;
                }
            }
            current = current.parentElement as HTMLElement;
        }
        return null;
    },

    wrapInHooks,

    createNodePatcher(callback: (props: any, res: any, instance?: any) => any): any {
        const patcherRef = { patch: null as any };
        const symId = Symbol("BdApiNodePatcher");

        const patchedFn = function (this: any, ...args: any[]) {
            const res = (patchedFn as any).__originalFunction?.apply(this, args);
            return callback(this, res, this);
        };

        const patchFn = (node: any, cb: (props: any, res: any) => any) => {
            const type = node?.type;
            if (!type) return;

            const innerType = getReactComponentType(type);
            if (!innerType || typeof innerType !== "function") return;

            if (innerType[symId]) {
                node.type = innerType[symId];
                return;
            }

            const newType = function (this: any, ...fnArgs: any[]) {
                const result = innerType.apply(this, fnArgs);
                return cb(fnArgs[0], result);
            };

            Object.assign(newType, innerType);
            newType[symId] = newType;

            if (type.type) {
                node.type = React.memo(type.type?.render ? React.forwardRef(newType) : newType, type.compare);
            } else if (type.render) {
                node.type = React.forwardRef(newType);
            } else if (type._payload) {
                node.type = React.lazy(() => {
                    const out = type._init(type._payload);
                    if (out instanceof Promise) {
                        return out.catch((err: any) => ({ default: newType }));
                    }
                    return Promise.resolve({ default: newType });
                });
            } else {
                node.type = newType;
            }
        };

        patcherRef.patch = patchFn;
        return { patch: patchFn, getOriginal: () => (patchedFn as any).__originalFunction };
    }
};

// ============================================================================
// Flux-Compatible Store
// ============================================================================

class FluxCompatibleStore {
    private listeners: Set<() => void> = new Set();

    initialize(): void { }

    addChangeListener(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.removeChangeListener(listener);
    }

    removeChangeListener(listener: () => void): void {
        this.listeners.delete(listener);
    }

    addReactChangeListener(listener: () => void): void {
        this.listeners.add(listener);
    }

    removeReactChangeListener(listener: () => void): void {
        this.listeners.delete(listener);
    }

    emitChange(): void {
        for (const listener of this.listeners) {
            try {
                listener();
            } catch (e) {
                bdLogger.error("[Utils.Store] Listener threw an error:", e);
            }
        }
    }
}

// ============================================================================
// Hooks API
// ============================================================================

let _cachedUseStateFromStores: any = null;
function getUseStateFromStores(): any {
    if (_cachedUseStateFromStores) return _cachedUseStateFromStores;

    try {
        _cachedUseStateFromStores = (wreq as any).Common?.useStateFromStores;
        if (_cachedUseStateFromStores) return _cachedUseStateFromStores;
    } catch { }

    try {
        _cachedUseStateFromStores = BdWebpack.getModule(
            (m: any) => m?.toString?.()?.includes("useStateFromStores"),
            { searchExports: true }
        );
    } catch { }

    return _cachedUseStateFromStores;
}

const HooksHolder = {
    useStateFromStores<T>(
        stores: any | any[],
        selector: () => T,
        deps?: readonly unknown[],
        comparator?: (a: T, b: T) => boolean
    ): T {
        const hook = getUseStateFromStores();
        const storesArray = Array.isArray(stores) ? stores : [stores];
        if (hook) {
            return hook(storesArray, selector, deps, comparator);
        }
        bdLogger.warn("useStateFromStores: Hook not found, using non-reactive fallback");
        return selector();
    },

    useForceUpdate(): [number, () => void] {
        return React.useReducer((n: number) => n + 1, 0);
    }
};

// ============================================================================
// DOM API (Enhanced)
// ============================================================================

class BdDOM {
    private pluginName: string;

    constructor(pluginName?: string) {
        this.pluginName = pluginName || "";
    }

    get screenWidth(): number {
        return Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    }

    get screenHeight(): number {
        return Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    }

    createElement(tag: string = "div", options: any = {}, ...children: (string | Node)[]): HTMLElement {
        const { className, id, target } = options;
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (id) element.id = id;
        if (children.length) element.append(...children);
        if (target) document.querySelector(target)?.append(element);
        return element;
    }

    appendStyle(id: string, css: string): void {
        id = id.replace(/(?:^[^a-z]+)|(?:[^\w-]+)/gi, "-");
        let style = document.getElementById(id) as HTMLStyleElement;
        if (!style) {
            style = document.createElement("style");
            style.id = id;
            let container = document.querySelector("bd-styles");
            if (!container) {
                container = document.createElement("div");
                container.setAttribute("bd-styles", "");
                (container as HTMLElement).style.display = "none";
                document.head.appendChild(container);
            }
            container.appendChild(style);
        }
        style.textContent = css;
    }

    removeStyle(id: string): void {
        id = id.replace(/(?:^[^a-z]+)|(?:[^\w-]+)/gi, "-");
        const style = document.getElementById(id);
        if (style) style.remove();
    }

    getStyle(id: string): string {
        const style = document.getElementById(id) as HTMLStyleElement;
        return style?.textContent || "";
    }

    toggleStyle(id: string, toggle?: boolean): boolean {
        const style = document.getElementById(id) as HTMLStyleElement;
        if (!style) return false;
        const shouldEnable = toggle ?? style.disabled;
        style.disabled = !shouldEnable;
        return shouldEnable;
    }

    querySelector(selector: string): Element | null {
        return document.querySelector(selector);
    }

    querySelectorAll(selector: string): NodeListOf<Element> {
        return document.querySelectorAll(selector);
    }

    addListener(selector: string, event: string, handler: EventListener, options?: boolean | AddEventListenerOptions): void {
        const elements = this.querySelectorAll(selector);
        elements.forEach(el => el.addEventListener(event, handler, options));
    }

    removeListener(selector: string, event: string, handler: EventListener): void {
        const elements = this.querySelectorAll(selector);
        elements.forEach(el => el.removeEventListener(event, handler));
    }

    injectScript(targetName: string, url: string): Promise<void> {
        targetName = targetName.replace(/(?:^[^a-z]+)|(?:[^\w-]+)/gi, "-");
        return new Promise((resolve, reject) => {
            let script = document.querySelector(`bd-scripts #${targetName}`) as HTMLScriptElement;
            if (!script) {
                script = this.createElement("script", { id: targetName }) as HTMLScriptElement;
                document.querySelector("bd-scripts")?.append(script);
            }
            script.src = url;
            script.onload = () => resolve();
            script.onerror = reject;
        });
    }

    removeScript(targetName: string): void {
        targetName = targetName.replace(/(?:^[^a-z]+)|(?:[^\w-]+)/gi, "-");
        const script = document.querySelector(`bd-scripts #${targetName}`);
        if (script) script.remove();
    }

    parseHTML(html: string, asFragment = false): Node | NodeListOf<Node> {
        const template = document.createElement("template");
        template.innerHTML = html.trim();
        if (asFragment) {
            return template.content.cloneNode(true);
        }
        const { childNodes } = template.content;
        return childNodes.length === 1 ? childNodes[0] : childNodes;
    }

    injectTheme(id: string, css: string): void {
        id = id.replace(/(?:^[^a-z]+)|(?:[^\w-]+)/gi, "-");
        let style = document.querySelector(`bd-themes #${id}`) as HTMLStyleElement;
        if (!style) {
            style = this.createElement("style", { id }) as HTMLStyleElement;
            let container = document.querySelector("bd-themes");
            if (!container) {
                container = document.createElement("div");
                container.setAttribute("bd-themes", "");
                (container as HTMLElement).style.display = "none";
                document.head.appendChild(container);
            }
            container.appendChild(style);
        }
        style.textContent = css;
    }

    removeTheme(id: string): void {
        id = id.replace(/(?:^[^a-z]+)|(?:[^\w-]+)/gi, "-");
        const style = document.querySelector(`bd-themes #${id}`);
        if (style) style.remove();
    }

    animate(update: (progress: number) => void, duration: number, options: { timing?: (t: number) => number; } = {}): () => void {
        const timing = options.timing || ((t: number) => t);
        const start = performance.now();
        let id = requestAnimationFrame(function tick(time: number) {
            let t = (time - start) / duration;
            if (t > 1) t = 1;
            update(timing(t));
            if (t < 1) id = requestAnimationFrame(tick);
        });
        return () => cancelAnimationFrame(id);
    }

    onAdded(selector: string, callback: (el: Element) => void): (() => void) | void {
        const existing = document.body.querySelector(selector);
        if (existing) return callback(existing);

        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    const el = node as Element;
                    const match = el.matches(selector) ? el : el.querySelector(selector);
                    if (match) {
                        observer.disconnect();
                        callback(match);
                        return;
                    }
                }
            }
        });
        observer.observe(document.body, { subtree: true, childList: true });
        return () => observer.disconnect();
    }

    onRemoved(node: HTMLElement, callback: () => void): () => void {
        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                const nodes = Array.from(mutation.removedNodes);
                if (nodes.includes(node) || nodes.some(p => (p as Node).contains(node))) {
                    observer.disconnect();
                    callback();
                    return;
                }
            }
        });
        observer.observe(document.body, { subtree: true, childList: true });
        return () => observer.disconnect();
    }
}

// ============================================================================
// Data API (Enhanced with event listeners)
// ============================================================================

type PerKeyListener = (value?: any) => void;
type GlobalListener = (key: string, value?: any) => void;

class BdData {
    private pluginName: string;
    private pluginData: Record<string, any> = {};
    private keyListeners: Map<string, Set<PerKeyListener>> = new Map();
    private globalListeners: Map<string, Set<GlobalListener>> = new Map();

    constructor(pluginName?: string) {
        this.pluginName = pluginName || "";
        if (this.pluginName) {
            this.loadFromStorage();
        }
    }

    private getFullKey(key: string): string {
        return this.pluginName ? `${this.pluginName}_${key}` : key;
    }

    private loadFromStorage(): void {
        try {
            const data = localStorage.getItem(`BdData_${this.pluginName}`);
            if (data) {
                this.pluginData = JSON.parse(data);
            }
        } catch (e) {
            bdLogger.error(`Failed to load data for ${this.pluginName}:`, e);
        }
    }

    private saveToStorage(): void {
        try {
            localStorage.setItem(`BdData_${this.pluginName}`, JSON.stringify(this.pluginData));
        } catch (e) {
            bdLogger.error(`Failed to save data for ${this.pluginName}:`, e);
        }
    }

    async load(key: string): Promise<any> {
        const fullKey = this.getFullKey(key);
        return this.pluginData[key] ?? null;
    }

    async save(key: string, value: any): Promise<void> {
        const fullKey = this.getFullKey(key);
        this.pluginData[key] = value;
        this.saveToStorage();
        this.notifyListeners(key, value);
    }

    async delete(key: string): Promise<void> {
        delete this.pluginData[key];
        this.saveToStorage();
        this.notifyListeners(key);
    }

    async has(key: string): Promise<boolean> {
        return key in this.pluginData;
    }

    async getAll(): Promise<Record<string, any>> {
        return { ...this.pluginData };
    }

    on(keyOrListener: string | GlobalListener, listener?: PerKeyListener): void {
        if (typeof keyOrListener === "function") {
            if (!this.globalListeners.has(this.pluginName)) {
                this.globalListeners.set(this.pluginName, new Set());
            }
            this.globalListeners.get(this.pluginName)!.add(keyOrListener as GlobalListener);
        } else if (typeof keyOrListener === "string" && typeof listener === "function") {
            const fullKey = `${this.pluginName}.${keyOrListener}`;
            if (!this.keyListeners.has(fullKey)) {
                this.keyListeners.set(fullKey, new Set());
            }
            this.keyListeners.get(fullKey)!.add(listener);
        }
    }

    off(keyOrListener: string | GlobalListener, listener?: PerKeyListener): void {
        if (typeof keyOrListener === "function") {
            this.globalListeners.get(this.pluginName)?.delete(keyOrListener as GlobalListener);
            if (this.globalListeners.get(this.pluginName)?.size === 0) {
                this.globalListeners.delete(this.pluginName);
            }
        } else if (typeof keyOrListener === "string" && typeof listener === "function") {
            const fullKey = `${this.pluginName}.${keyOrListener}`;
            this.keyListeners.get(fullKey)?.delete(listener);
            if (this.keyListeners.get(fullKey)?.size === 0) {
                this.keyListeners.delete(fullKey);
            }
        }
    }

    private notifyListeners(key: string, value?: any): void {
        const fullKey = `${this.pluginName}.${key}`;
        const keyListeners = this.keyListeners.get(fullKey);
        if (keyListeners) {
            keyListeners.forEach(fn => fn(value));
        }
        const globalListeners = this.globalListeners.get(this.pluginName);
        if (globalListeners) {
            globalListeners.forEach(fn => fn(key, value));
        }
    }
}

// ============================================================================
// Logger
// ============================================================================

class BdLogger {
    private prefix: string;

    constructor(prefix?: string) {
        this.prefix = prefix ? `[${prefix}]` : "[BdApi]";
    }

    log(...args: any[]) { console.log(this.prefix, ...args); }
    info(...args: any[]) { console.info(this.prefix, ...args); }
    warn(...args: any[]) { console.warn(this.prefix, ...args); }
    error(...args: any[]) { console.error(this.prefix, ...args); }
    debug(...args: any[]) { console.debug(this.prefix, ...args); }
    stacktrace(context: string, message: string, error: any) {
        console.error(`${this.prefix} ${context}: ${message}`, error);
        if (error?.stack) console.error(error.stack);
    }
}

// ============================================================================
// UI Utilities (Enhanced with tooltips, modals, etc.)
// ============================================================================

const BdUI = {
    alert(title: string, content: string): void {
        alert(`${title}\n\n${content}`);
    },

    confirm(title: string, content: string, callback?: (confirmed: boolean) => void): void {
        const result = confirm(`${title}\n\n${content}`);
        callback?.(result);
    },

    openModal: (modalConfig: any): string => {
        bdLogger.log("Modal opened", modalConfig);
        return `modal-${Date.now()}`;
    },

    closeModal: (modalKey: string): void => {
        bdLogger.log("Modal closed", modalKey);
    },

    showToast(message: string, options: any = {}): void {
        // Try to use Discord's native toast
        try {
            const toastModule = BdWebpack.getModule((m: any) => m.createToast && m.showToast);
            if (toastModule) {
                let type = 1;
                if (typeof options === "number") {
                    type = [0, 1, 2, 3, 4, 5].includes(options) ? options : 1;
                } else if (options && typeof options === "object") {
                    const typeMap: Record<string, number> = {
                        "": 1, info: 1, success: 0, warn: 3, warning: 3, error: 4, danger: 4
                    };
                    type = typeMap[String(options.type || "").toLowerCase()] ?? 1;
                }
                toastModule.showToast(toastModule.createToast(message || "Success!", type));
                return;
            }
        } catch (e) {
            bdLogger.warn("Failed to show toast via Discord API:", e);
        }
        // Fallback
        console.log("[Toast]", message);
    },

    showConfirmationModal(title: string, content: any, options: any = {}): string {
        // Simplified - would need proper modal integration
        const result = confirm(`${title}\n\n${typeof content === "string" ? content : "[React Content]"}`);
        if (result && options.onConfirm) options.onConfirm();
        if (!result && options.onCancel) options.onCancel();
        return `modal-${Date.now()}`;
    },

    closeConfirmationModal(key: string): void { },
    closeAllConfirmationModals(): void { },

    showNotice(content: any, options: any = {}): Function {
        const container = document.createElement("div");
        container.style.cssText = "position:fixed;top:20px;right:20px;z-index:9999;background:var(--background-primary);padding:16px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.4);max-width:400px;";

        const title = document.createElement("div");
        title.style.cssText = "font-weight:600;margin-bottom:8px;";
        title.textContent = options.title || "Notice";
        container.appendChild(title);

        if (typeof content === "string") {
            const text = document.createElement("div");
            text.textContent = content;
            container.appendChild(text);
        } else if (content instanceof Node) {
            container.appendChild(content);
        }

        const closeBtn = document.createElement("button");
        closeBtn.textContent = "Close";
        closeBtn.style.cssText = "margin-top:12px;padding:8px 16px;background:var(--brand-500);color:white;border:none;border-radius:4px;cursor:pointer;";
        closeBtn.onclick = () => container.remove();
        container.appendChild(closeBtn);

        document.body.appendChild(container);

        if (options.timeout && options.timeout > 0) {
            setTimeout(() => container.remove(), options.timeout);
        }

        return () => container.remove();
    },

    createTooltip(attachTo: HTMLElement, label: string, options: any = {}) {
        return new BdTooltip(attachTo, label, options);
    },

    showChangelogModal(options: any = {}): void {
        bdLogger.log("Changelog modal requested", options);
    },

    async showInviteModal(inviteCode: string): Promise<void> {
        bdLogger.log("Invite modal requested", inviteCode);
    },

    buildSettingItem(setting: any): HTMLElement {
        const div = document.createElement("div");
        div.className = "bd-setting-item";
        div.innerHTML = `<div style="font-weight:600;margin-bottom:8px;">${setting.name || setting.label || ""}</div>`;
        return div;
    },

    buildSettingsPanel(options: { settings: any[]; onChange: Function; }): HTMLElement {
        const panel = document.createElement("div");
        panel.className = "bd-settings-panel";
        options.settings.forEach(setting => {
            panel.appendChild(this.buildSettingItem(setting));
        });
        return panel;
    }
};

class BdTooltip {
    private element: HTMLElement;
    private node: HTMLElement;
    private active = false;
    private observer: MutationObserver | null = null;

    constructor(attachTo: HTMLElement, label: string, options: any = {}) {
        this.node = attachTo;
        this.element = document.createElement("div");
        this.element.className = "bd-tooltip";
        this.element.textContent = label;
        this.element.style.cssText = "position:fixed;padding:8px 12px;background:var(--background-floating);color:var(--text-normal);border-radius:4px;font-size:14px;pointer-events:none;z-index:999999;box-shadow:0 2px 8px rgba(0,0,0,0.4);";

        if (options.style) {
            Object.assign(this.element.style, options.style);
        }

        attachTo.addEventListener("mouseenter", () => this.show());
        attachTo.addEventListener("mouseleave", () => this.hide());
    }

    hide(): void {
        if (!this.active) return;
        this.active = false;
        this.element.remove();
        this.observer?.disconnect();
    }

    show(): void {
        if (this.active) return;
        this.active = true;
        document.body.appendChild(this.element);

        const rect = this.node.getBoundingClientRect();
        this.element.style.left = `${rect.left + rect.width / 2 - this.element.offsetWidth / 2}px`;
        this.element.style.top = `${rect.top - this.element.offsetHeight - 8}px`;

        this.observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                const nodes = Array.from(mutation.removedNodes);
                if (nodes.includes(this.node) || nodes.some(n => (n as Node).contains(this.node))) {
                    this.hide();
                    return;
                }
            }
        });
        this.observer.observe(document.body, { subtree: true, childList: true });
    }
}

// ============================================================================
// Utils
// ============================================================================

const BdUtils = {
    suppressErrors: <T extends Function>(method: T, message: string = ""): T => {
        return (function (this: any, ...args: any[]) {
            try {
                return method.apply(this, args);
            } catch (e) {
                console.error(`[BdUtils] Error${message ? `: ${message}` : ""}`, e);
                return undefined;
            }
        }) as unknown as T;
    },

    formatMissing: (count: number): string => {
        return count === 1 ? "1 missing dependency" : `${count} missing dependencies`;
    },

    getID: (): string => {
        return `bd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },

    className: (...classes: string[]): string => {
        return classes.filter(Boolean).join(" ");
    },

    linkify: (text: string): string => {
        return text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
    },

    Store: FluxCompatibleStore
};

// ============================================================================
// ContextMenu (Stub for now)
// ============================================================================

const BdContextMenu = {
    patch(navId: string, callback: Function): () => void {
        bdLogger.warn("ContextMenu.patch is not fully implemented");
        return () => { };
    },

    unpatch(navId: string, callback: Function): void { },

    open(event: MouseEvent, menuConfig: any): string {
        bdLogger.warn("ContextMenu.open is not fully implemented");
        return "";
    },

    close(): void { }
};

// ============================================================================
// Commands API
// ============================================================================

const commandRegistry = new Map<string, Set<string>>();

const BdCommands = {
    Types: {
        CommandTypes: { CHAT_INPUT: 1, USER: 2, MESSAGE: 3 },
        InputTypes: { BUILT_IN: 0, TEXT: 1, SEARCH: 2 },
        OptionTypes: {
            SUB_COMMAND: 1, SUB_COMMAND_GROUP: 2, STRING: 3, INTEGER: 4,
            BOOLEAN: 5, USER: 6, CHANNEL: 7, ROLE: 8, MENTIONABLE: 9, NUMBER: 10
        },
        MessageEmbedTypes: {
            IMAGE: "image", VIDEO: "video", LINK: "link", ARTICLE: "article",
            RICH: "rich", GIFV: "gifv"
        }
    },

    register(caller: string, command: any): () => void {
        if (!caller || typeof caller !== "string") {
            throw new Error("Commands.register: caller must be a string");
        }
        if (!command?.id || !command?.name || typeof command.execute !== "function") {
            throw new Error("Commands.register: command must have id, name, and execute function");
        }

        const fullId = `bd-${caller}-${command.id}`;
        if (!commandRegistry.has(caller)) {
            commandRegistry.set(caller, new Set());
        }
        commandRegistry.get(caller)!.add(fullId);

        bdLogger.log(`Command registered: ${fullId}`);

        return () => this.unregister(caller, command.id);
    },

    unregister(caller: string, commandId: string): void {
        const fullId = `bd-${caller}-${commandId}`;
        commandRegistry.get(caller)?.delete(fullId);
        if (commandRegistry.get(caller)?.size === 0) {
            commandRegistry.delete(caller);
        }
    },

    unregisterAll(caller: string): void {
        const commands = commandRegistry.get(caller);
        if (!commands) return;
        for (const cmdId of Array.from(commands)) {
            const shortId = cmdId.replace(`bd-${caller}-`, "");
            this.unregister(caller, shortId);
        }
        commandRegistry.delete(caller);
    },

    getCommandsByCaller(caller: string): any[] {
        const commandIds = commandRegistry.get(caller);
        if (!commandIds) return [];
        return Array.from(commandIds);
    }
};

// ============================================================================
// Components (Stub)
// ============================================================================

const BdComponents = {
    get Button() { return React.forwardRef((props: any, ref: any) => React.createElement("button", { ...props, ref })); },
    get Switch() { return React.forwardRef((props: any, ref: any) => React.createElement("input", { ...props, type: "checkbox", ref })); },
    get Slider() { return React.forwardRef((props: any, ref: any) => React.createElement("input", { ...props, type: "range", ref })); },
    get TextBox() { return React.forwardRef((props: any, ref: any) => React.createElement("input", { ...props, type: "text", ref })); },
    get Dropdown() { return React.forwardRef((props: any, ref: any) => React.createElement("select", { ...props, ref })); },
    get Tooltip() { return BdTooltip; },
    get Spinner() { return React.forwardRef((props: any, ref: any) => React.createElement("div", { ...props, ref })); },
    get ColorPicker() { return React.forwardRef((props: any, ref: any) => React.createElement("input", { ...props, type: "color", ref })); },
    get SettingsPanel() { return BdUI.buildSettingsPanel; }
};

// ============================================================================
// Main BdApi Class
// ============================================================================

export class BdApiClass {
    static version: string = "Testcord BD Compatibility Layer v2.0 (Enhanced)";
    static Plugins: any;
    static Themes: any;
    static Patcher: PatcherManager;
    static Data: BdData;
    static DOM: BdDOM;
    static Logger: typeof BdLogger;
    static Webpack: typeof BdWebpack;
    static UI: typeof BdUI;
    static React: typeof React;
    static ReactDOM: typeof ReactDOM;
    static Utils: typeof BdUtils;
    static ContextMenu: typeof BdContextMenu;
    static Components: typeof BdComponents;
    static Flux: typeof FluxDispatcher;
    static Net: { fetch: typeof fetch; };
    static Commands: typeof BdCommands;
    static Hooks: typeof HooksHolder;
    static ReactUtils: typeof ReactUtils;

    private pluginName: string;
    public Patcher: PatcherManager;
    public Data: BdData;
    public DOM: BdDOM;
    public Logger: BdLogger;
    public Webpack: typeof BdWebpack;
    public UI: typeof BdUI;
    public Components: typeof BdComponents;
    public Commands: typeof BdCommands;
    public Hooks: typeof HooksHolder;
    public ReactUtils: typeof ReactUtils;

    constructor(pluginName?: string) {
        this.pluginName = pluginName || "";
        this.Patcher = new PatcherManager(pluginName);
        this.Data = new BdData(pluginName);
        this.DOM = new BdDOM(pluginName);
        this.Logger = new BdLogger(pluginName);
        this.Webpack = BdWebpack;
        this.UI = BdUI;
        this.Components = BdComponents;
        this.Commands = BdCommands;
        this.Hooks = HooksHolder;
        this.ReactUtils = ReactUtils;
    }

    static noConflict(): typeof BdApiClass {
        return BdApiClass;
    }

    showNotice(content: any, options: any = {}): Function {
        return BdUI.showNotice(content, options);
    }
}

// ============================================================================
// Initialize Static Properties
// ============================================================================

BdApiClass.Logger = BdLogger;
BdApiClass.Webpack = BdWebpack;
BdApiClass.UI = BdUI;
BdApiClass.React = React;
BdApiClass.ReactDOM = ReactDOM;
BdApiClass.Utils = BdUtils;
BdApiClass.ContextMenu = BdContextMenu;
BdApiClass.Components = BdComponents;
BdApiClass.Flux = FluxDispatcher;
BdApiClass.Net = { fetch };
BdApiClass.Commands = BdCommands;
BdApiClass.Hooks = HooksHolder;
BdApiClass.ReactUtils = ReactUtils;

// ============================================================================
// Plugin & Theme APIs (placeholders - managed by PluginManager)
// ============================================================================

class BdPluginAPI {
    get folder(): string { return "Betterdiscordplugins"; }
    isEnabled(pluginId: string): boolean {
        return Settings.plugins[pluginId]?.enabled ?? true;
    }
    enable(pluginId: string): void {
        if (Settings.plugins[pluginId]) Settings.plugins[pluginId].enabled = true;
    }
    disable(pluginId: string): void {
        if (Settings.plugins[pluginId]) Settings.plugins[pluginId].enabled = false;
    }
    toggle(pluginId: string): void {
        if (this.isEnabled(pluginId)) this.disable(pluginId);
        else this.enable(pluginId);
    }
    get(pluginId: string): any {
        return (window as any).TestcordBDPlugins?.[pluginId];
    }
    getAll(): any[] {
        return Object.values((window as any).TestcordBDPlugins || {});
    }
    start(pluginId: string): void { this.enable(pluginId); }
    stop(pluginId: string): void { this.disable(pluginId); }
    reload(pluginId: string): void {
        this.disable(pluginId);
        this.enable(pluginId);
    }
}

class BdThemeAPI {
    get folder(): string { return "themes"; }
    isEnabled(themeId: string): boolean { return false; }
    enable(themeId: string): void { }
    disable(themeId: string): void { }
    toggle(themeId: string): void { }
    get(themeId: string): any { return (window as any).TestcordBDThemes?.[themeId]; }
    getAll(): any[] { return Object.values((window as any).TestcordBDThemes || {}); }
    reload(themeId: string): void { }
}

BdApiClass.Plugins = new BdPluginAPI();
BdApiClass.Themes = new BdThemeAPI();
BdApiClass.Patcher = new PatcherManager("BdApi");
BdApiClass.Data = new BdData();
BdApiClass.DOM = new BdDOM();

// ============================================================================
// Exports
// ============================================================================

export const BdApi = BdApiClass;

export function createBdApi(pluginName: string): BdApiClass {
    return new BdApiClass(pluginName);
}

// ============================================================================
// Global API Setup
// ============================================================================

if (typeof window !== "undefined") {
    (window as any).BdApi = new BdApiClass("Global");
}
