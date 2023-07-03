import sqlite3InitModule from "npm:@sqlite.org/sqlite-wasm";
import { IDatabase, QueryResult } from "./Database.ts";

let csqlite3: any;
async function getOrCreateSqlite3() {
    if (!csqlite3) {
        if (typeof Deno !== "undefined" && "test" in Deno) {
            csqlite3 = await sqlite3InitModule();
        } else {
            csqlite3 = await sqlite3InitModule({
                locateFile(file: string) {
                    return "https://cdn.jsdelivr.net/npm/@sqlite.org/sqlite-wasm@3.42.0-build2/sqlite-wasm/jswasm/sqlite3.wasm";
                },
            });
        }
    }
    return csqlite3;
}

export class DatabaseWasm implements IDatabase {
    private db?: any;

    constructor(path: string, private onInit?: (db: IDatabase) => Promise<void>) {
        if (path !== ":memory:") {
            throw new Error("Only in-memory databases are supported");
        }
    }

    private async init() {
        if (this.db) {
            return;
        }
        const sqlite3 = await getOrCreateSqlite3();
        this.db = new sqlite3.oo1.DB();
        await this.onInit?.(this);
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

    async execute(query: string, bindValues?: unknown[] | undefined): Promise<QueryResult> {
        await this.init();
        this.db.exec({
            sql: query,
            bind: bindValues,
            // returnValue: "resultRows",
        });
        return {
            lastInsertId: this.db.selectValue("SELECT last_insert_rowid()"),
            rowsAffected: this.db.changes(true),
        };
    }

    async select<T extends Record<string, unknown>>(
        query: string,
        bindValues?: unknown[] | undefined
    ): Promise<T[]> {
        await this.init();
        return await this.db.selectObjects(query, bindValues);
    }

    async *selectYield<T extends Record<string, unknown>>(
        query: string,
        bindValues?: unknown[] | undefined
    ): AsyncGenerator<T> {
        await this.init();

        // This streams the results
        const stmt = this.db.prepare(query);
        stmt.bind(bindValues);
        while (stmt.step()) {
            // Passing empty object returns result as object
            // https://sqlite.org/wasm/doc/tip/api-oo1.md#stmt-get
            // yield Promise.resolve(stmt.get({}));
            yield stmt.get({});
        }
    }

    // deno-lint-ignore require-await
    async close(): Promise<boolean> {
        if (!this.db) {
            return false;
        }
        this.db.close();
        this.db = undefined;
        return true;
    }

    // https://devblogs.microsoft.com/typescript/announcing-typescript-5-2-beta/#using-declarations-and-explicit-resource-management
    // [Symbol.dispose]() {
    //     this.close();
    // }
}
