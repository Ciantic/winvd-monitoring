import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { TimingDb } from "./TimingDb.ts";
import { DatabaseDeno } from "./utils/DatabaseDeno.ts";

function factory() {
    return new DatabaseDeno(":memory:");
}

Deno.test("Create schema", async () => {
    const db = new TimingDb(":memory:", factory);
    await db.init();
});

Deno.test("Insert clients", async () => {
    const db = new TimingDb(":memory:", factory);
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

    await db.insertTimings(timings);
    const storedTimings = await db.getTimings();
    assertEquals(timings, storedTimings);
});

Deno.test("Daily totals", async () => {
    const db = new TimingDb(":memory:", factory);

    await db.insertTimings([
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
    const storedTimings = await db.getDailyTotals({
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
