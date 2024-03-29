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
type Cache<R> = Map<Key, R>;

class MemoizationCache<R> implements IMemoizationCache {
    private transactionMap = new Map<TransactionDepth, Cache<R>>([[0, new Map()]]);

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
    contents() {
        return this.transactionMap;
    }
}

const transactionMapCache = Symbol();
const transactionDepth = Symbol();

type IDatabaseLike = {
    transaction<T>(fn: () => Promise<T>): Promise<T>;

    [transactionMapCache]?: Map<symbol, MemoizationCache<any>>;
    [transactionDepth]?: number;
};

/**
 * Run database transaction with memoization cache at the same time.
 *
 * @param db Database
 * @param fn Your transaction handler
 * @returns
 */
export async function transaction<T>(db: IDatabaseLike, fn: () => Promise<T>): Promise<T> {
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
 * Memoize a database function with transactionality, first argument should be
 * Database implementing transaction.
 *
 * This is only useful if you use accompanying `transaction` function, otherwise
 * this does not differ from normal memoization at all.
 *
 * @param fn Function, first argument must implement database like transactions,
 * this is not validated by TypeScript
 * @returns memoized function
 */
export function memoizeDbFunction<F extends (this: void, db: any, ...args: any) => any>(
    fn: F
): {
    (...args: Parameters<F>): ReturnType<F>;
    cache: MemoizationCache<ReturnType<F>>;
} {
    // This does not check that first argument (db) implements IDatabaseLike, I
    // couldn't figure out how to make it reliably, this is the reason `db: any`.

    const symCache = Symbol();
    const cache = new MemoizationCache<ReturnType<F>>();
    const memoized = function (this: any, db: IDatabaseLike, ..._args: any) {
        // Create map cache if not exist
        let mapCache = db[transactionMapCache];
        if (!mapCache) {
            mapCache = new Map();
            db[transactionMapCache] = mapCache;
        }

        // Create cache for this function if not exist
        let foundCache = mapCache.get(symCache);
        if (!foundCache) {
            // cache = new TransactionalCache2(() => arg[transactionDepth] ?? 0);
            foundCache = cache;
            cache.getTransactionDepth = () => db[transactionDepth] ?? 0;
            mapCache.set(symCache, foundCache);
        }

        return cacheGetOrExec(foundCache, fn, arguments as any);
    };

    return Object.assign(memoized, { cache: cache });
}

// Inference test

// const test = memoizeDbFunction((_db: IDatabaseLike, a: number) => {
//     return a;
// });

// test(0 as any, 5);
// test(0 as any, "foo"); // This should give an error because "foo" is not a number
