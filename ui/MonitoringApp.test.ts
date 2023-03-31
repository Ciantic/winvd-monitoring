import { assert, assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { autorun } from "https://esm.sh/mobx";
import { MonitoringApp } from "./MonitoringApp.ts";

/*
Deno.test("Change client", () => {
    const names = [] as string[];
    const app = new MonitoringApp();
    const rend = app.render();
    autorun(() => {
        names.push(app.render().clientName);
    });
    rend.onChangeClient("client1");
    app.destroy();
    assertEquals(names, ["", "client1"]);
});
Deno.test("Will this start?", () => {
    const app = new MonitoringApp();
    const rend = app.render();
    rend.onChangeClient("client1");
    rend.onChangeProject("project1");
    const rend2 = app.render();
    const isRunning = rend2.isRunning;
    app.destroy();
    if (isRunning === false) {
        throw new Error("Not running");
    }
});
*/
