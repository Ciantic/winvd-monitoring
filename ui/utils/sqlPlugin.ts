// Adapted from:
// https://github.com/tauri-apps/plugins-workspace/blob/dev/plugins/sql/guest-js/index.ts

declare const __TAURI__: typeof import("npm:@tauri-apps/api");

const invoke: typeof __TAURI__.invoke =
    typeof __TAURI__ !== "undefined" ? __TAURI__.invoke : ((() => {}) as any);

export interface QueryResult {
    rowsAffected: number;
    lastInsertId: number;
}

export interface IDatabase {
    execute(query: string, bindValues?: unknown[]): Promise<QueryResult>;
    select<T>(query: string, bindValues?: unknown[]): Promise<T>;
    close(db?: string): Promise<boolean>;
}

export default class Database implements IDatabase {
    private unloadedPath: string;
    private loadedPath = "";
    constructor(path: string) {
        this.unloadedPath = path;
    }

    private async load(): Promise<string> {
        if (this.loadedPath) {
            return Promise.resolve(this.loadedPath);
        }

        this.loadedPath = await invoke<string>("plugin:sql|load", {
            db: this.unloadedPath,
        });
        return this.loadedPath;
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

    async select<T>(query: string, bindValues?: unknown[]): Promise<T> {
        const result = await invoke<T>("plugin:sql|select", {
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
