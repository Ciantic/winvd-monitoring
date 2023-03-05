import { asDefaultMap } from "./utils/asDefaultMap.ts";
import { splitTotals } from "./utils/splitTotals.ts";

interface PersistedTiming {
    client: string;
    project: string;
    start: Date;
    end: Date;
}
interface Totals {
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
type ProjectAndClient = string;
function key(client: string, project: string) {
    return `${client}~${project}`;
}

class ProjectMonitoringDb2 {
    private client = "";
    private project = "";
    private start?: Date;
    private timingsAsProjectAndClient = asDefaultMap<
        ProjectAndClient,
        {
            totals: Totals;
            timings: Map<StartTimestamp, PersistedTiming>;
        }
    >({
        totals: {
            todayTotal: 0,
            thisWeekTotal: 0,
            lastWeekTotal: 0,
            eightWeekTotal: 0,
            total: 0,
        },
        timings: new Map(),
    });

    public startTiming(client: string, project: string) {
        if (this.start) {
            throw new Error("Already timing");
        }
        this.client = client;
        this.project = project;
        this.start = new Date();
    }

    public stopTiming() {
        const currentTiming = this.currentTiming();
        if (currentTiming) {
            this.insertTiming(currentTiming);
            this.start = undefined;
        } else {
            throw new Error("Not timing");
        }
    }

    public async getTotals({ client, project }: { client: string; project: string }) {
        const storedTotals = this.timingsAsProjectAndClient.getDefault(key(client, project)).totals;
        const currentTotals = this.currentTotal();
        const apiTotals = await this.getTotalsFromApi({ client, project });
        return sumNTotals(storedTotals, currentTotals, apiTotals);
    }

    private currentTotal(): Totals {
        const timing = this.currentTiming();
        if (timing) {
            return splitTotals([timing]);
        }
        return {
            todayTotal: 0,
            thisWeekTotal: 0,
            lastWeekTotal: 0,
            eightWeekTotal: 0,
            total: 0,
        };
    }

    private currentTiming(): PersistedTiming | undefined {
        if (this.start) {
            return {
                client: this.client,
                project: this.project,
                start: this.start,
                end: new Date(),
            };
        }
    }

    private insertTiming(timing: PersistedTiming) {
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

    private getTotalsFromApiCache = new Map<ProjectAndClient, Totals>();

    private getTotalsFromApi({
        client,
        project,
    }: {
        client: string;
        project: string;
    }): Promise<Totals> {
        // Get the API value from cache
        const cachedValue = this.getTotalsFromApiCache.get(key(client, project));
        if (cachedValue) {
            return Promise.resolve(cachedValue);
        }

        // Simulate API call
        return new Promise((resolve) => {
            setTimeout(() => {
                const gotValue = {
                    todayTotal: 0,
                    thisWeekTotal: 0,
                    lastWeekTotal: 0,
                    eightWeekTotal: 0,
                    total: 0,
                };
                // Insert gotValue to cache
                this.getTotalsFromApiCache.set(key(client, project), gotValue);
                resolve(gotValue);
            }, 1000);
        });
    }
}
