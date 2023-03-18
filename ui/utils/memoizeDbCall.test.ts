import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { Symbols } from "./memoize.ts";
import { memoizeDbFunction, transaction } from "./memoizeDbCall.ts";

class Db {
    transaction<T>(fn: () => Promise<T>) {
        return fn();
    }
}

function map(...args: any[]) {
    return new Map(args);
}

Deno.test("memoizeDbFunction normal", async () => {
    // In this test we don't test transactionality, but the normal behavior without transaction

    const db = new Db();

    let numberOfTimesExecuted = 0;
    const getOrCreateItemToDb = memoizeDbFunction((db: Db, value: number) => {
        return db.transaction(() => {
            numberOfTimesExecuted++;
            return Promise.resolve(value + 10);
        });
    });

    const res1 = getOrCreateItemToDb(db, 5);
    const res2 = getOrCreateItemToDb(db, 5);
    const res3 = getOrCreateItemToDb(db, 4);
    const res4 = getOrCreateItemToDb(db, 4);

    const ref = (db as any)[Symbols.REF];
    assertEquals(numberOfTimesExecuted, 2);
    assertEquals(res1, res2);
    assertEquals(res3, res4);
    assertEquals(await res1, 15);
    assertEquals(await res2, 15);
    assertEquals(await res3, 14);
    assertEquals(await res4, 14);
    const REF = (db as any)[Symbols.REF];
    assertEquals(
        getOrCreateItemToDb.cache.contents(),
        map([0, map([`["${REF}",5]`, res1], [`["${REF}",4]`, res3])])
    );
});

Deno.test("memoizeDbFunction commit", async () => {
    const db = new Db();

    let numberOfTimesExecuted = 0;
    const getOrCreateItemToDb = memoizeDbFunction((db: Db, value: string) => {
        return db.transaction(() => {
            numberOfTimesExecuted++;
            return Promise.resolve(value);
        });
    });

    let promise2;
    const promise1 = getOrCreateItemToDb(db, "Hello");
    const value1 = await promise1;
    const transactionResult = await transaction(db, async () => {
        promise2 = getOrCreateItemToDb(db, " World");
        const REF = (db as any)[Symbols.REF];
        assertEquals(
            getOrCreateItemToDb.cache.contents(),
            map(
                [0, map([`["${REF}","Hello"]`, promise1])],
                [1, map([`["${REF}"," World"]`, promise2])]
            )
        );
        const value2 = await promise2;
        return value2;
    });

    // Value was committed
    const REF = (db as any)[Symbols.REF];
    assertEquals(
        getOrCreateItemToDb.cache.contents(),
        map([0, map([`["${REF}","Hello"]`, promise1], [`["${REF}"," World"]`, promise2])])
    );

    // Right value was returned
    assertEquals(value1, "Hello");
    assertEquals(transactionResult, " World");
});

Deno.test("memoizeDbFunction rollback", async () => {
    const db = new Db();

    let numberOfTimesExecuted = 0;
    const getOrCreateItemToDb = memoizeDbFunction((db: Db, value: string) => {
        return db.transaction(() => {
            numberOfTimesExecuted++;
            return Promise.resolve(value);
        });
    });

    const promise1 = getOrCreateItemToDb(db, "Hello");
    const value1 = await promise1;
    let error;
    try {
        const transactionResult = await transaction(db, async () => {
            const promise2 = getOrCreateItemToDb(db, " World");
            const REF = (db as any)[Symbols.REF];
            assertEquals(
                getOrCreateItemToDb.cache.contents(),
                map(
                    [0, map([`["${REF}","Hello"]`, promise1])],
                    [1, map([`["${REF}"," World"]`, promise2])]
                )
            );
            await promise2;
            throw new Error("Rollback");
        });
    } catch (e) {
        error = e;
    }

    // Value was not committed
    const REF = (db as any)[Symbols.REF];
    assertEquals(
        getOrCreateItemToDb.cache.contents(),
        map([0, map([`["${REF}","Hello"]`, promise1])])
    );

    // Right error was raised
    assertEquals(error.message, "Rollback");
});
