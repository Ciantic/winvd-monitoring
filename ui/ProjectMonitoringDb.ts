import { startOfDay, subDays } from "https://cdn.skypack.dev/date-fns";
import { C } from "../../../../Users/jarip/AppData/Local/deno/npm/registry.npmjs.org/@tauri-apps/api/1.2.0/event-2a9960e7.d.ts";
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

export class ProjectMonitoringDb {
    private client = "";
    private project = "";
    private start?: Date;

    private timings: PersistedTiming[] = [];
    private dailyTotalsAsProjectAndClient = asDefaultMap<
        ClientAndProjectKey,
        DefaultMap<DayTimestamp, TotalHours>
    >(() => asDefaultMap<DayTimestamp, TotalHours>(() => 0));
    private apiLoadedClientsAndProjects = new Set<ClientAndProjectKey>();

    // Event listener hookup
    public onInsertTiming = simpleMapEvent<PersistedTiming, void>(this);

    constructor() {
        // TODO: Periodically save timings to database
    }

    public destroy() {}

    public startTiming({ client, project }: { client: string; project: string }, now = new Date()) {
        if (this.start) {
            throw new Error("Already timing");
        }
        this.client = client;
        this.project = project;
        this.start = new Date(now);
    }

    public stopTiming(now = new Date()) {
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

    public getCurrentTiming(now = new Date()) {
        if (this.start) {
            return {
                client: this.client,
                project: this.project,
                start: this.start,
                end: now,
            };
        }
    }

    private insertTiming(timing: PersistedTiming) {
        // Insert timing
        this.timings.push(timing);

        // Send event to listeners
        this.onInsertTiming.trigger(timing);
    }
}
