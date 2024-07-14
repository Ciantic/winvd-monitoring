import { assertEquals } from "https://deno.land/std/assert/mod.ts";
import { formatDateRange, parseDateRange } from "./formatDate.ts";

Deno.test("parseDateRange two full dates", () => {
    assertEquals(parseDateRange("1.1.2020-31.12.2020"), {
        from: new Date("2020-01-01 00:00:00"),
        to: new Date("2020-12-31 23:59:59.999"),
    });
});

Deno.test("parseDateRange two dates without years", () => {
    assertEquals(parseDateRange("1.1.-31.12."), {
        from: new Date(`${new Date().getFullYear()}-01-01 00:00:00`),
        to: new Date(`${new Date().getFullYear()}-12-31 23:59:59.999`),
    });
});

Deno.test("parseDateRange start date without year, end with year", () => {
    assertEquals(parseDateRange("1.1.-31.12.2020"), {
        from: new Date(`2020-01-01 00:00:00`),
        to: new Date(`2020-12-31 23:59:59.999`),
    });
});

Deno.test("parseDateRange single day with year", () => {
    assertEquals(parseDateRange("1.1.2020"), {
        from: new Date(`2020-01-01 00:00:00`),
        to: new Date(`2020-01-01 23:59:59.999`),
    });
});

Deno.test("parseDateRange single day without year", () => {
    assertEquals(parseDateRange("1.1."), {
        from: new Date(`${new Date().getFullYear()}-01-01 00:00:00`),
        to: new Date(`${new Date().getFullYear()}-01-01 23:59:59.999`),
    });
});

Deno.test("parseDateRange single day with dash at the end", () => {
    assertEquals(parseDateRange("1.5.-"), {
        from: new Date(`${new Date().getFullYear()}-05-01 00:00:00`),
    });
});

Deno.test("formatDateRange within same year", () => {
    assertEquals(
        formatDateRange({
            from: new Date("2020-01-01 00:00:00"),
            to: new Date("2020-12-31 23:59:59.999"),
        }),
        "1.1.-31.12.2020"
    );
});

Deno.test("formatDateRange two different years", () => {
    assertEquals(
        formatDateRange({
            from: new Date("2019-01-01 00:00:00"),
            to: new Date("2020-01-01 23:59:59.999"),
        }),
        "1.1.2019-1.1.2020"
    );
});

Deno.test("formatDateRange single day", () => {
    assertEquals(
        formatDateRange({
            from: new Date("2020-01-01 00:00:00"),
            to: new Date("2020-01-01 23:59:59.999"),
        }),
        "1.1.2020"
    );
});

Deno.test("formatDateRange current year, same day", () => {
    const currentYear = new Date().getFullYear();
    assertEquals(
        formatDateRange({
            from: new Date(`${currentYear}-01-01 00:00:00`),
            to: new Date(`${currentYear}-01-01 23:59:59.999`),
        }),
        "1.1."
    );
});

Deno.test("formatDateRange current year different dates", () => {
    const currentYear = new Date().getFullYear();
    assertEquals(
        formatDateRange({
            from: new Date(`${currentYear}-01-01 00:00:00`),
            to: new Date(`${currentYear}-12-31 23:59:59.999`),
        }),
        "1.1.-31.12."
    );
});
