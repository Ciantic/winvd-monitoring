import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { memoizeTransaction, runMemoizeTransaction } from "./memoizeTransaction.ts";

class TransactionalDb {
    transaction<T>(fn: () => Promise<T>) {
        return fn();
    }
}

Deno.test("memoizeTransaction normal", async () => {
    // In this test we don't test transactionality, but the normal behavior without transaction

    const db = new TransactionalDb();

    let numberOfTimesExecuted = 0;
    const getOrCreateItemToDb = memoizeTransaction((db: TransactionalDb, value: number) => {
        return db.transaction(() => {
            numberOfTimesExecuted++;
            return Promise.resolve(value + 10);
        });
    });

    const res1 = getOrCreateItemToDb(db, 5);
    const res2 = getOrCreateItemToDb(db, 5);
    const res3 = getOrCreateItemToDb(db, 4);
    const res4 = getOrCreateItemToDb(db, 4);

    assertEquals(numberOfTimesExecuted, 2);
    assertEquals(res1, res2);
    assertEquals(res3, res4);
    assertEquals(await res1, 15);
    assertEquals(await res2, 15);
    assertEquals(await res3, 14);
    assertEquals(await res4, 14);
    assertEquals(
        [...getOrCreateItemToDb.cache.entries()],
        [
            ['["__ref1",5]', res1],
            ['["__ref1",4]', res3],
        ]
    );
});

Deno.test("memoizeTransaction commit", async () => {
    const db = new TransactionalDb();

    let numberOfTimesExecuted = 0;
    const getOrCreateItemToDb = memoizeTransaction((db: TransactionalDb, value: string) => {
        return db.transaction(() => {
            numberOfTimesExecuted++;
            return Promise.resolve(value);
        });
    });

    await getOrCreateItemToDb(db, "Hello");
    // await getOrCreateItemToDb(db, 5);

    const res = await runMemoizeTransaction(db, async () => {
        const v1 = await getOrCreateItemToDb(db, " World");
        return v1;
    });
    // await getOrCreateItemToDb(db, 4);

    // console.log(getOrCreateItemToDb.cache);

    // assertEquals(what, 9);
    // assertEquals(numberOfTimesExecuted, 2);
});

Deno.test("memoizeTransaction rollback", async () => {
    const transactionObject = new TransactionalDb();
    let numberOfTimesExecuted = 0;

    function getOrCreateItemToDb(db: TransactionalDb, value: number) {
        return db.transaction(() => {
            numberOfTimesExecuted++;
            return Promise.resolve(value);
        });
    }

    const memoized = memoizeTransaction(getOrCreateItemToDb);

    let error;
    try {
        await runMemoizeTransaction(transactionObject, async () => {
            await memoized(transactionObject, 5);
            throw new Error("Rollback");
        });
    } catch (e) {
        error = e;
    }

    await memoized(transactionObject, 5);

    assertEquals(error.message, "Rollback");
    assertEquals(numberOfTimesExecuted, 2);
});
