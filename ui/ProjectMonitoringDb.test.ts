import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { ProjectMonitoringDb } from "./ProjectMonitoringDb.ts";

Deno.test("Totals update", () => {
    const app = new ProjectMonitoringDb();

    app.startTiming({ client: "client1", project: "project1" }, new Date(1999, 1, 1, 0));
    app.stopTiming(new Date(1999, 1, 1, 5));
    app.destroy();
    // assertEquals(totals, {
    //     todayTotal: 5,
    //     thisWeekTotal: 5,
    //     lastWeekTotal: 0,
    //     eightWeekTotal: 5,
    //     total: 5,
    // });
});

Deno.test("Totals update last week", () => {
    const app = new ProjectMonitoringDb();
    app.startTiming({ client: "client1", project: "project1" }, new Date(1999, 1, 1, 0));
    app.stopTiming(new Date(1999, 1, 1, 5));
    // const { totals } = app.getTotals(
    //     { client: "client1", project: "project1" },
    //     new Date(1999, 1, 1 + 8, 5)
    // );
    app.destroy();
    // assertEquals(totals, {
    //     todayTotal: 0,
    //     thisWeekTotal: 0,
    //     lastWeekTotal: 5,
    //     eightWeekTotal: 5,
    //     total: 5,
    // });
});
