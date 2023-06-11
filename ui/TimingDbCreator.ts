import { createSchema, insertSummary, insertTimings } from "./TimingDb.ts";
import { createDatabase } from "./utils/Database.ts";

const DATABASE_PATH = "__TAURI__" in window ? "projects.db" : ":memory:";

export function createTimingDatabase() {
    return createDatabase(DATABASE_PATH, async (db) => {
        await createSchema(db);

        if (DATABASE_PATH === ":memory:") {
            // Insert mock data
            const now = new Date();
            const two_hours_ago = new Date(now.getTime() - 2 * 60 * 60 * 1000);
            const four_weeks_ago = new Date(now.getTime() - 4 * 7 * 24 * 60 * 60 * 1000);
            const four_weeks_ago_plus_2 = new Date(four_weeks_ago.getTime() + 2 * 60 * 60 * 1000);

            await insertTimings(db, [
                {
                    project: "Work",
                    client: "Desktop 1",
                    start: four_weeks_ago,
                    end: four_weeks_ago_plus_2,
                },
                {
                    project: "Work",
                    client: "Desktop 1",
                    start: two_hours_ago,
                    end: now,
                },
            ]);
        }
    });
}
