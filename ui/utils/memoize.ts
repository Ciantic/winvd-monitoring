/**
 * Memoize a function. The function must be pureish, meaning that it must return
 * the same value for the same arguments. It also allows Promise results, and
 * classes as inputs.
 *
 * @author Jari O. O. Pennanen
 * @date 2023-03-15
 * @license MIT
 */
// deno-lint-ignore-file no-explicit-any

function isPlainObj(value: any) {
    return !!value && Object.getPrototypeOf(value) === Object.prototype;
}

// TODO: Do I even need this?
function deepFreeze<T>(obj: T): Readonly<T> {
    const propNames = Object.getOwnPropertyNames(obj);
    for (const name of propNames) {
        const value = (obj as any)[name];
        (obj as any)[name] = value && typeof value === "object" ? deepFreeze(value) : value;
    }
    return Object.freeze(obj);
}

type Key = string | number;

const CacheSymbol = (v: string | number) => "__" + v;
export const __REF = Symbol("ref");
export const __CACHE_TRUE = CacheSymbol("true");
export const __CACHE_FALSE = CacheSymbol("false");
export const __CACHE_NULL = CacheSymbol("null");
export const __CACHE_UNDEFINED = CacheSymbol("undefined");
let REF_ID = 0;
function key(a: any): Key {
    // Note: We can't return real symbols because `makeKey` will stringify these
    // values, and Symbol stringified is always "null" string.

    if (typeof a === "string" || typeof a === "number") {
        return a;
    } else if (a === null) {
        return __CACHE_NULL;
    } else if (typeof a === "undefined") {
        return __CACHE_UNDEFINED;
    } else if (typeof a === "boolean") {
        return a ? __CACHE_TRUE : __CACHE_FALSE;
    } else if (isPlainObj(a) || Array.isArray(a)) {
        return CacheSymbol(JSON.stringify(a));
    } else {
        // If it's not a primitive then it's a class 🤞

        // By reference for classes, storing the reference in a symbol within the class
        if (a[__REF]) {
            return a[__REF];
        }
        a[__REF] = CacheSymbol("ref" + ++REF_ID);
        return a[__REF];
    }
}

export function __makeKey(...args: any): Key {
    if (args.length === 0) {
        return 0;
    } else if (args.length === 1) {
        return key(args[0]);
    } else {
        return JSON.stringify(args.map(key));
    }
}

export interface ICache {
    get(key: Key): any;
    set(key: Key, value: any): void;
    delete(key: Key): void;
}

export class Cache implements ICache {
    get(key: Key) {
        return this.cache[key];
    }
    set(key: Key, value: any): void {
        this.cache[key] = value;
    }
    delete(key: Key): void {
        delete this.cache[key];
    }
    cache: Record<Key, any> = {};
}

/**
 * Create memoized function, with own cache implementation.
 *
 * Usually you want to use `memoize` instead.
 *
 * @param mutCache Own cache implementation
 * @param fn Function to memoize
 * @returns Memoized function
 */
export function memoizeWithCache<R, T extends (this: void, ...args: any[]) => R>(
    mutCache: ICache,
    fn: T
) {
    return function () {
        const key = __makeKey(...arguments);
        const value = mutCache.get(key);
        if (value !== undefined) {
            return value;
        }

        const result = fn.call(undefined, ...arguments);

        if (typeof result === "object" && result !== null) {
            if ("catch" in result) {
                // If it's a promise
                (result as any).catch((_: any) => {
                    // If it's rejected, remove cache
                    mutCache.delete(key);
                });
                mutCache.set(key, result);
            } else {
                mutCache.set(key, deepFreeze(result));
            }
        } else {
            mutCache.set(key, result);
        }
        return result;
    } as {
        (...args: Parameters<T>): ReturnType<T>;
    };
}

/**
 * Memoize the function.
 *
 * In case any of the inputs has a class it's treated as a reference, primitives
 * should work as is.
 *
 * In case the output is a Promise it returns the same promise, and cache is
 * cleared if the promise is rejected.
 *
 * @param fn Function to memoize
 * @returns Memoized function
 */
export function memoize<R, T extends (this: void, ...args: any[]) => R>(fn: T) {
    const cache: Cache = new Cache();
    const memoized = memoizeWithCache(cache, fn);
    return Object.assign(memoized, { cache: cache.cache });
}
