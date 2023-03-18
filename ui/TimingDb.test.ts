import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import {
    createSchema,
    getDailyTotals,
    getSummaries,
    getTimings,
    insertSummary,
    insertTimings,
} from "./TimingDb.ts";
import { DatabaseDeno } from "./utils/DatabaseDeno.ts";

async function testDb() {
    const db = new DatabaseDeno(":memory:");
    await createSchema(db);
    return db;
}

Deno.test("TimingDb create schema", async () => {
    await testDb();
});

Deno.test("TimingDb insert timings", async () => {
    const db = await testDb();
    const timings = [
        {
            client: "Acme Inc",
            project: "Secret Acme Car",
            start: new Date("2020-01-01 00:00"),
            end: new Date("2020-01-02 00:00"),
        },
        {
            client: "Mega corp",
            project: "VR Glasses",
            start: new Date("2022-01-01 00:00"),
            end: new Date("2022-01-02 00:00"),
        },
    ];
    await insertTimings(db, timings);
    const storedTimings = await getTimings(db);
    assertEquals(timings, storedTimings);
});

Deno.test("TimingDb insert timings, errors", async () => {
    const db = await testDb();
    const timings = [
        {
            client: null as any,
            project: "Secret Acme Car",
            start: new Date("2020-01-01 00:00"),
            end: new Date("2020-01-02 00:00"),
        },
        {
            client: "Mega corp",
            project: "VR Glasses",
            start: new Date("2022-01-01 00:00"),
            end: new Date("2022-01-02 00:00"),
        },
    ];

    let error;
    try {
        await insertTimings(db, timings);
    } catch (e) {
        error = e;
    }
    const storedTimings = await getTimings(db);
    assertEquals([], storedTimings);
    assertEquals(error.message, "NOT NULL constraint failed: client.name");

    // Ensure no transaction was not left unfinished and try insert again, it should work

    const timings2 = [
        {
            client: "Acme Inc",
            project: "Secret Acme Car",
            start: new Date("2020-01-01 00:00"),
            end: new Date("2020-01-02 00:00"),
        },
    ];
    await insertTimings(db, timings2);
    const storedTimings2 = await getTimings(db);
    assertEquals(timings2, storedTimings2);
});

Deno.test("TimingDb daily totals", async () => {
    const db = await testDb();

    await insertTimings(db, [
        {
            client: "Acme Inc",
            project: "Secret Acme Car",
            start: new Date("2020-01-01 17:00"),
            end: new Date("2020-01-01 18:00"),
        },
        {
            client: "Acme Inc",
            project: "Secret Acme Car",
            start: new Date("2020-01-01 12:00"),
            end: new Date("2020-01-01 13:00"),
        },
        {
            client: "Mega corp",
            project: "VR Glasses",
            start: new Date("2022-01-01 11:00"),
            end: new Date("2022-01-01 12:00"),
        },
    ]);
    const storedTimings = await getDailyTotals(db, {
        from: new Date("2020-01-01 00:00"),
        to: new Date("2025-01-02 00:00"),
    });

    assertEquals(storedTimings, [
        { day: new Date("2022-01-01 00:00"), hours: 1, project: "VR Glasses", client: "Mega corp" },
        {
            day: new Date("2020-01-01 00:00"),
            hours: 2,
            project: "Secret Acme Car",
            client: "Acme Inc",
        },
    ]);
});

Deno.test("TimingDb insert and get summary", async () => {
    const db = await testDb();
    const storedSummary = {
        archived: false,
        client: "Acme Inc",
        project: "Secret Acme Car",
        start: new Date("2020-01-01 00:00"),
        end: new Date("2020-01-02 00:00"),
        text: "Some text for a summary of days work",
    };
    await insertSummary(db, storedSummary);

    const summaries = await getSummaries(db, {
        from: new Date("2020-01-01 00:00"),
        to: new Date("2025-01-02 00:00"),
    });

    assertEquals(summaries, [storedSummary]);
});
