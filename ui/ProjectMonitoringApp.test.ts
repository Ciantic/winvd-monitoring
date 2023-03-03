import { assert, assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { autorun } from "https://esm.sh/mobx";
import { ProjectMonitoringApp } from "./ProjectMonitoringApp.ts";

Deno.test("Change client", () => {
    const names = [] as string[];
    const app = new ProjectMonitoringApp();
    autorun(() => {
        const values = app.render();
        names.push(values.clientName);
    });
    app.onChangeClient("client1");
    assertEquals(names, ["", "client1"]);
    app.destroy();
});
