import { assertEquals } from "https://deno.land/std/assert/mod.ts";
import { TimingRecorder, Timing } from "./TimingRecorder.ts";

Deno.test("Timings stored", () => {
    const app = new TimingRecorder(false);
    const timings: Timing[] = [];
    app.onInsertTiming.addListener((timing) => {
        timings.push(timing);
    });
    app.start({ client: "client1", project: "project1" }, new Date(1999, 1, 1, 0));
    app.stop(new Date(1999, 1, 1, 5));
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

Deno.test("Timings keepalive", () => {
    const app = new TimingRecorder(true, () => Promise.resolve(), new Date(1000000));
    const timings: Timing[] = [];
    app.onInsertTiming.addListener((timing) => {
        timings.push(timing);
    });
    app.start({ client: "client1", project: "project1" }, new Date(1000000));

    (app as any).keepAlive(new Date(1030000));
    (app as any).keepAlive(new Date(1060000));
    (app as any).keepAlive(new Date(1090000));

    // Here is a gap, because it's greater than a minute

    (app as any).keepAlive(new Date(2000000));
    (app as any).keepAlive(new Date(2030000));
    // It ends here, because this gap is greater than a minute
    app.stop(new Date(3000000));

    app.destroy();
    assertEquals(timings, [
        {
            client: "client1",
            project: "project1",
            start: new Date(1000000),
            end: new Date(1090000),
        },
        {
            client: "client1",
            project: "project1",
            start: new Date(2000000),
            end: new Date(2030000),
        },
    ]);
});
