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
import { Api } from "./Api.ts";

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

type StartTimestamp = number;

const ENV = "development" as "development" | "production";
const IS_DEBUG = true;

export class ProjectMonitoringDb {
    @observable public isLoadingTotals = false;
    private _timings = observable.array<PersistedTiming>([]);
    private _timingsAsMap = observable.map<StartTimestamp, PersistedTiming>();
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
    private refreshTypingTimeout: number = 0;

    constructor() {
        makeObservable(this);
        this.storeToServiceInterval = setInterval(
            this._storeTimingsToService,
            ENV == "production" ? 5 * 60000 : 30000 // 5 minutes = production, 30 seconds = development
        );
    }

    destroy() {
        if (this.storeToServiceInterval) clearInterval(this.storeToServiceInterval);
        if (this.refreshTypingTimeout) clearTimeout(this.refreshTypingTimeout);
    }

    _refreshTotals = ({ client, project }: { client: string; project: string }): Promise<void> => {
        console.log("Refresh totals", client, project);

        return new Promise((resolve) => {
            runInAction(() => (this.isLoadingTotals = true));
            setTimeout(() => {
                resolve();
                this._storedTotals.set(`${client}~${project}`, {
                    todayTotal: 1,
                    thisWeekTotal: 1,
                    lastWeekTotal: 0,
                    eightWeekTotal: 1,
                    total: 1,
                });
                runInAction(() => (this.isLoadingTotals = false));
            }, 1500);
        });
    };

    public getTotals = (timing: PersistedTiming): Totals => {
        // TODO: Get totals from API
        let initialTotals = this._storedTotals.get(`${timing.client}~${timing.project}`);
        if (!initialTotals) {
            initialTotals = {
                todayTotal: 0,
                thisWeekTotal: 0,
                lastWeekTotal: 0,
                eightWeekTotal: 0,
                total: 0,
            };
            clearTimeout(this.refreshTypingTimeout);
            this.refreshTypingTimeout = setTimeout(
                () => this._refreshTotals({ client: timing.client, project: timing.project }),
                333
            );
        }
        // console.log("getTotals", timing.client, timing.project);

        let timings = this._getTimingsByClientAndProject(timing);
        // Sum lengths of all timings
        let allLengths =
            timings.reduce((acc, t) => {
                return acc + (t.end.getTime() - t.start.getTime());
            }, 0) / 3600000;

        const length = allLengths + (timing.end.getTime() - timing.start.getTime()) / 3600000;
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
        // return this._timingsAsMap.values();
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
                console.log("update existing", timing.client, timing.project);
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

    private _storeTimingsToService = async () => {
        // TODO: Get all but the last?
        const timings = this._getTimings();

        try {
            // TODO:
            await Api.timings.post(timings);
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
