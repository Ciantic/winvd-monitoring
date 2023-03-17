// deno-lint-ignore-file no-explicit-any

import { assertEquals, assert } from "https://deno.land/std/testing/asserts.ts";
import { memoize, makeKey, Symbols } from "./memoize.ts";

Deno.test("memoize makeKey", () => {
    assertEquals(makeKey(), 0);
    assertEquals(makeKey(1), 1);
    assertEquals(makeKey("foo"), "foo");
    assertEquals(makeKey(undefined), "__undefined");
    assertEquals(makeKey(null), "__null");
    assertEquals(makeKey(true), "__true");
    assertEquals(makeKey(false), "__false");
    assertEquals(makeKey(1, 2, 3), "[1,2,3]");
    assertEquals(makeKey("foo", 2, 3), '["foo",2,3]');
    assertEquals(makeKey({ bar: 5 }), '__{"bar":5}');
    assertEquals(makeKey({ baz: 5 }, { bar: 12 }), '["__{\\"baz\\":5}","__{\\"bar\\":12}"]');
    class Foo {
        constructor(public bar: number) {}
    }
    const foo1 = new Foo(1);
    const foo2 = new Foo(2);
    assertEquals(makeKey(foo1), "__ref1");
    assertEquals(makeKey(foo1), "__ref1");
    assertEquals(makeKey(foo2), "__ref2");
    assertEquals(makeKey(foo2), "__ref2");
});

Deno.test("memoize", () => {
    const memoized = memoize(function (a: number, b: number) {
        return a + b;
    });

    assertEquals(memoized(1, 2), 3);
    assertEquals(memoized(1, 2), 3);
    assertEquals([...memoized.cache.entries()], [["[1,2]", 3]]);
});

Deno.test("memoize unary", () => {
    const memoized = memoize(function (a: number) {
        return a + 10;
    });

    assertEquals(memoized(1), 11);
    assertEquals(memoized(1), 11);
    assertEquals([...memoized.cache.entries()], [[1, 11]]);
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
    const foo2 = new Foo(2);
    const value2 = memoized(foo2);
    const value3 = memoized(foo1);

    assertEquals(value1, 124);
    assertEquals(value2, 125);
    assertEquals(value3, 124);
    assertEquals(
        [...memoized.cache.entries()],
        [
            [(foo1 as any)[Symbols.REF], 124],
            [(foo2 as any)[Symbols.REF], 125],
        ]
    );
});
Deno.test("memoize reference for classes", () => {
    class Foo {
        constructor(public bar: number) {}
    }

    const memoized = memoize(function (foo: Foo, n: number) {
        return 123 + foo.bar;
    });

    const foo1 = new Foo(1);
    const value1 = memoized(foo1, 2);
    const foo2 = new Foo(2);
    const value2 = memoized(foo2, 2);
    const value3 = memoized(foo1, 2);

    assertEquals(value1, 124);
    assertEquals(value2, 125);
    assertEquals(value3, 124);
    const key1 = JSON.stringify([(foo1 as any)[Symbols.REF], 2]);
    const key2 = JSON.stringify([(foo2 as any)[Symbols.REF], 2]);
    assertEquals(
        [...memoized.cache.entries()],
        [
            [key1, 124],
            [key2, 125],
        ]
    );
});

Deno.test("memoize promise no duplicates", async () => {
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
    assertEquals([...memoized.cache.entries()], [[0, value1]]);
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
    assertEquals([...memoized.cache.entries()], []);
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
    assert(memoized.cache.get(Symbols.CACHE_TRUE) === promise, "cache");
});

const memoized = memoize(function (a: number) {
    return a ** 10;
});
Deno.bench("memoize", () => {
    memoized(123);
});

const notmemoize = function (a: number) {
    return a ** 10;
};
Deno.bench("notmemoize", () => {
    notmemoize(123);
});
