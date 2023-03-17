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

type Key = string | number;

const CacheSymbol = (v: string | number) => "__" + v;
export const Symbols = {
    REF: Symbol("ref"),

    // Note: We can't use real symbols because `makeKey` will stringify these
    // values, and `Symbol()` stringified is always "null" string.
    CACHE_TRUE: CacheSymbol("true"),
    CACHE_FALSE: CacheSymbol("false"),
    CACHE_NULL: CacheSymbol("null"),
    CACHE_UNDEFINED: CacheSymbol("undefined"),
};

let REF_ID = 0;
function makeSingleKey(a: any): Key {
    if (typeof a === "string" || typeof a === "number") {
        return a;
    } else if (a === null) {
        return Symbols.CACHE_NULL;
    } else if (typeof a === "undefined") {
        return Symbols.CACHE_UNDEFINED;
    } else if (typeof a === "boolean") {
        return a ? Symbols.CACHE_TRUE : Symbols.CACHE_FALSE;
    } else if (isPlainObj(a) || Array.isArray(a)) {
        return CacheSymbol(JSON.stringify(a));
    } else {
        // If it's not a primitive then it's a class 🤞

        // By reference for classes, storing the reference in a symbol within the class
        if (a[Symbols.REF]) {
            return a[Symbols.REF];
        }
        a[Symbols.REF] = CacheSymbol("ref" + ++REF_ID);
        return a[Symbols.REF];
    }
}

export function makeKey(...args: any): Key {
    if (args.length === 0) {
        return 0;
    } else if (args.length === 1) {
        return makeSingleKey(args[0]);
    } else {
        return JSON.stringify(args.map(makeSingleKey));
    }
}

export interface IMemoizationCache {
    get(key: Key): any;
    set(key: Key, value: any): void;
    delete(key: Key): void;
    entries(): IterableIterator<[Key, any]>;
}

export function cacheGetOrExec<F extends (this: void, ...args: any[]) => any>(
    mutCache: IMemoizationCache,
    fn: F,
    args: Parameters<F>
): ReturnType<F> {
    // Try to get from a cache
    const key = makeKey(...args);
    const value = mutCache.get(key);
    if (value !== undefined) {
        return value;
    }

    // If not in cache, call the function
    const result = fn.call(undefined, ...args);

    // If it's promise, clear cache if it's rejected
    if (typeof result === "object" && result !== null && "catch" in result) {
        (result as any).catch((_: any) => {
            mutCache.delete(key);
        });
    }

    // Assign value to cache
    mutCache.set(key, result);
    return result as ReturnType<F>;
}

function memoizeWithCache<F extends (this: void, ...args: any[]) => any>(
    mutCache: IMemoizationCache,
    fn: F
) {
    return function () {
        return cacheGetOrExec(mutCache, fn, arguments as any);
    } as {
        (...args: Parameters<F>): Readonly<ReturnType<F>>;
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
export function memoize<F extends (this: void, ...args: any[]) => any>(fn: F) {
    const cache: IMemoizationCache = new Map();
    const memoized = memoizeWithCache(cache, fn);
    return Object.assign(memoized, { cache: cache }) as {
        (...args: Parameters<F>): Readonly<ReturnType<F>>;
        cache: IMemoizationCache;
    };
}

// Inference test

// const test = memoize((a: string, b: number) => {
//     return a + b;
// });

// test("Foo", 5);
// test(123, 123); // This should give an error because 123 is not a string
