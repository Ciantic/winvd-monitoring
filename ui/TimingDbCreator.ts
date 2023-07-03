import {
    createSchema,
    getDailyTotals,
    getTimings,
    insertSummaryForDay,
    insertTimings,
} from "./TimingDb.ts";
import { createDatabase } from "./utils/Database.ts";

const DATABASE_PATH = "__TAURI__" in window ? "projects.db" : "file:local?vfs=kvvfs";
const INSERT_MOCK_DATA = "__TAURI__" in window ? false : true;

// Floating point number generator from: https://github.com/bryc/code/blob/master/jshash/PRNGs.md
function xoshiro128p(a: number, b: number, c: number, d: number) {
    // prettier-ignore
    return function() {
        const t = b << 9, r = a + d;
        c = c ^ a; d = d ^ b; b = b ^ c; a = a ^ d; c = c ^ t;
        d = d << 11 | d >>> 21;
        return (r >>> 0) / 4294967296;
    }
}

function generateTimingsForDay(rng: () => number, day: Date) {
    const results = [] as { start: Date; end: Date }[];
    let start = new Date(day);
    // Increment start by one day
    start.setDate(start.getDate() + 1);

    // Start always at 8am
    start.setHours(8, 0, 0, 0);

    for (let j = 0; j < 10000; j++) {
        // Skip randomly 1 to 4 minutes
        start = new Date(start.getTime() + (1 + rng() * 3) * 60 * 1000);

        // If past 17:00 go to next day
        if (start.getHours() >= 17) {
            break;
        }

        // Create timing 7 to 15 minutes randomly
        const end = new Date(start.getTime() + (7 + rng() * 8) * 60 * 1000);
        results.push({ start, end });
        start = new Date(end);
    }
    return results;
}

function generateClientAndProjectNames(rng: () => number) {
    const clientsAndProjects = {
        "Acme Inc": ["Secret Car", "Rocket"],
        MegaCorp: ["The App"],
        Myself: ["Emails", "General"],
    };

    const clients = Object.keys(clientsAndProjects);
    const client = clients[Math.floor(rng() * clients.length)] as keyof typeof clientsAndProjects;
    const projects = clientsAndProjects[client];
    const project = projects[Math.floor(rng() * projects.length)];
    return { client, project };
}

function generateSummaryNames(rng: () => number) {
    const summaries = [
        "Billed",
        "Worked on the feature",
        "Bug #132 was fixed",
        "Meeting with the team",
        "Planning",
        "Database work",
    ];
    return summaries[Math.floor(rng() * summaries.length)];
}

export function createTimingDatabase() {
    return createDatabase(DATABASE_PATH, async (db) => {
        await createSchema(db);

        if (INSERT_MOCK_DATA) {
            const rng = xoshiro128p(1234, 5678, 9123, 101010);

            // Insert mock data
            const offsetEnd = new Date();
            const offsetStart = new Date(offsetEnd.getTime() - 30 * 7 * 24 * 3600 * 1000);

            // Determine if any of the tables: summary, timing, client or project non-empty
            const counter = await db.select<{ count: number }>(
                "SELECT COUNT(*) AS count FROM summary, timing, client, project"
            );

            if (counter[0].count) {
                console.log("Database already contains data, skipping mock data generation");
                return;
            }

            const timings = [] as { start: Date; end: Date; client: string; project: string }[];
            const summaries = [] as {
                day: Date;
                client: string;
                project: string;
                summary: string;
            }[];

            // Iterate days between offsetStart and offsetEnd
            const days = (offsetEnd.getTime() - offsetStart.getTime()) / (24 * 60 * 60 * 1000);
            for (let i = 0; i < days; i++) {
                const day = new Date(offsetStart.getTime() + i * 24 * 60 * 60 * 1000);
                const uniqueClientsAndProjects = new Set<string>();
                for (const timing of generateTimingsForDay(rng, day)) {
                    const { client, project } = generateClientAndProjectNames(rng);
                    timings.push({ ...timing, client, project });
                    uniqueClientsAndProjects.add(`${client}/${project}`);
                }

                // Take randomly two clients and projects
                const clientsAndProjects = Array.from(uniqueClientsAndProjects).slice(0, 2);
                for (const clientAndProject of clientsAndProjects) {
                    const [client, project] = clientAndProject.split("/");
                    const summary = generateSummaryNames(rng);
                    summaries.push({ day, client, project, summary });
                }
            }

            console.log("Insert timings", timings.length);
            console.log("Insert summaries", summaries.length);
            await insertTimings(db, timings);
            for (const summary of summaries) await insertSummaryForDay(db, summary);
            console.log("Mock data generation finished");
        }
    });
}
