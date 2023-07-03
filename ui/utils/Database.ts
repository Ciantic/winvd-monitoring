// Adapted from:
// https://github.com/tauri-apps/plugins-workspace/blob/dev/plugins/sql/guest-js/index.ts

import { DatabaseWasm } from "./DatabaseWasm.ts";
import { DatabaseTauri } from "./DatabaseTauri.ts";

declare const __TAURI__: typeof import("npm:@tauri-apps/api");

export interface QueryResult {
    rowsAffected: number;
    lastInsertId: number;
}

export interface IDatabase {
    transaction<T>(fn: () => Promise<T>): Promise<T>;
    execute(query: string, bindValues?: unknown[]): Promise<QueryResult>;
    select<T extends Record<string, unknown>>(query: string, bindValues?: unknown[]): Promise<T[]>;
    selectYield<T extends Record<string, unknown>>(
        query: string,
        bindValues?: unknown[] | undefined
    ): AsyncGenerator<T>;
    close(): Promise<boolean>;
}

export function createDatabase(path: string, onInit?: (db: IDatabase) => Promise<void>): IDatabase {
    if (typeof __TAURI__ !== "undefined") {
        return new DatabaseTauri(path, onInit);
    }
    return new DatabaseWasm(path, onInit);
}
