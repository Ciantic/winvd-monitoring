// Adapted from:
// https://github.com/tauri-apps/plugins-workspace/blob/dev/plugins/sql/guest-js/index.ts

import { IDatabase, QueryResult } from "./Database.ts";

declare const __TAURI__: typeof import("npm:@tauri-apps/api");

const invoke: typeof __TAURI__.invoke =
    typeof __TAURI__ !== "undefined" ? __TAURI__.invoke : ((() => {}) as any);

export class DatabaseTauri implements IDatabase {
    private initedPath = "";

    constructor(private path: string, private onInit?: (db: IDatabase) => Promise<void>) {}

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

    private async load(): Promise<string> {
        await this.init();
        return this.initedPath;
    }

    private async init(): Promise<void> {
        if (this.initedPath) {
            return Promise.resolve();
        }

        this.initedPath = await invoke<string>("plugin:sql|load", {
            db: `sqlite:${this.path}`,
        });

        await this.onInit?.(this);
    }

    async execute(query: string, bindValues?: unknown[]): Promise<QueryResult> {
        const [rowsAffected, lastInsertId] = await invoke<[number, number]>("plugin:sql|execute", {
            db: await this.load(),
            query,
            values: bindValues ?? [],
        });

        return {
            lastInsertId,
            rowsAffected,
        };
    }

    async select<T extends Record<string, unknown>>(
        query: string,
        bindValues?: unknown[]
    ): Promise<T[]> {
        const result = await invoke<T[]>("plugin:sql|select", {
            db: await this.load(),
            query,
            values: bindValues ?? [],
        });

        return result;
    }

    async close(): Promise<boolean> {
        const success = await invoke<boolean>("plugin:sql|close", {
            db: await this.load(),
        });
        return success;
    }
}
