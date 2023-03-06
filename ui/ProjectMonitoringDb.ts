import { asDefaultMap } from "./utils/asDefaultMap.ts";
import { splitTotals } from "./utils/splitTotals.ts";

interface PersistedTiming {
    client: string;
    project: string;
    start: Date;
    end: Date;
}
export interface Totals {
    todayTotal: number;
    thisWeekTotal: number;
    lastWeekTotal: number;
    eightWeekTotal: number;
    total: number;
}

function sumTwoTotals(a: Totals, b: Totals) {
    return {
        todayTotal: a.todayTotal + b.todayTotal,
        thisWeekTotal: a.thisWeekTotal + b.thisWeekTotal,
        lastWeekTotal: a.lastWeekTotal + b.lastWeekTotal,
        eightWeekTotal: a.eightWeekTotal + b.eightWeekTotal,
        total: a.total + b.total,
    };
}

function sumNTotals(...totals: Totals[]) {
    return totals.reduce(sumTwoTotals);
}

type StartTimestamp = number;
type ClientAndProjectKey = string;
function key(client: string, project: string): ClientAndProjectKey {
    return `${client}~${project}`;
}

export class ProjectMonitoringDb {
    private client = "";
    private project = "";
    private start?: Date;
    private timingsAsProjectAndClient = asDefaultMap<
        ClientAndProjectKey,
        {
            totals: Totals;
            timings: Map<StartTimestamp, PersistedTiming>;
        }
    >(() => ({
        totals: {
            todayTotal: 0,
            thisWeekTotal: 0,
            lastWeekTotal: 0,
            eightWeekTotal: 0,
            total: 0,
        },
        timings: new Map(),
    }));

    constructor() {}

    public destroy() {}

    public startTiming({ client, project }: { client: string; project: string }, now = new Date()) {
        console.log("Start timing", client, project);
        if (this.start) {
            throw new Error("Already timing");
        }
        this.client = client;
        this.project = project;
        this.start = new Date(now);
    }

    public stopTiming(now = new Date()) {
        console.log("Stop timing");
        if (this.start) {
            this.insertTiming({
                client: this.client,
                project: this.project,
                start: this.start,
                end: now,
            });
            this.start = undefined;
        } else {
            throw new Error("Not timing");
        }
    }

    private insertTiming(timing: PersistedTiming) {
        console.log("Insert timing", timing, this.timingsAsProjectAndClient);
        const k = key(timing.client, timing.project);
        const timings = this.timingsAsProjectAndClient.getDefault(k).timings;
        const totals = this.timingsAsProjectAndClient.getDefault(k).totals;
        const splittedTotals = splitTotals([timing]);

        // Insert timing
        timings.set(timing.start.getTime(), timing);

        // Update totals
        totals.todayTotal += splittedTotals.todayTotal;
        totals.thisWeekTotal += splittedTotals.thisWeekTotal;
        totals.lastWeekTotal += splittedTotals.lastWeekTotal;
        totals.eightWeekTotal += splittedTotals.eightWeekTotal;
        totals.total += splittedTotals.total;
    }

    public getTotals(
        { client, project }: { client: string; project: string },
        now = new Date()
    ): {
        totals: Totals;

        // `updateFromDb` is returned only if this client and project pair
        // doesn't have database totals in cache
        updateFromDb?: () => Promise<Totals>;
    } {
        const kv = key(client, project);
        // console.log("Load totals", client, project, loadApiTotals);
        const storedTotals = this.timingsAsProjectAndClient.getDefault(kv).totals;
        const currentTotals = this.getCurrentTotal({ client, project }, now);
        const apiTotals = this.getTotalsFromApi({ client, project });
        if (typeof apiTotals === "function") {
            return {
                totals: sumNTotals(storedTotals, currentTotals),
                updateFromDb: () => {
                    return apiTotals().then((updatedTotals) => {
                        const storedTotals = this.timingsAsProjectAndClient.getDefault(kv).totals;
                        const currentTotals = this.getCurrentTotal({ client, project }, new Date());
                        return sumNTotals(storedTotals, currentTotals, updatedTotals);
                    });
                },
            };
        }
        return {
            totals: sumNTotals(storedTotals, currentTotals, apiTotals),
        };
    }

    private getCurrentTotal(
        { client, project }: { client: string; project: string },
        now = new Date()
    ): Totals {
        if (this.client === client && this.project === project && this.start) {
            return splitTotals([{ start: this.start, end: now }]);
        }
        return {
            todayTotal: 0,
            thisWeekTotal: 0,
            lastWeekTotal: 0,
            eightWeekTotal: 0,
            total: 0,
        };
    }

    private getTotalsFromApiCache = new Map<ClientAndProjectKey, Totals>();

    private getTotalsFromApi({
        client,
        project,
    }: {
        client: string;
        project: string;
    }): Totals | (() => Promise<Totals>) {
        const kv = key(client, project);
        // Get the API value from cache
        const cachedValue = this.getTotalsFromApiCache.get(kv);
        if (cachedValue) {
            return cachedValue;
        }

        // Simulate API call
        return () =>
            new Promise<Totals>((resolve) => {
                console.log("HIT DB", kv);
                setTimeout(() => {
                    const gotValue = {
                        todayTotal: 1,
                        thisWeekTotal: 1,
                        lastWeekTotal: 3,
                        eightWeekTotal: 4,
                        total: 1,
                    };
                    // Insert gotValue to cache
                    console.log("UPDATE DB CACHE", kv);
                    this.getTotalsFromApiCache.set(kv, gotValue);
                    resolve(gotValue);
                }, 1000);
            });
    }
}
