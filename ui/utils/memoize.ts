/**
 * Memoize a function. The function must be pureish, meaning that it must return
 * the same value for the same arguments. It also allows Promise results, and
 * classes as inputs.
 *
 * In case the input has a class it's treated as a reference.
 *
 * In case the output is a Promise it returns the same promise, and cache is
 * cleared if the promise is rejected.
 *
 * @author Jari O. O. Pennanen
 * @date 2023-03-15
 * @license MIT
 */

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

type Key = string | number | symbol;

export const REF = Symbol("ref");
export const CACHE_TRUE = Symbol("true");
export const CACHE_FALSE = Symbol("false");
export const CACHE_NULL = Symbol("null");
export const CACHE_UNDEFINED = Symbol("undefined");
function key(a: any): symbol | string | number {
    if (typeof a === "string" || typeof a === "number") {
        return a;
    } else if (a === null) {
        return CACHE_NULL;
    } else if (typeof a === "undefined") {
        return CACHE_UNDEFINED;
    } else if (typeof a === "boolean") {
        return a ? CACHE_TRUE : CACHE_FALSE;
    } else if (isPlainObj(a) || Array.isArray(a)) {
        return JSON.stringify(a);
    } else {
        // If it's not a primitive then it's a class 🤞

        // By reference for classes, storing the reference in a symbol within the class
        if (a[REF]) {
            return a[REF];
        }
        a[REF] = Symbol();
        return a[REF];
    }
}

function makeKey(...args: any): Key {
    if (args.length === 0) {
        return 0;
    } else if (args.length === 1) {
        return key(args[0]);
    } else {
        return JSON.stringify(args.map(key));
    }
}

export function memoize<R, T extends (this: void, ...args: any[]) => R>(fn: T) {
    const cache: { [k: Key]: any } = {};
    const memoized = function () {
        const key = makeKey(...arguments);
        if (cache[key]) {
            return cache[key];
        }

        const result = fn.call(undefined, ...arguments);

        if (typeof result === "object" && result !== null) {
            if ("catch" in result) {
                // If it's a promise
                (result as any).catch((e: any) => {
                    // If it's rejected, remove cache
                    delete cache[key];
                });
                cache[key] = result;
            } else {
                cache[key] = deepFreeze(result);
            }
        } else {
            cache[key] = result;
        }
        return result;
    };

    memoized.cache = cache;
    return memoized as {
        (...args: Parameters<typeof fn>): Readonly<ReturnType<typeof fn>>;
        cache: Readonly<Record<Key, ReturnType<typeof fn>>>;
    };
}
