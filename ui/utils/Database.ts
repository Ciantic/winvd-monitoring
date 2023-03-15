// Adapted from:
// https://github.com/tauri-apps/plugins-workspace/blob/dev/plugins/sql/guest-js/index.ts

declare const __TAURI__: typeof import("npm:@tauri-apps/api");

const invoke: typeof __TAURI__.invoke =
    typeof __TAURI__ !== "undefined" ? __TAURI__.invoke : ((() => {}) as any);

export interface QueryResult {
    rowsAffected: number;
    lastInsertId: number;
}

export async function transaction<T>(db: IDatabase, fn: () => Promise<T>): Promise<T> {
    await db.execute("BEGIN TRANSACTION");
    let result: T;
    try {
        result = await fn();
    } catch (e) {
        await db.execute("ROLLBACK TRANSACTION");
        throw e;
    }
    await db.execute("COMMIT TRANSACTION");
    return result;
}

export interface IDatabase {
    execute(query: string, bindValues?: unknown[]): Promise<QueryResult>;
    select<T extends Record<string, unknown>>(query: string, bindValues?: unknown[]): Promise<T[]>;
    close(): Promise<boolean>;
}

export class Database implements IDatabase {
    private initedPath = "";

    constructor(private path: string, private onInit?: (db: IDatabase) => Promise<void>) {}

    private async load(): Promise<string> {
        await this.init();
        return this.initedPath;
    }

    private async init(): Promise<void> {
        if (this.initedPath) {
            return Promise.resolve();
        }

        this.initedPath = await invoke<string>("plugin:sql|load", {
            db: this.path,
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
