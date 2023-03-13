import { sql } from "./utils/sqlLiteral.ts";
import Database, { IDatabase } from "./utils/sqlPlugin.ts";

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

interface ClientAndProject {
    client: string;
    project: string;
}
type ClientAndProjectIds = { [client: string]: { [project: string]: number } };

export class TimingDb {
    db: IDatabase;

    constructor(dbName: string, factory = (): IDatabase => new Database(dbName)) {
        this.db = factory();
    }

    async destroy() {
        await this.db.close();
    }

    async createSchema() {
        await this.db.execute(CLIENT_SCHEMA.sql);
        await this.db.execute(PROJECT_SCHEMA.sql);
        await this.db.execute(SUMMARY_SCHEMA.sql);
        await this.db.execute(TIMING_SCHEMA.sql);
    }

    public async __getClients(): Promise<[number, string][]> {
        const query = sql`SELECT id, name FROM client`;
        return await this.db.select<[number, string][]>(query.sql, query.params);
    }
    public async __getProjects(): Promise<[number, string][]> {
        const query = sql`SELECT id, name FROM project`;
        return await this.db.select<[number, string][]>(query.sql, query.params);
    }

    public async __insertClients(clients_: string[]) {
        const clients = [...new Set(clients_)];
        const clientsById: { [k: string]: number } = {};

        // Get existing clients with ids
        const query = sql`
            SELECT id, name FROM client WHERE name IN ${clients}
        `;
        const res = await this.db.select<[number, string][]>(query.sql, query.params);
        for (const [id, name] of res) {
            clientsById[name] = id;
        }

        // Get non existing clients
        const nonExistingClients = clients.filter((c) => !clientsById[c]);

        // Insert clients
        for (const clientName of nonExistingClients) {
            // Upsert but always return id, even if it already existed
            const query = sql`
                INSERT INTO client as c (name) VALUES (${clientName}) 
                RETURNING id
            `;
            const res = await this.db.select<[[number]]>(query.sql, query.params);
            if (res.length > 0) {
                clientsById[clientName] = res[0][0];
            }
        }
        return clientsById;
    }

    public async __insertProjects(projects: { name: string; clientId: number }[]) {
        type ID = number;

        const projectIdsByClientId: { [clientId: ID]: { [projectName: string]: ID } } = {};

        // Get existing projects with ids
        const query = sql`
            SELECT id, clientId, name FROM project WHERE (name, clientId) IN (${sql.values(
                ...projects.map((p) => [p.name, p.clientId])
            )})
        `;

        const values = await this.db.select<[number, number, string][]>(query.sql, query.params);
        for (const [id, clientId, name] of values) {
            projectIdsByClientId[clientId] = projectIdsByClientId[clientId] || {};
            projectIdsByClientId[clientId][name] = id;
        }

        // Get non-existing projects
        const nonExistingProjects = projects.filter((p) => {
            const existingProjects = projectIdsByClientId[+p.clientId];
            return !existingProjects || !existingProjects[p.name];
        });

        // Insert projects
        for (const { name, clientId } of nonExistingProjects) {
            const query = sql`
                INSERT INTO project (name, clientId) VALUES (${name}, ${clientId})
                ON CONFLICT DO NOTHING
                RETURNING id
            `;

            const res = await this.db.select<[[number]]>(query.sql, query.params);
            if (res.length > 0) {
                projectIdsByClientId[clientId] = projectIdsByClientId[clientId] || {};
                projectIdsByClientId[clientId][name] = res[0][0];
            }
        }
        return projectIdsByClientId;
    }

    public async __insertClientsAndProjects(
        projectsAndClients: ClientAndProject[]
    ): Promise<ClientAndProjectIds> {
        const clientAndProjectIds: ClientAndProjectIds = {};

        // Get unique client names
        const clientNames = projectsAndClients.map((p) => p.client);
        const clientsById = await this.__insertClients(clientNames);
        const projectIds = await this.__insertProjects(
            projectsAndClients.map((p) => ({
                name: p.project,
                clientId: clientsById[p.client],
            }))
        );

        for (const value of projectsAndClients) {
            const clientId = clientsById[value.client];
            const projectId = projectIds[clientId][value.project];
            clientAndProjectIds[value.client] = clientAndProjectIds[value.client] || {};
            clientAndProjectIds[value.client][value.project] = projectId;
        }

        return clientAndProjectIds;
    }

    async insertTimings(timings: { start: Date; end: Date; project: string; client: string }[]) {
        const clientAndProjectsIds = await this.__insertClientsAndProjects(timings);

        // Insert clients
        for (const timing of timings) {
            const projectId = clientAndProjectsIds[timing.client][timing.project];
            const query = sql`
                INSERT INTO timing (start, end, projectId) 
                VALUES ${[timing.start.getTime(), timing.end.getTime(), projectId]}
                ON CONFLICT DO UPDATE SET [end] = ${timing.end.getTime()}
            `;
            await this.db.execute(query.sql, query.params);
        }
    }

    async getTimings(input?: { from?: Date; to?: Date }): Promise<Timing[]> {
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
        const rows = await this.db.select<[number, number, string, string][]>(
            query.sql,
            query.params
        );
        return rows.map((row) => ({
            start: new Date(row[0]),
            end: new Date(row[1]),
            project: row[2],
            client: row[3],
        }));
    }

    public async getDailyTotals(input: {
        from: Date;
        to: Date;
        client?: string;
        project?: string;
    }): Promise<{ day: Date; hours: number; client: string; project: string }[]> {
        // This implementation of daily totals can't split multiday timespan to multiple days

        const query = sql`
            SELECT 
                strftime('%Y-%m-%dT00:00:00', cast(start as real)/1000, 'unixepoch', 'localtime') as day, 
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

        const rows = await this.db.select<[string, number, string, string][]>(
            query.sql,
            query.params
        );

        return rows.map((row) => ({
            day: new Date(row[0]),
            hours: row[1],
            project: row[2],
            client: row[3],
        }));
    }
}
