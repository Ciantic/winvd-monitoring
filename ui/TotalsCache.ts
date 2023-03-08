import { startOfDay, subDays } from "https://cdn.skypack.dev/date-fns";
import { C } from "../../../../Users/jarip/AppData/Local/deno/npm/registry.npmjs.org/@tauri-apps/api/1.2.0/event-2a9960e7.d.ts";
import { ProjectMonitoringDb } from "./ProjectMonitoringDb.ts";
import { asDefaultMap, DefaultMap } from "./utils/asDefaultMap.ts";
import { simpleMapEvent } from "./utils/simpleMapEvent.ts";
import { getDailyTotals, splitTotals, splitTotalsFrom } from "./utils/splitTotals.ts";

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
type DayTimestamp = number;
type TotalHours = number;
function key(client: string, project: string): ClientAndProjectKey {
    return `${client}~${project}`;
}

export class TotalsCache {
    private dailyTotalsAsProjectAndClient = asDefaultMap<
        ClientAndProjectKey,
        DefaultMap<DayTimestamp, TotalHours>
    >(() => asDefaultMap<DayTimestamp, TotalHours>(() => 0));
    private apiLoadedClientsAndProjects = new Set<ClientAndProjectKey>();

    constructor(private db: ProjectMonitoringDb) {
        db.onInsertTiming.addListener(this.onDbInsertTiming, this);
    }

    public destroy() {
        this.db.onInsertTiming.removeListener(this.onDbInsertTiming);
    }

    private onDbInsertTiming(timing: PersistedTiming) {
        console.log("Insert timing", timing);

        // Add to daily totals
        const clientProject = key(timing.client, timing.project);
        for (const [day, total] of getDailyTotals(timing)) {
            this.dailyTotalsAsProjectAndClient
                .getDefault(clientProject)
                .updateDefault(day, (value) => value + total);
        }
    }

    public getTotals(
        currentTiming: PersistedTiming,
        now = new Date()
    ): {
        totals: Totals;

        // `updateFromDb` is returned only if this client and project pair
        // doesn't have database totals in cache
        updateFromDb?: () => Promise<void>;
    } {
        const { client, project, start, end } = currentTiming;
        const kv = key(client, project);
        const dailyTotals = this.dailyTotalsAsProjectAndClient.getDefault(kv);
        const dailyTotalsSum = splitTotalsFrom(dailyTotals, now);
        const currentTotals = splitTotals([currentTiming]);
        const apiTotals = this.updateDailyTotalsFromApi({ client, project });
        if (typeof apiTotals === "function") {
            return {
                totals: sumNTotals(dailyTotalsSum, currentTotals),
                updateFromDb: () => {
                    return apiTotals()
                        .catch((error) => {
                            console.error("API Error", error);
                        })
                        .then(() => {
                            // return this.getTotals({ client, project }, new Date()).totals;
                        });
                },
            };
        }
        return {
            totals: sumNTotals(dailyTotalsSum, currentTotals),
        };
    }

    private updateDailyTotalsFromApi({
        client,
        project,
    }: {
        client: string;
        project: string;
    }): void | (() => Promise<void>) {
        const kv = key(client, project);
        if (this.apiLoadedClientsAndProjects.has(kv)) {
            return;
        }
        this.apiLoadedClientsAndProjects.add(kv);

        // Simulate API call
        return () =>
            new Promise<void>((resolve) => {
                console.log("HIT DB", kv);
                setTimeout(() => {
                    // Simulate adding 5 hours to yesterday
                    const yesterday = subDays(startOfDay(new Date()), 1);
                    this.dailyTotalsAsProjectAndClient
                        .getDefault(kv)
                        .updateDefault(yesterday.getTime(), (value) => value + 5);

                    // Simulate adding 3 hours to last week
                    const lastWeek = subDays(startOfDay(new Date()), 7);
                    this.dailyTotalsAsProjectAndClient
                        .getDefault(kv)
                        .updateDefault(lastWeek.getTime(), (value) => value + 3);
                    resolve();
                }, 1000);
            }).catch((error) => {
                console.error("API Error", error);
                // API Call failed, it needs to be retried next time
                this.apiLoadedClientsAndProjects.delete(kv);
            });
    }
}
