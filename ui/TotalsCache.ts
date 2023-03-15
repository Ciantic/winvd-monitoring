import { startOfDay, subDays } from "https://cdn.skypack.dev/date-fns";
import { asDefaultMap, DefaultMap } from "./utils/asDefaultMap.ts";
import { getDailyTotals, splitTotals, splitTotalsFrom } from "./utils/splitTotals.ts";

interface Timing {
    client: string;
    project: string;
    start: Date;
    end: Date;
}

interface ClientAndProject {
    client: string;
    project: string;
}

type TimingOptional = ClientAndProject | Timing;

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

export function emptyTotals(): Totals {
    return {
        todayTotal: 0,
        thisWeekTotal: 0,
        lastWeekTotal: 0,
        eightWeekTotal: 0,
        total: 0,
    };
}

type ClientAndProjectKey = string;
type DayTimestamp = number;
type TotalHours = number;
function key({ client, project }: ClientAndProject): ClientAndProjectKey {
    return `${client}~${project}`;
}

export class TotalsCache {
    private dailyTotalsAsProjectAndClient = asDefaultMap<
        ClientAndProjectKey,
        DefaultMap<DayTimestamp, TotalHours>
    >(() => asDefaultMap<DayTimestamp, TotalHours>(() => 0));

    private apiLoadedClientsAndProjects = new Set<ClientAndProjectKey>();

    constructor(
        private getTotalsFromDb: (input: {
            from: Date;
            to: Date;
            client?: string;
            project?: string;
        }) => Promise<
            {
                day: Date;
                hours: number;
                client: string;
                project: string;
            }[]
        >
    ) {}

    public insertTiming(timing: Timing) {
        // Add to daily totals
        const clientProject = key(timing);
        for (const [day, total] of getDailyTotals(timing)) {
            this.dailyTotalsAsProjectAndClient
                .getDefault(clientProject)
                .updateDefault(day, (value) => value + total);
        }
    }

    public getTotals(
        currentTiming: TimingOptional,
        now = new Date()
    ): {
        totals: Totals;

        // `updateFromDb` is returned only if this client and project pair
        // doesn't have database totals in cache
        updateFromDb?: () => Promise<void>;
    } {
        let currentTotals;
        if ("start" in currentTiming) {
            currentTotals = splitTotals([currentTiming], now);
        } else {
            currentTotals = emptyTotals();
        }

        const kv = key(currentTiming);
        const dailyTotals = this.dailyTotalsAsProjectAndClient.getDefault(kv);
        const dailyTotalsSum = splitTotalsFrom(dailyTotals, now);
        const totals = sumNTotals(dailyTotalsSum, currentTotals);
        const updateFromDb = this.updateDailyTotalsFromApi(currentTiming);
        return {
            totals,
            updateFromDb,
        };
    }

    private updateDailyTotalsFromApi(
        clientAndProject: ClientAndProject,
        now = new Date()
    ): undefined | (() => Promise<void>) {
        const kv = key(clientAndProject);
        if (this.apiLoadedClientsAndProjects.has(kv)) {
            return;
        }
        this.apiLoadedClientsAndProjects.add(kv);

        return () =>
            this.getTotalsFromDb({
                from: subDays(startOfDay(now), 90),
                to: now,
                client: clientAndProject.client,
                project: clientAndProject.project,
            })
                .then((totals) => {
                    for (const { day, hours } of totals) {
                        this.dailyTotalsAsProjectAndClient
                            .getDefault(kv)
                            .updateDefault(day.getTime(), (value) => value + hours);
                    }
                })
                .catch((error) => {
                    console.error("API failed getTotalsFromDb", error);
                    // API Call failed, it needs to be retried next time
                    this.apiLoadedClientsAndProjects.delete(kv);
                });

        // Simulate API call
        /*
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
            */
    }
}
