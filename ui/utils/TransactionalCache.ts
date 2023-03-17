type Key = string | number;
type TransactionDepth = number;
type Cache = Map<Key, any>;

export class TransactionalCache {
    transactionDepth = 0;
    transactionMap = new Map<TransactionDepth, Cache>([[0, new Map()]]);
    private beginTransaction() {
        this.transactionDepth++;
    }
    private commit() {
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
    private rollback() {
        if (this.transactionDepth === 0) {
            throw new Error("No transaction to rollback");
        }
        this.transactionDepth--;
        this.transactionMap.delete(this.transactionDepth + 1);
    }

    transaction<T>(fn: () => T): T {
        this.beginTransaction();
        try {
            const result = fn();
            this.commit();
            return result;
        } catch (e) {
            this.rollback();
            throw e;
        }
    }

    async transactionAsync<T>(fn: () => Promise<T>): Promise<T> {
        this.beginTransaction();

        try {
            const res = await fn();
            this.commit();
            return res;
        } catch (e) {
            this.rollback();
            throw e;
        }
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
}
