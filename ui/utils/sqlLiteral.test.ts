import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { sql } from "./sqlLiteral.ts";

Deno.test("empty", () => {
    const query = sql``;
    assertEquals(query.sql, "");
    assertEquals(query.params, []);
});
Deno.test("no parameters", () => {
    const query = sql`SELECT * FROM table`;
    assertEquals(query.sql, "SELECT * FROM table");
    assertEquals(query.params, []);
});

Deno.test("add parameters", () => {
    const query = sql`SELECT * FROM table WHERE id = ${1}, name = ${"John"}`;
    assertEquals(query.sql, "SELECT * FROM table WHERE id = ?, name = ?");
    assertEquals(query.params, [1, "John"]);
});

Deno.test("add parameters with sql", () => {
    const query = sql`SELECT * FROM table WHERE ${sql`id = ${1}`}`;
    assertEquals(query.sql, "SELECT * FROM table WHERE id = ?");
    assertEquals(query.params, [1]);
});

Deno.test("add parameters null", () => {
    const query = sql`SELECT * FROM table WHERE ${undefined} id = ${1}`;
    assertEquals(query.sql, "SELECT * FROM table WHERE  id = ?");
    assertEquals(query.params, [1]);
});

Deno.test("parameter arrays", () => {
    const query = sql`SELECT * FROM table WHERE id IN ${[1, 2, 3]}`;
    assertEquals(query.sql, "SELECT * FROM table WHERE id IN (?,?,?)");
    assertEquals(query.params, [1, 2, 3]);
});

Deno.test("parameter arrays within arrays", () => {
    const query = sql`SELECT * FROM table WHERE id IN (${sql.values([1, 2, 3], [4, 5, 6])})`;
    assertEquals(query.sql, "SELECT * FROM table WHERE id IN (VALUES (?,?,?),(?,?,?))");
    assertEquals(query.params, [1, 2, 3, 4, 5, 6]);
});
