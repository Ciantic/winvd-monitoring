import { sql } from "./utils/sqlLiteral.ts";
import { IDatabase } from "./utils/Database.ts";
import { transaction, memoizeDbFunction } from "./utils/memoizeDbCall.ts";

export interface Timing {
    client: string;
    project: string;
    start: Date;
    end: Date;
}

export interface Summary {
    start: Date;
    end: Date;
    text: string;
    project: string;
    client: string;
    archived: boolean;
}

const CLIENT_SCHEMA = sql`
    CREATE TABLE IF NOT EXISTS client (
        id   INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        name TEXT NOT NULL,
        CONSTRAINT UQ_CLIENT_NAME UNIQUE (name)
    ) STRICT;
`;

const PROJECT_SCHEMA = sql`
    CREATE TABLE IF NOT EXISTS project (
        id       INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        name     TEXT NOT NULL,
        clientId INTEGER NOT NULL,
        CONSTRAINT UQ_CLIENT_PROJECT_NAME UNIQUE (name, clientId),
        CONSTRAINT FK_PROJECT_CLIENT_ID FOREIGN KEY (clientId)
        REFERENCES client (id) ON DELETE NO ACTION
                               ON UPDATE NO ACTION
    ) STRICT;
`;

const SUMMARY_SCHEMA = sql`
    CREATE TABLE IF NOT EXISTS summary (
        id        INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        archived  INT NOT NULL, -- BOOLEAN
        start     INTEGER NOT NULL, -- Unix timestamp in milliseconds
        [end]     INTEGER NOT NULL, -- Unix timestamp in milliseconds
        text      TEXT NOT NULL,
        projectId INTEGER NOT NULL,
        CONSTRAINT UQ_CLIENT_PROJECT_NAME UNIQUE (projectId, start, [end]),
        CONSTRAINT FK_SUMMARY_PROJECT_ID FOREIGN KEY (projectId)
        REFERENCES project (id) ON DELETE NO ACTION
                                ON UPDATE NO ACTION
    ) STRICT;
`;

const TIMING_SCHEMA = sql`
    CREATE TABLE IF NOT EXISTS timing (
        id        INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        start     INTEGER NOT NULL, -- Unix timestamp in milliseconds
        [end]     INTEGER NOT NULL, -- Unix timestamp in milliseconds
        projectId INTEGER NOT NULL,
        CONSTRAINT UQ_CLIENT_PROJECT_NAME UNIQUE (projectId, start),
        CONSTRAINT FK_TIMING_PROJECT_ID FOREIGN KEY (projectId)
        REFERENCES project (id) ON DELETE NO ACTION
                                ON UPDATE NO ACTION
    ) STRICT;
`;

const DAILY_TOTALS_VIEW = sql`
    CREATE VIEW IF NOT EXISTS dailyTotals AS
        SELECT strftime('%Y-%m-%d', CAST (start AS REAL) / 1000, 'unixepoch', 'localtime') AS day,
            CAST (SUM([end] - start) AS REAL) / 3600000 AS hours,
            client.name AS client,
            project.name AS project
        FROM timing,
            project,
            client
        WHERE 1=1
            AND timing.projectId = project.id
            AND project.clientId = client.id
        GROUP BY projectId, day
        ORDER BY start DESC;
`;

export async function createSchema(db: IDatabase) {
    await db.execute(CLIENT_SCHEMA.sql);
    await db.execute(PROJECT_SCHEMA.sql);
    await db.execute(SUMMARY_SCHEMA.sql);
    await db.execute(TIMING_SCHEMA.sql);
    await db.execute(DAILY_TOTALS_VIEW.sql);
}

export async function getTimings(
    db: IDatabase,
    input?: { from?: Date; to?: Date }
): Promise<Timing[]> {
    const query = sql`
        SELECT
            timing.start as start,
            timing.end as end,
            project.name as project,
            client.name as client
        FROM timing, project, client
        WHERE timing.projectId = project.id AND project.clientId = client.id
        ${sql.if`AND timing.start >= ${input?.from?.getTime()}`}
        ${sql.if`AND timing.end <= ${input?.to?.getTime()}`}
    `;
    const rows = await db.select<{
        start: number;
        end: number;
        project: string;
        client: string;
    }>(query.sql, query.params);
    return rows.map((row) => ({
        start: new Date(row.start),
        end: new Date(row.end),
        project: row.project,
        client: row.client,
    }));
}

export async function insertTimings(
    db: IDatabase,
    timings: { start: Date; end: Date; project: string; client: string }[]
): Promise<void> {
    await transaction(db, async () => {
        for (const timing of timings) {
            // Get or create the client id from the client name
            const clientId = await getOrCreateClientId(db, timing.client);
            // Get or create the project id from the project and client names
            const projectId = await getOrCreateProjectId(db, timing.project, clientId);
            // Convert the start and end dates to milliseconds
            const start = timing.start.getTime();
            const end = timing.end.getTime();
            // Insert the timing into the database
            await db.execute(
                `
                INSERT INTO timing (start, end, projectId) VALUES (?, ?, ?)
                ON CONFLICT DO UPDATE SET [end] = ?
                `,
                [start, end, projectId, end]
            );
        }
    });

    // console.log(getOrCreateClientId.cache);
    // console.log(getOrCreateProjectId.cache);
}

