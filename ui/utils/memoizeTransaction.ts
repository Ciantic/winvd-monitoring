/**
 * Memoize a function with transactionality.
 *
 * Main use case is to wrap database calls with memoize, and corresponding
 * database transactions with memoize transaction
 *
 * @author Jari O. O. Pennanen
 * @date 2023-03-17
 * @license MIT
 */

import { IMemoizationCache, cacheGetOrExec } from "./memoize.ts";

type Key = string | number;
type TransactionDepth = number;
type Cache = Map<Key, any>;

class TransactionalCacheRemote implements IMemoizationCache {
    transactionMap = new Map<TransactionDepth, Cache>([[0, new Map()]]);

    public getTransactionDepth?: () => TransactionDepth;

    constructor() {}

    get transactionDepth() {
        return this.getTransactionDepth?.() ?? 0;
    }

    commit() {
        const committed = this.transactionMap.get(this.transactionDepth + 1);
        const current = this.transactionMap.get(this.transactionDepth);
        if (committed && current) {
            for (const [key, value] of committed) {
                current.set(key, value);
            }
        }
        this.transactionMap.delete(this.transactionDepth + 1);
    }
    rollback() {
        this.transactionMap.delete(this.transactionDepth + 1);
    }

    get(key: Key) {
        // Iterate transaction depth and get first value that exists
        for (let i = this.transactionDepth; i >= 0; i--) {
            const cache = this.transactionMap.get(i);
            if (cache) {
                const value = cache.get(key);
                if (value !== undefined) {
                    return value;
                }
            }
        }
    }
    set(key: Key, value: any) {
        // Get or create cache for current transaction depth
        let cache = this.transactionMap.get(this.transactionDepth);
        if (!cache) {
            cache = new Map();
            this.transactionMap.set(this.transactionDepth, cache);
        }
        // Set value
        cache.set(key, value);
    }
    delete(key: Key) {
        // Note: This deletes value only from current depth, unclear what would be good behavior

        // Get cache for current transaction depth
        const cache = this.transactionMap.get(this.transactionDepth);
        if (cache) {
            cache.delete(key);
        }
    }
    *entries() {
        // Iterate depths and get all entries
        for (let i = this.transactionDepth; i >= 0; i--) {
            const cache = this.transactionMap.get(i);
            if (cache) {
                for (const entry of cache.entries()) {
                    yield entry;
                }
            }
        }
    }
}

const transactionMapCache = Symbol();
const transactionDepth = Symbol();

type IDatabaseLike = {
    transaction<T>(fn: () => Promise<T>): Promise<T>;

    [transactionMapCache]?: Map<symbol, TransactionalCacheRemote>;
    [transactionDepth]?: number;
};

export async function runMemoizeTransaction<T>(
    db: IDatabaseLike,
    fn: () => Promise<T>
): Promise<T> {
    // Increment transaction depth
    db[transactionDepth] = (db[transactionDepth] ?? 0) + 1;
    let res: T;
    try {
        res = await db.transaction(fn);
    } catch (e) {
        db[transactionDepth]--;

        // Rollback transaction
        const caches = db[transactionMapCache];
        if (caches) {
            for (const cache of caches.values()) {
                cache.rollback();
            }
        }
        throw e;
    }

    // Commit transaction
    db[transactionDepth]--;
    const caches = db[transactionMapCache];
    if (caches) {
        for (const cache of caches.values()) {
            cache.commit();
        }
    }
    return res;
}

/**
 * Memoize a function with transactionality, first argument should be Database
 * implementing transaction.
 *
 * @param fn Function, first argument must implement MemoizeStore, this is not
 * validated by TypeScript
 * @returns memoized function
 */
export function memoizeTransaction<F extends (this: void, db: any, ...args: any) => any>(fn: F) {
    // This does not check that first argument (db) implements IDatabaseLike, I
    // couldn't figure out how to make it reliably, this is the reason `db: any`.

    const symCache = Symbol();
    const newCache = new TransactionalCacheRemote();
    const fun = function (this: any, db: IDatabaseLike) {
        // Create map cache if not exist
        let mapCache = db[transactionMapCache];
        if (!mapCache) {
            mapCache = new Map();
            db[transactionMapCache] = mapCache;
        }

        // Create cache for this function if not exist
        let cache = mapCache.get(symCache);
        if (!cache) {
            // cache = new TransactionalCache2(() => arg[transactionDepth] ?? 0);
            cache = newCache;
            newCache.getTransactionDepth = () => db[transactionDepth] ?? 0;
            mapCache.set(symCache, cache);
        }

        return cacheGetOrExec(cache, fn, arguments as any);
    };
    fun.cache = newCache;

    return fun as any as {
        (...args: Parameters<typeof fn>): ReturnType<typeof fn>;
        cache: TransactionalCacheRemote;
    };
}

// Inference test

// const test = memoizeTransaction((db: MemoizeStore, a: number) => {
//     return a;
// });

// test(0 as any, 5);
// test(0 as any, "foo"); // This should give an error because "foo" is not a number
