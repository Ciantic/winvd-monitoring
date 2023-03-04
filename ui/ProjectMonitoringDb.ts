// import Dexie from "https://esm.sh/dexie";
import {
    makeObservable,
    observable,
    computed,
    action,
    runInAction,
    flow,
    autorun,
    IObservableArray,
} from "https://esm.sh/mobx";
import _, { filter } from "https://cdn.skypack.dev/lodash?dts";
import { asDefaultMap } from "./utils/asDefaultMap.ts";

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

type Timestamp = number;

const ENV = "development" as "development" | "production";
const IS_DEBUG = true;

export class ProjectMonitoringDb {
    public isLoadingTotals = false;
    private _timings = observable.array<PersistedTiming>([]);
    private _storedTotals = asDefaultMap<
        string, // client~project
        Totals
    >({
        todayTotal: 0,
        thisWeekTotal: 0,
        lastWeekTotal: 0,
        eightWeekTotal: 0,
        total: 0,
    });
    private storeToServiceInterval: number;

    constructor() {
        makeObservable(this);
        this.storeToServiceInterval = setInterval(
            this.storeTimingsToService,
            ENV == "production" ? 5 * 60000 : 30000 // 5 minutes = production, 30 seconds = development
        );
    }

    @action
    public refreshTotals = async ({
        client,
        project,
    }: {
        client: string;
        project: string;
    }): Promise<void> => {
        return new Promise((resolve) => {
            this.isLoadingTotals = true;
            setTimeout(() => {
                resolve();
                this.isLoadingTotals = false;
            }, 100);
        });
        // TODO: Update _storedTotals
    };

    public getTotals = (timing: PersistedTiming): Totals => {
        // TODO: Get totals from API
        const initialTotals = this._storedTotals.getDefault(`${timing.client}~${timing.project}`);
        const length = (timing.end.getTime() - timing.start.getTime()) / 3600000;
        return {
            lastWeekTotal: initialTotals.lastWeekTotal,
            thisWeekTotal: length + initialTotals.thisWeekTotal,
            eightWeekTotal: length + initialTotals.eightWeekTotal,
            todayTotal: length + initialTotals.todayTotal,
            total: length + initialTotals.total,
        };
    };

    // getTotalsByClientAndProject = (client: string, project: string): Totals => {
    //     let initialTotals = this._initialTotals.getDefault(`${client}~${project}`);
    //     return initialTotals;
    // };

    _getTimings = (): PersistedTiming[] => {
        return this._timings.toJSON();
    };

    _getTimingsByClientAndProject = ({
        client,
        project,
    }: {
        client: string;
        project: string;
    }): PersistedTiming[] => {
        return filter(
            this._timings,
            (timing) => timing.client === client && timing.project === project
        );
    };

    addOrUpdateTiming = (timing: PersistedTiming) => {
        let existing = filter(this._timings, (t) => t.start.getTime() === timing.start.getTime());
        if (existing.length >= 1) {
            for (const t of existing) {
                t.client = timing.client;
                t.project = timing.project;
                t.end = timing.end;
            }
        } else {
            const len = timing.end.getTime() - timing.start.getTime();

            console.log("timings", JSON.parse(JSON.stringify(this._timings)));
            console.log("try to store", timing.client, timing.project, len);
            this._timings.push(timing);
        }
    };

    _deleteTimings = (timings: PersistedTiming[]) => {
        const deleteStartTimes = timings.map((t) => t.start.getTime());
        this._timings.replace(
            filter(this._timings, (t) => !deleteStartTimes.includes(t.start.getTime()))
        );
    };

    private storeTimingsToService = async () => {
        // TODO: Get all but the last?
        const timings = this._getTimings();

        try {
            // TODO:
            // await Api.timings.post(timings);
            // this._deleteTimings(timings);
        } catch (e) {
            console.error("storeTimingsToService:", e);
        }
    };

    public storeCurrentTiming = async (timing: PersistedTiming) => {
        const len = timing.end.getTime() - timing.start.getTime();
        if (IS_DEBUG) {
            console.log(this._timings.toJSON());
            console.log("try to store", timing.client, timing.project, len);
        }
        if (timing.client && timing.project && len > 3000) {
            // await this.refreshTotals(timing);
            // this.totalsCache.add(timing);
            this.addOrUpdateTiming(timing);
        }
    };
}