function localISO8601Date(date: Date) {
    const day = ("00" + date.getDate()).slice(-2);
    const month = ("00" + (date.getMonth() + 1)).slice(-2);
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
}

export async function getDailyTotals(
    db: IDatabase,
    input: {
        from: Date;
        to: Date;
        client?: string;
        project?: string;
    }
): Promise<{ day: Date; hours: number; client: string; project: string }[]> {
    const startDayIso = localISO8601Date(input.from);
    const endDayIso = localISO8601Date(input.to);

    const query = sql`
        SELECT day, hours, client, project 
        FROM dailyTotals
        WHERE 1=1
            ${sql.if`AND client = ${input?.client}`}
            ${sql.if`AND project = ${input?.project}`}
            ${sql.if`AND day >= ${startDayIso}`}
            ${sql.if`AND day <= ${endDayIso}`}
        GROUP BY client, project, day
        ORDER BY day DESC
    `;

    const rows = await db.select<{
        day: string;
        hours: number;
        project: string;
        client: string;
    }>(query.sql, query.params);

    return rows.map((row) => ({
        day: new Date(row.day + "T00:00:00"),
        hours: row.hours,
        project: row.project,
        client: row.client,
    }));
}

// Helper function to get or create the client id from the client name
const getOrCreateClientId = memoizeDbFunction(
    async (db: IDatabase, clientName: string): Promise<number> => {
        // Check if the client exists in the database
        const client = await db.select<{ id: number }>("SELECT id FROM client WHERE name = ?", [
            clientName,
        ]);
        // If yes, return the existing id
        if (client.length > 0) {
            return client[0].id;
        }
        // If not, insert a new row and return the last insert id
        const result = await db.execute("INSERT INTO client (name) VALUES (?)", [clientName]);
        return result.lastInsertId;
    }
);

// Helper function to get or create the project id from the project and client names
const getOrCreateProjectId = memoizeDbFunction(
    async (db: IDatabase, projectName: string, clientId: number): Promise<number> => {
        // Check if the project exists in the database
        const project = await db.select<{ id: number }>(
            "SELECT id FROM project WHERE name = ? AND clientId = ?",
            [projectName, clientId]
        );
        // If yes, return the existing id
        if (project.length > 0) {
            return project[0].id;
        }
        // If not, insert a new row and return the last insert id
        const result = await db.execute("INSERT INTO project (name, clientId) VALUES (?, ?)", [
            projectName,
            clientId,
        ]);
        return result.lastInsertId;
    }
);

// Insert timing summary by a day
export async function insertSummary(db: IDatabase, summary: Summary): Promise<void> {
    await transaction(db, async () => {
        // Get or create the client id from the client name
        const clientId = await getOrCreateClientId(db, summary.client);
        // Get or create the project id from the project and client names
        const projectId = await getOrCreateProjectId(db, summary.project, clientId);
        // Convert the start and end dates to milliseconds
        const start = summary.start.getTime();
        const end = summary.end.getTime();
        // Insert the timing into the database

        const query = sql`
            INSERT INTO summary (start, [end], text, projectId, archived) 
                VALUES (${start}, ${end}, ${summary.text}, ${projectId}, ${summary.archived})
            ON CONFLICT DO UPDATE SET text = ${summary.text}, archived = ${summary.archived}
        `;
        await db.execute(query.sql, query.params);
    });
}

export async function getSummaries(
    db: IDatabase,
    input: {
        from: Date;
        to: Date;
        client?: string;
        project?: string;
        archived?: boolean;
    }
): Promise<Summary[]> {
    const query = sql`
        SELECT 
            summary.start as start,
            summary.end as end,
            summary.text as text,
            project.name as project,
            client.name as client,
            summary.archived as archived
        FROM summary, project, client
        WHERE 
            summary.projectId = project.id 
            AND project.clientId = client.id
            AND summary.start BETWEEN ${input.from.getTime()} AND ${input.to.getTime()}
            ${sql.if`AND client.name = ${input?.client}`}
            ${sql.if`AND project.name = ${input?.project}`}
            ${sql.if`AND summary.archived = ${input?.archived}`}
        ORDER BY start DESC
    `;

    const rows = await db.select<{
        start: number;
        end: number;
        text: string;
        project: string;
        client: string;
        archived: number;
    }>(query.sql, query.params);

    return rows.map((row) => ({
        start: new Date(row.start),
        end: new Date(row.end),
        text: row.text,
        project: row.project,
        client: row.client,
        archived: row.archived === 1,
    }));
}

interface DailyTotal {
    day: Date;
    hours: number;
    client: string;
    project: string;
}
export async function getDailyTotalsSummed(db: IDatabase): Promise<DailyTotal[]> {
    const query = sql`
        SELECT 
            day, 
            hours, 
            client, 
            project 
        FROM dailyTotals 
        WHERE 1=1
        AND day > strftime("%Y-%m-%d", DATETIME('now', 'localtime', '-120 days'))
        AND hours > 0.05
    `;

    const rows = await db.select<{
        day: string;
        hours: number;
        client: string;
        project: string;
    }>(query.sql, query.params);

    return rows.map((row) => ({
        day: new Date(row.day + "T00:00:00"),
        hours: row.hours,
        project: row.project,
        client: row.client,
    }));
}
