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
    onInit(cb: () => Promise<void>): void;
    init(): Promise<void>;
    execute(query: string, bindValues?: unknown[]): Promise<QueryResult>;
    select<T extends Record<string, unknown>>(query: string, bindValues?: unknown[]): Promise<T[]>;
    close(db?: string): Promise<boolean>;
}

export default class Database implements IDatabase {
    private initedPath = "";
    private onInitCb?: () => Promise<void>;

    constructor(private path: string) {}

    onInit(cb: () => Promise<void>): void {
        this.onInitCb = cb;
    }

    private async load(): Promise<string> {
        await this.init();
        return this.initedPath;
    }

    async init(): Promise<void> {
        if (this.initedPath) {
            return Promise.resolve();
        }

        this.initedPath = await invoke<string>("plugin:sql|load", {
            db: this.path,
        });

        await this.onInitCb?.();
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

    async select<T>(query: string, bindValues?: unknown[]): Promise<T[]> {
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
