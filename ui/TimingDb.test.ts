import { assertEquals, assertMatch } from "https://deno.land/std/assert/mod.ts";
import {
    createSchema,
    getDailyTotals,
    getSummaries,
    getDailySummary,
    getTimings,
    insertSummary,
    insertSummaryForDay,
    insertTimings,
} from "./TimingDb.ts";
import { DatabaseWasm } from "./utils/DatabaseWasm.ts";

async function testDb() {
    const db = new DatabaseWasm(":memory:");
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
    assertEquals(storedTimings, [
        {
            client: "Mega corp",
            project: "VR Glasses",
            start: new Date("2022-01-01 00:00"),
            end: new Date("2022-01-02 00:00"),
        },
        {
            client: "Acme Inc",
            project: "Secret Acme Car",
            start: new Date("2020-01-01 00:00"),
            end: new Date("2020-01-02 00:00"),
        },
    ]);
});

Deno.test("TimingDb insert timings, errors", async () => {
    const db = await testDb();
    const timings = [
        {
            client: "Mega corp",
            project: "VR Glasses",
            start: new Date("2022-01-01 00:00"),
            end: new Date("2022-01-02 00:00"),
        },
        {
            client: null as any,
            project: "Secret Acme Car",
            start: new Date("2020-01-01 00:00"),
            end: new Date("2020-01-02 00:00"),
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
    assertEquals(error.name, "SQLite3Error");
    assertMatch(error.message, /NOT NULL constraint failed: client.name/);

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
            client: "Mega corp",
            project: "VR Glasses",
            start: new Date("2022-01-01 11:00"),
            end: new Date("2022-01-01 12:00"),
        },
        {
            client: "Acme Inc",
            project: "Secret Acme Car",
            start: new Date("2020-01-01 12:00"),
            end: new Date("2020-01-01 13:00"),
        },
        {
            client: "Acme Inc",
            project: "Secret Acme Car",
            start: new Date("2020-01-01 17:00"),
            end: new Date("2020-01-01 18:00"),
        },
    ]);
    const storedTimings = await getDailyTotals(db, {
        from: new Date("2020-01-01 00:00"),
        to: new Date("2025-01-02 00:00"),
    });

    assertEquals(storedTimings, [
        {
            day: new Date("2022-01-01 00:00"),
            hours: 1,
            project: "VR Glasses",
            client: "Mega corp",
            summary: "",
        },
        {
            day: new Date("2020-01-01 00:00"),
            hours: 2,
            project: "Secret Acme Car",
            client: "Acme Inc",
            summary: "",
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

    // Get single summary
    const item = await getDailySummary(db, {
        client: "Acme Inc",
        project: "Secret Acme Car",
        day: new Date("2020-01-01 00:00"),
    });

    assertEquals(item, {
        archived: false,
        client: "Acme Inc",
        project: "Secret Acme Car",
        text: "Some text for a summary of days work",
    });
});

Deno.test("TimingDb dailyTotals", async () => {
    const db = await testDb();

    await insertTimings(db, [
        {
            client: "Acme Inc",
            project: "Secret Acme Car",
            start: new Date("2020-07-01 17:00"),
            end: new Date("2020-07-01 18:00"),
        },
        {
            client: "Acme Inc",
            project: "Secret Acme Car",
            start: new Date("2020-07-02 11:00"),
            end: new Date("2020-07-02 12:00"),
        },
        {
            client: "Acme Inc",
            project: "Secret Acme Car",
            start: new Date("2020-07-02 15:00"),
            end: new Date("2020-07-02 16:00"),
        },
        {
            client: "Acme Inc",
            project: "Secret Acme Car",
            start: new Date("2020-07-03 12:00"),
            end: new Date("2020-07-03 13:00"),
        },
    ]);

    await insertSummaryForDay(db, {
        client: "Acme Inc",
        project: "Secret Acme Car",
        day: new Date("2020-07-01 00:00"),
        summary: "Some text for a summary of days work",
    });

    await insertSummaryForDay(db, {
        client: "Acme Inc",
        project: "Secret Acme Car",
        day: new Date("2020-07-02 00:00"),
        summary: "Another text for a summary of days work",
    });

    const summaries = await getSummaries(db, {
        from: new Date("2020-06-01 00:00"),
        to: new Date("2025-01-02 00:00"),
    });

    assertEquals(summaries, [
        {
            archived: false,
            client: "Acme Inc",
            project: "Secret Acme Car",
            start: new Date("2020-07-02 00:00"),
            end: new Date("2020-07-03 00:00"),
            text: "Another text for a summary of days work",
        },
        {
            archived: false,
            client: "Acme Inc",
            project: "Secret Acme Car",
            start: new Date("2020-07-01 00:00"),
            end: new Date("2020-07-02 00:00"),
            text: "Some text for a summary of days work",
        },
    ]);

    // Get totals
    const totals = await getDailyTotals(db, {
        from: new Date("2020-07-01 00:00"),
        to: new Date("2025-01-02 00:00"),
    });

    assertEquals(totals, [
        {
            client: "Acme Inc",
            day: new Date("2020-07-03 00:00"),
            hours: 1,
            project: "Secret Acme Car",
            summary: "",
        },
        {
            client: "Acme Inc",
            day: new Date("2020-07-02 00:00"),
            hours: 2,
            project: "Secret Acme Car",
            summary: "Another text for a summary of days work",
        },
        {
            client: "Acme Inc",
            day: new Date("2020-07-01 00:00"),
            hours: 1,
            project: "Secret Acme Car",
            summary: "Some text for a summary of days work",
        },
    ]);
});
