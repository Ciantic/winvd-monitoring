import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { TimingDb } from "./TimingDb.ts";
import Database, { IDatabase, QueryResult } from "./utils/sqlPlugin.ts";
import { DB, QueryParameter } from "https://deno.land/x/sqlite/mod.ts";

class DenoDatabase implements IDatabase {
    private path: string;
    private db: DB;

    constructor(path: string) {
        this.path = path;
        this.db = new DB(path);
    }
    execute(query: string, bindValues?: unknown[]): Promise<QueryResult> {
        this.db.query(query, bindValues as QueryParameter[]);
        return Promise.resolve({
            lastInsertId: this.db.lastInsertRowId,
            rowsAffected: this.db.totalChanges,
        });
    }
    select<T>(query: string, bindValues?: unknown[]): Promise<T> {
        return Promise.resolve(this.db.query(query, bindValues as QueryParameter[]) as T);
    }
    close(): Promise<boolean> {
        this.db.close();
        return Promise.resolve(true);
    }
}

function factory() {
    return new DenoDatabase(":memory:");
}

Deno.test("Create schema", async () => {
    const db = new TimingDb(":memory:", factory);
    await db.createSchema();
});

Deno.test("Insert clients", async () => {
    const db = new TimingDb(":memory:", factory);
    await db.createSchema();
    const ids = await db.__insertClients(["First", "Second"]);

    assertEquals(ids, {
        First: 1,
        Second: 2,
    });

    // Ensure that second call returns IDs as well
    const ids2 = await db.__insertClients(["First", "Second"]);
    assertEquals(ids2, {
        First: 1,
        Second: 2,
    });
});

Deno.test("Insert clients and projects", async () => {
    const db = new TimingDb(":memory:", factory);
    await db.createSchema();
    const ids = await db.__insertClientsAndProjects([
        {
            client: "Acme Inc",
            project: "Secret Acme Car",
        },
        {
            client: "Acme Inc",
            project: "VR Product",
        },
        {
            client: "Acme Inc",
            project: "VR Product",
        },
        {
            client: "Acme Inc",
            project: "VR Product",
        },
        {
            client: "Megacorp Inc",
            project: "Thingamabob",
        },
    ]);
    assertEquals(ids, {
        "Acme Inc": { "Secret Acme Car": 1, "VR Product": 2 },
        "Megacorp Inc": { Thingamabob: 5 },
    });
});

Deno.test("Insert timings", async () => {
    const db = new TimingDb(":memory:", factory);
    await db.createSchema();

    let timings = [
        {
            client: "Acme Inc",
            project: "Secret Acme Car",
            start: new Date("2020-01-01"),
            end: new Date("2020-01-02"),
        },
        {
            client: "Mega corp",
            project: "VR Glasses",
            start: new Date("2022-01-01"),
            end: new Date("2022-01-02"),
        },
    ];

    await db.insertTimings(timings);
    const storedTimings = await db.getTimings();
    assertEquals(timings, storedTimings);
});

Deno.test("Daily totals", async () => {
    const db = new TimingDb(":memory:", factory);
    await db.createSchema();

    let timings = [
        {
            client: "Acme Inc",
            project: "Secret Acme Car",
            start: new Date("2020-01-01"),
            end: new Date("2020-01-02"),
        },
        {
            client: "Mega corp",
            project: "VR Glasses",
            start: new Date("2022-01-01"),
            end: new Date("2022-01-04"),
        },
    ];

    await db.insertTimings(timings);
    const storedTimings = await db.dailyTotals({
        from: new Date("2020-01-01"),
        to: new Date("2025-01-02"),
    });

    console.log(storedTimings);
    // TODO: !!!!!!!!
});
