import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { sql } from "./sqlLiteral.ts";

Deno.test("empty", () => {
    const query = sql``;
    assertEquals(query.sql, "");
    assertEquals(query.params, []);
});
Deno.test("types", () => {
    const query = sql`
        ${0} ${1}
        ${true} ${false}
        ${null}
        ${""} ${"foo"}
        ${[1, 2, 3]}
    `;

    const match = `
        ? ?
        ? ?
        ?
        ? ?
        (?,?,?)
    `;
    // Trim white space from end of each line
    const value = query.sql.replace(/ +$/gm, "").trim();

    assertEquals(value, match.trim());
    assertEquals(query.params, [0, 1, true, false, null, "", "foo", 1, 2, 3]);
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
    const query = sql`SELECT * FROM table WHERE id = ${1}`;
    assertEquals(query.sql, "SELECT * FROM table WHERE id = ?");
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

Deno.test("conditional parts", () => {
    const someobject: { name?: string; project?: string; date?: Date } = {
        project: "Acme Inc",
    };
    const query = sql`
        SELECT * FROM table WHERE 1=1 
        ${sql.if`AND client  = ${someobject?.name}`}
        ${sql.if`AND project = ${someobject?.project}`}
        ${sql.if`AND date    = ${someobject?.date?.getTime()}`}
    `;
    // Trim and remove spaces from SQL query
    const value = query.sql.replace(/\s+/g, " ").trim();

    // Notice, only project is added to the query
    assertEquals(value, "SELECT * FROM table WHERE 1=1 AND project = ?");
    assertEquals(query.params, ["Acme Inc"]);
});
