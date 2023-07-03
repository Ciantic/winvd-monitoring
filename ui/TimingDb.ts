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

    CREATE INDEX IF NOT EXISTS IDX_SUMMARY_START ON summary (start);
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

    CREATE INDEX IF NOT EXISTS IDX_TIMING_START ON timing (start);
`;

// This view performs poorly, but it's a helper for manual queries
const DAILY_TOTALS_VIEW = sql`
    CREATE VIEW IF NOT EXISTS dailyTotals AS
        SELECT strftime('%Y-%m-%d', CAST (start AS REAL) / 1000, 'unixepoch', 'localtime') AS day,
            CAST (SUM([end] - start) AS REAL) / 3600000 AS hours,
            client.name AS client,
            project.name AS project,
            projectId
        FROM timing,
            project,
            client
        WHERE 1=1
            AND timing.projectId = project.id
            AND project.clientId = client.id
        GROUP BY projectId, day 
        ORDER BY start DESC;
`;

// This view performs poorly, but it's a helper for manual queries
const DAILY_SUMMARIES_VIEW = sql`
    CREATE VIEW IF NOT EXISTS dailySummaries AS
        SELECT 
            strftime('%Y-%m-%d', CAST (s.start AS REAL) / 1000, 'unixepoch', 'localtime') AS day,
            s.text as summary, 
            c.name as client, 
            p.name as project,
            s.projectId
        FROM 
            summary as s, 
            client as c, 
            project as p 
        WHERE 1=1
            AND p.id = s.projectId
            AND p.clientId = c.Id
        ORDER BY s.start DESC;

`;

export async function createSchema(db: IDatabase) {
    await db.execute(CLIENT_SCHEMA.sql);
    await db.execute(PROJECT_SCHEMA.sql);
    await db.execute(SUMMARY_SCHEMA.sql);
    await db.execute(TIMING_SCHEMA.sql);
    await db.execute(DAILY_TOTALS_VIEW.sql);
    await db.execute(DAILY_SUMMARIES_VIEW.sql);
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
        ${sql.if`AND timing.start <= ${input?.to?.getTime()}`}
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
}

function localISO8601Date(date: Date) {
    const day = ("00" + date.getDate()).slice(-2);
    const month = ("00" + (date.getMonth() + 1)).slice(-2);
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
}

type DailyTotalSummary = {
    day: Date;
    hours: number;
    client: string;
    project: string;
    summary: string;
};

export async function getDailyTotals(
    db: IDatabase,
    input: {
        from: Date;
        to: Date;
        client?: string;
        project?: string;
    }
): Promise<DailyTotalSummary[]> {
    // Coerce the from and to dates to midnight
    const from = new Date(input.from);
    from.setHours(0, 0, 0, 0);

    const to = new Date(input.to);
    to.setHours(24, 0, 0, 0);

    const inputMidnights = {
        from,
        to,
        client: input.client,
        project: input.project,
    };

    const timings = await getTimings(db, inputMidnights);
    const summaries = await getSummaries(db, inputMidnights);

    // Index summaries by start date
    const summariesByDayClientProject = summaries.reduce((summariesByDay, summary) => {
        const day = localISO8601Date(summary.start);
        const key = `${day}-${summary.client}-${summary.project}`;
        summariesByDay[key] = summary;
        return summariesByDay;
    }, {} as Record<string, Summary>);

    // Sum all start and end times for each day
    const totals = timings.reduce((totals, timing) => {
        const day = localISO8601Date(timing.start);
        const hours = (timing.end.getTime() - timing.start.getTime()) / 3600000;
        const key = `${day}-${timing.client}-${timing.project}`;
        if (!totals[key]) {
            const day = new Date(timing.start);
            day.setHours(0, 0, 0, 0);
            totals[key] = {
                day: day,
                hours: 0,
                client: timing.client,
                project: timing.project,
                summary: summariesByDayClientProject[key]?.text || "",
            };
        }
        totals[key].hours += hours;
        return totals;
    }, {} as Record<string, DailyTotalSummary>);

    return Object.values(totals);
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

        if (summary.text.length == 0) {
            // Delete the summary from the database
            const query = sql`
                DELETE FROM summary WHERE start = ${start} AND projectId = ${projectId}
            `;
            await db.execute(query.sql, query.params);
            return;
        }

        // Insert the timing into the database
        const query = sql`
            INSERT INTO summary (start, [end], text, projectId, archived) 
                VALUES (${start}, ${end}, ${summary.text}, ${projectId}, ${summary.archived})
            ON CONFLICT DO UPDATE SET text = ${summary.text}, archived = ${summary.archived}
        `;
        await db.execute(query.sql, query.params);
    });
}

export async function insertSummaryForDay(
    db: IDatabase,
    summary: {
        day: Date; // Truncated to start of day
        project: string;
        client: string;
        summary: string;
    }
): Promise<void> {
    // Get start of day
    const day = new Date(summary.day);
    day.setHours(0, 0, 0, 0);

    // Get start of next day
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);

    // Insert summary
    await insertSummary(db, {
        start: day,
        end: nextDay,
        project: summary.project,
        client: summary.client,
        text: summary.summary,
        archived: false,
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
            summary.end as [end],
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
