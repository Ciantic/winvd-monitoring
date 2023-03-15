import { sql } from "./utils/sqlLiteral.ts";
import { IDatabase, transaction } from "./utils/Database.ts";

export interface Timing {
    client: string;
    project: string;
    start: Date;
    end: Date;
}

const CLIENT_SCHEMA = sql`
    CREATE TABLE IF NOT EXISTS client (
        id   INTEGER PRIMARY KEY AUTOINCREMENT
                    NOT NULL,
        name VARCHAR NOT NULL,
        CONSTRAINT UQ_CLIENT_NAME UNIQUE (
            name 
        )
    );
`;

const PROJECT_SCHEMA = sql`
    CREATE TABLE IF NOT EXISTS project (
        id       INTEGER PRIMARY KEY AUTOINCREMENT
                        NOT NULL,
        name     VARCHAR NOT NULL,
        clientId INTEGER NOT NULL,
        CONSTRAINT UQ_CLIENT_PROJECT_NAME UNIQUE (
            name,
            clientId
        ),
        CONSTRAINT FK_816f608a9acf4a4314c9e1e9c66 FOREIGN KEY (
            clientId
        )
        REFERENCES client (id) ON DELETE NO ACTION
                            ON UPDATE NO ACTION
    );
`;

const SUMMARY_SCHEMA = sql`
    CREATE TABLE IF NOT EXISTS summary (
        id        INTEGER PRIMARY KEY AUTOINCREMENT
                        NOT NULL,
        archived  BOOLEAN NOT NULL,
        start     INTEGER NOT NULL,
        [end]     INTEGER NOT NULL,
        text      VARCHAR NOT NULL,
        projectId INTEGER NOT NULL,
        CONSTRAINT UQ_CLIENT_PROJECT_NAME UNIQUE (
            projectId,
            start,
            [end]
        ),
        CONSTRAINT FK_58e39f90b84d6c7da6e2887d8cc FOREIGN KEY (
            projectId
        )
        REFERENCES project (id) ON DELETE NO ACTION
                                ON UPDATE NO ACTION
    );
`;

const TIMING_SCHEMA = sql`
    CREATE TABLE IF NOT EXISTS timing (
        id        INTEGER PRIMARY KEY AUTOINCREMENT
                        NOT NULL,
        start     INTEGER NOT NULL,
        [end]     INTEGER NOT NULL,
        projectId INTEGER NOT NULL,
        CONSTRAINT UQ_CLIENT_PROJECT_NAME UNIQUE (
            projectId,
            start
        ),
        CONSTRAINT FK_2be89ec11939e820d8dc91b94a2 FOREIGN KEY (
            projectId
        )
        REFERENCES project (id) ON DELETE NO ACTION
                                ON UPDATE NO ACTION
    );
`;

export async function createSchema(db: IDatabase) {
    await db.execute(CLIENT_SCHEMA.sql);
    await db.execute(PROJECT_SCHEMA.sql);
    await db.execute(SUMMARY_SCHEMA.sql);
    await db.execute(TIMING_SCHEMA.sql);
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
        ${input?.from ? sql`AND timing.start >= ${input.from.getTime()}` : sql``}
        ${input?.to ? sql`AND timing.end <= ${input.to.getTime()}` : sql``}
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

export async function getDailyTotals(
    db: IDatabase,
    input: {
        from: Date;
        to: Date;
        client?: string;
        project?: string;
    }
): Promise<{ day: Date; hours: number; client: string; project: string }[]> {
    // This implementation of daily totals can't split multiday timespan to multiple days

    const query = sql`
            SELECT 
                strftime('%Y-%m-%d', cast(start as real)/1000, 'unixepoch', 'localtime') as day, 
                cast(SUM(end - start) as real)/3600000 as hours,
                project.name as project,
                client.name as client
            FROM timing, project, client
            WHERE 
                timing.projectId = project.id 
                AND project.clientId = client.id
                AND timing.start BETWEEN ${input.from.getTime()} AND ${input.to.getTime()}
                ${
                    typeof input.client !== "undefined"
                        ? sql`AND client.name = ${input.client}`
                        : sql``
                }
                ${
                    typeof input.project !== "undefined"
                        ? sql`AND project.name = ${input.project}`
                        : sql``
                }
            GROUP BY projectId, day
            ORDER BY start DESC
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
async function getOrCreateClientId(db: IDatabase, clientName: string): Promise<number> {
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

// Helper function to get or create the project id from the project and client names
async function getOrCreateProjectId(
    db: IDatabase,
    projectName: string,
    clientId: number
): Promise<number> {
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
