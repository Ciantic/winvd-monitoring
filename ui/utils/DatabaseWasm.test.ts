import { assertEquals } from "https://deno.land/std/assert/mod.ts";
import { DatabaseWasm } from "./DatabaseWasm.ts";

async function createTestTable() {
    const db = new DatabaseWasm(":memory:");
    await db.execute(
        "CREATE TABLE person (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER)"
    );
    await db.execute("INSERT INTO person (name, age) VALUES (?, ?), (?, ?)", [
        "Bob",
        42,
        "Alice",
        42,
    ]);
    return db;
}

Deno.test("DatabaseWasm create database", async () => {
    const db = new DatabaseWasm(":memory:");
    await db.execute(
        "CREATE TABLE person (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER)"
    );
    const res = await db.execute("INSERT INTO person (name, age) VALUES (?, ?), (?, ?)", [
        "Bob",
        42,
        "Alice",
        42,
    ]);
    assertEquals(res.lastInsertId, 2);
    assertEquals(res.rowsAffected, 2);
    await db.close();
});

Deno.test("DatabaseWasm select objects", async () => {
    const db = await createTestTable();

    const rows = await db.select<{
        id: number;
        name: string;
        age: number;
    }>("SELECT * FROM person where ID IN (?,?)", [1, 2]);
    assertEquals(rows, [
        { id: 1, name: "Bob", age: 42 },
        { id: 2, name: "Alice", age: 42 },
    ]);
    await db.close();
});

Deno.test("DatabaseWasm select yield", async () => {
    const db = await createTestTable();

    type Person = {
        id: number;
        name: string;
        age: number;
    };

    const rows: Person[] = [];
    const iterator = db.selectYield<Person>("SELECT * FROM person where id IN (?,?)", [1, 2]);
    for await (const row of iterator) {
        rows.push(row);
    }
    assertEquals(rows, [
        { id: 1, name: "Bob", age: 42 },
        { id: 2, name: "Alice", age: 42 },
    ]);
    await db.close();
});
