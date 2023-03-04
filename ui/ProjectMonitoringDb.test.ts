import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { ProjectMonitoringDb } from "./ProjectMonitoringDb.ts";

Deno.test("ProjectMonitoringDb", () => {
    const db = new ProjectMonitoringDb();
    const timings = db._getTimings();
    assertEquals(timings, []);
});

Deno.test("getTimingsByClientAndProject", () => {
    const db = new ProjectMonitoringDb();
    db.addOrUpdateTiming({
        client: "client1",
        project: "project1",
        start: new Date(800000),
        end: new Date(900000),
    });
    db.addOrUpdateTiming({
        client: "client2",
        project: "project2",
        start: new Date(900000),
        end: new Date(950000),
    });
    const timings = db._getTimingsByClientAndProject({ client: "client2", project: "project2" });
    assertEquals(timings, [
        {
            client: "client2",
            project: "project2",
            start: new Date(900000),
            end: new Date(950000),
        },
    ]);
});

Deno.test("addOrUpdateTiming", () => {
    const db = new ProjectMonitoringDb();

    db.addOrUpdateTiming({
        client: "existing client",
        project: "existing projec",
        start: new Date(700000),
        end: new Date(800000),
    });

    // Notice in next two the start time is the same
    db.addOrUpdateTiming({
        client: "client1",
        project: "project1",
        start: new Date(800000),
        end: new Date(900000),
    });

    db.addOrUpdateTiming({
        client: "new client",
        project: "new project",
        start: new Date(800000),
        end: new Date(950000),
    });
    const timings = db._getTimings();

    // Only the last one is updated
    assertEquals(timings, [
        {
            client: "existing client",
            project: "existing projec",
            start: new Date(700000),
            end: new Date(800000),
        },
        {
            client: "new client",
            project: "new project",
            start: new Date(800000),
            end: new Date(950000),
        },
    ]);
});

Deno.test("deleteTimings", () => {
    const db = new ProjectMonitoringDb();

    db.addOrUpdateTiming({
        client: "existing client",
        project: "existing projec",
        start: new Date(700000),
        end: new Date(800000),
    });

    db.addOrUpdateTiming({
        client: "client1",
        project: "project1",
        start: new Date(800000),
        end: new Date(900000),
    });

    // Delete first one
    db._deleteTimings([
        {
            client: "existing client",
            project: "existing projec",
            start: new Date(700000),
            end: new Date(800000),
        },
    ]);

    const timings = db._getTimings();

    // Only the last one is left
    assertEquals(timings, [
        {
            client: "client1",
            project: "project1",
            start: new Date(800000),
            end: new Date(900000),
        },
    ]);
});