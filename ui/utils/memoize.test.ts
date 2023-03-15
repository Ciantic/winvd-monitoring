import { assertEquals, assert } from "https://deno.land/std/testing/asserts.ts";
import { memoize } from "./memoize.ts";

Deno.test("memoize", () => {
    const memoized = memoize(function (a: number, b: number) {
        return a + b;
    });

    assertEquals(memoized(1, 2), 3);
    assertEquals(memoized(1, 2), 3);
    assertEquals(memoized.cache, { "[1,2]": 3 });
});

Deno.test("memoize unary", () => {
    const memoized = memoize(function (a: number) {
        return a + 10;
    });

    assertEquals(memoized(1), 11);
    assertEquals(memoized(1), 11);
    assertEquals(memoized.cache, { 1: 11 });
});

Deno.test("memoize frozen object", () => {
    const memoized = memoize(function (baz: number) {
        return {
            foo: "bar",
            bar: baz,
        };
    });

    const isFrozen = memoized(55);
    assert(Object.isFrozen(isFrozen), "isFrozen");

    assertEquals(memoized(55), {
        foo: "bar",
        bar: 55,
    });
    assertEquals(memoized(55), {
        foo: "bar",
        bar: 55,
    });
});
Deno.test("memoize reference for classes", () => {
    class Foo {
        constructor(public bar: number) {}
    }

    const memoized = memoize(function (foo: Foo) {
        return 123 + foo.bar;
    });

    const foo1 = new Foo(1);
    const value1 = memoized(foo1);
    const value2 = memoized(new Foo(2));
    const value3 = memoized(foo1);

    assertEquals(value1, 124);
    assertEquals(value2, 125);
    assertEquals(value3, 124);
    assertEquals(memoized.cache, { 1: 124, 2: 125 });
});

Deno.test("memoize promise", async () => {
    let n = 0;
    const memoized = memoize(function () {
        return Promise.resolve(++n);
    });

    const value1 = memoized();
    const value2 = memoized();
    const value3 = memoized();
    assertEquals(await value1, 1);
    assertEquals(await value2, 1);
    assertEquals(await value3, 1);
    assertEquals(memoized.cache, { 0: value1 });
});

Deno.test("memoize catch", async () => {
    const memoized = memoize(function () {
        return Promise.reject("error");
    });

    let error;
    try {
        await memoized();
    } catch (e) {
        error = e;
    }
    assertEquals(error, "error");
    assertEquals(memoized.cache, {});
});

Deno.test("memoize promise", async () => {
    const memoized = memoize(function (accept: boolean) {
        if (accept) {
            return Promise.resolve("success");
        } else {
            return Promise.resolve("error");
        }
    });

    const promise = memoized(true);
    const value = await promise;
    assertEquals(value, "success");
    assert(memoized.cache[1] === promise, "cache");
});
