import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { ProjectMonitoringDb, Timing } from "./ProjectMonitoringDb.ts";

Deno.test("Timings stored", () => {
    const app = new ProjectMonitoringDb();
    const timings: Timing[] = [];
    app.onInsertTiming.addListener((timing) => {
        timings.push(timing);
    });
    app.startTiming({ client: "client1", project: "project1" }, new Date(1999, 1, 1, 0));
    app.stopTiming(new Date(1999, 1, 1, 5));
    app.destroy();
    assertEquals(timings, [
        {
            client: "client1",
            project: "project1",
            start: new Date(1999, 1, 1, 0),
            end: new Date(1999, 1, 1, 5),
        },
    ]);
});
