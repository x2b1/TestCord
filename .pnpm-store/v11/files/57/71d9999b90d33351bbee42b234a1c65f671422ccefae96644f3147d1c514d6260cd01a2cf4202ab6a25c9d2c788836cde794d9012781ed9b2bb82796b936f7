export declare type Scope = {
    name: string;
    shorthand?: string;
    background?: string;
    color?: string;
    css?: string;
};
export declare class WebLogger {
    scopes: Scope[];
    constructor(scopes: Scope[]);
    log(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
    createLogger(scopes: Scope | Scope[], trim?: number): WebLogger;
    serialize(): string;
    static deserialize(data: string): WebLogger;
    getEdges(scope: Scope): [boolean, boolean];
    getBorderRadius(scope: Scope): string;
    getBorderWidth(scope: Scope): string;
    getDisplayName(scope: Scope): string;
    getScopedArgs(): string[];
    static replaceCssVars(css: string): string;
}
