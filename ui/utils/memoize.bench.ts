import { memoize, makeKey, Symbols } from "./memoize.ts";

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
