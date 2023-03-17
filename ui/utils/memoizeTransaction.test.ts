import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { TransactionalCache } from "./memoizeTransaction.ts";

Deno.test("transactional cache rollback", () => {
    const cache = new TransactionalCache();
    cache.set("foo", 1);
    assertEquals(cache.get("foo"), 1);
    let error;
    try {
        cache.transaction(() => {
            assertEquals(cache.get("foo"), 1);
            cache.set("foo", 3);
            cache.set("bar", 2);
            assertEquals(cache.get("foo"), 3);
            throw new Error("Rollback");
        });
    } catch (e) {
        error = e;
    }

    assertEquals(error.message, "Rollback");
    assertEquals(cache.get("foo"), 1);
    assertEquals(cache.get("bar"), undefined);
});

Deno.test("transactional cache commit", () => {
    const cache = new TransactionalCache();
    cache.set("foo", 1);
    assertEquals(cache.get("foo"), 1);
    cache.transaction(() => {
        assertEquals(cache.get("foo"), 1);
        cache.set("foo", 3);
        cache.set("bar", 2);
        assertEquals(cache.get("foo"), 3);
    });
    assertEquals(cache.get("foo"), 3);
    assertEquals(cache.get("bar"), 2);
});

Deno.test("transactional cache promise rollback", async () => {
    const cache = new TransactionalCache();
    cache.set("foo", 1);
    assertEquals(cache.get("foo"), 1);
    let error;
    try {
        await cache.transactionAsync(() => {
            assertEquals(cache.get("foo"), 1);
            cache.set("foo", 3);
            cache.set("bar", 2);
            assertEquals(cache.get("foo"), 3);
            throw new Error("Rollback");
        });
    } catch (e) {
        error = e;
    }

    assertEquals(error.message, "Rollback");
    assertEquals(cache.get("foo"), 1);
    assertEquals(cache.get("bar"), undefined);
});

Deno.test("transactional cache promise commit", async () => {
    const cache = new TransactionalCache();
    cache.set("foo", 1);
    assertEquals(cache.get("foo"), 1);
    await cache.transactionAsync(() => {
        assertEquals(cache.get("foo"), 1);
        cache.set("foo", 3);
        cache.set("bar", 2);
        assertEquals(cache.get("foo"), 3);
        return Promise.resolve();
    });
    assertEquals(cache.get("foo"), 3);
    assertEquals(cache.get("bar"), 2);
});
