import { IDatabase, QueryResult } from "./Database.ts";

import { QueryParameter } from "https://deno.land/x/sqlite/src/query.ts";
import { DB } from "https://deno.land/x/sqlite/src/db.ts";
import { compile } from "https://deno.land/x/sqlite/build/sqlite.js";
import { open } from "https://deno.land/x/sqlite/browser/mod.ts";

export class DatabaseWasm implements IDatabase {
    private path: string;
    private db?: DB;
    private inited = false;

    constructor(path: string, private onInit?: (db: IDatabase) => Promise<void>) {
        this.path = path;
    }
    async transaction<T>(fn: () => Promise<T>): Promise<T> {
        await this.execute("BEGIN TRANSACTION");
        let result: T;
        try {
            result = await fn();
        } catch (e) {
            await this.execute("ROLLBACK TRANSACTION");
            throw e;
        }
        await this.execute("COMMIT TRANSACTION");
        return result;
    }

    async init() {
        if (this.inited) return;
        this.inited = true;

        if (typeof Deno !== "undefined" && "test" in Deno) {
            // In deno
            await compile();
            this.db = new DB(this.path);
        } else {
            // In browser
            this.db = (await open(this.path)) as any;
        }

        await this.onInit?.(this);
    }
    async execute(query: string, bindValues?: unknown[]): Promise<QueryResult> {
        await this.init();
        if (!this.db) {
            throw new Error("Database not initialized");
        }
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
        if (!this.db) {
            throw new Error("Database not initialized");
        }
        return Promise.resolve(this.db.queryEntries<T>(query, bindValues as QueryParameter[]));
    }
    async close(): Promise<boolean> {
        await this.init();
        if (!this.db) {
            throw new Error("Database not initialized");
        }
        this.db.close();
        return Promise.resolve(true);
    }

    async export(): Promise<Uint8Array> {
        await this.init();
        if (!this.db) {
            throw new Error("Database not initialized");
        }
        return this.db.serialize();
    }

    async import(data: Uint8Array): Promise<void> {
        await this.init();
        if (!this.db) {
            throw new Error("Database not initialized");
        }
        this.db.deserialize(data);
    }
}
