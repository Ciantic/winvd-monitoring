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

import { ICache, memoizeWithCache, __makeKey } from "./memoize.ts";

interface Transaction {
    __beginTransaction(): void;
    __commitTransaction(): void;
    __rollbackTransaction(): void;
}

function transaction<T>(trans: Transaction, fn: () => T): T {
    trans.__beginTransaction();
    try {
        const result = fn();
        trans.__commitTransaction();
        return result;
    } catch (e) {
        trans.__rollbackTransaction();
        throw e;
    }
}

async function transactionAsync<T>(trans: Transaction, fn: () => Promise<T>): Promise<T> {
    trans.__beginTransaction();

    try {
        const res = await fn();
        trans.__commitTransaction();
        return res;
    } catch (e) {
        trans.__rollbackTransaction();
        throw e;
    }
}

type Key = string | number;
type TransactionDepth = number;
type Cache = Map<Key, any>;
export class TransactionalCache implements Transaction, ICache {
    transactionDepth = 0;
    transactionMap = new Map<TransactionDepth, Cache>([[0, new Map()]]);
    __beginTransaction() {
        this.transactionDepth++;
    }
    __commitTransaction() {
        if (this.transactionDepth === 0) {
            throw new Error("No transaction to commit");
        }
        this.transactionDepth--;
        const committed = this.transactionMap.get(this.transactionDepth + 1);
        const current = this.transactionMap.get(this.transactionDepth);
        if (committed && current) {
            for (const [key, value] of committed) {
                current.set(key, value);
            }
        }
        this.transactionMap.delete(this.transactionDepth + 1);
    }
    __rollbackTransaction() {
        if (this.transactionDepth === 0) {
            throw new Error("No transaction to rollback");
        }
        this.transactionDepth--;
        this.transactionMap.delete(this.transactionDepth + 1);
    }
    transaction = <T>(fn: () => T) => transaction(this, fn);
    transactionAsync = <T>(fn: () => Promise<T>) => transactionAsync(this, fn);

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
}

export class TransactionalMemoize implements Transaction {
    private cache = new Map<symbol, TransactionalCache>();

    __beginTransaction() {
        for (const cache of this.cache.values()) {
            cache.__beginTransaction();
        }
    }
    __commitTransaction() {
        for (const cache of this.cache.values()) {
            cache.__commitTransaction();
        }
    }
    __rollbackTransaction() {
        for (const cache of this.cache.values()) {
            cache.__rollbackTransaction();
        }
    }

    transaction = <T>(fn: () => T) => transaction(this, fn);
    transactionAsync = <T>(fn: () => Promise<T>) => transactionAsync(this, fn);

    memoize = <R, T extends (this: void, ...args: any[]) => R>(fn: T) => {
        const symbol = Symbol();
        let cache = this.cache.get(symbol);
        if (!cache) {
            cache = new TransactionalCache();
            this.cache.set(symbol, cache);
        }

        const memoized = memoizeWithCache(cache, fn);
        return Object.assign(memoized, { cache });
    };
}

type MemoizeStore<T> = T & {
    [k: symbol]: TransactionalCache | undefined;
};

export function memoize<C, R, T extends (this: void, arg: MemoizeStore<C>, ...args: any[]) => R>(
    fn: T
) {
    const symCache = Symbol();
    return function (this: any, arg: MemoizeStore<C>, ...args: any[]) {
        let cache = arg[symCache];
        if (!cache) {
            cache = new TransactionalCache();
            (arg as any)[symCache] = cache;
        }
        const key = __makeKey(...arguments);
        const value = cache.get(key);
        if (value !== undefined) {
            return value;
        }
        const result = fn.call(undefined, arg, ...args);

        return null as R;
    } as {
        (...args: Parameters<T>): ReturnType<T>;
    };
}
