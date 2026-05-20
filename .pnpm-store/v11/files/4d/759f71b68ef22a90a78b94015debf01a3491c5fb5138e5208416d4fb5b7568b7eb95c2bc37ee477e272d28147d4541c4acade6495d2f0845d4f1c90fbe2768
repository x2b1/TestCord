/*!
 * virtual-merge
 * Copyright (c) 2023 Vendicated
 * SPDX-License-Identifier: MIT
 */
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;
type ExtractObjectType<O extends object[]> = O extends Array<infer T> ? UnionToIntersection<T> : never;
declare function virtualMerge<O extends object[]>(...objects: O): ExtractObjectType<O>;
export default virtualMerge;
