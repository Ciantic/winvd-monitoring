import { IDatabase, QueryResult } from "./Database.ts";
import { DB, QueryParameter } from "https://deno.land/x/sqlite/mod.ts";

export class DatabaseDeno implements IDatabase {
    private path: string;
    private db: DB;
    private onInitCb?: () => Promise<void>;
    private inited = false;

    constructor(path: string) {
        this.path = path;
        this.db = new DB(path);
    }
    onInit(cb: () => Promise<void>) {
        this.onInitCb = cb;
    }
    async init() {
        if (this.inited) return;
        this.inited = true;
        await this.onInitCb?.();
    }
    async execute(query: string, bindValues?: unknown[]): Promise<QueryResult> {
        await this.init();
        this.db.query(query, bindValues as QueryParameter[]);
        return Promise.resolve({
            lastInsertId: this.db.lastInsertRowId,
            rowsAffected: this.db.totalChanges,
        });
    }
    async select<T extends Record<string, unknown>>(
        query: string,
        bindValues?: unknown[]
    ): Promise<T[]> {
        await this.init();
        return Promise.resolve(this.db.queryEntries<T>(query, bindValues as QueryParameter[]));
    }
    async close(): Promise<boolean> {
        await this.init();
        this.db.close();
        return Promise.resolve(true);
    }
}
