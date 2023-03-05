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
import _, { filter, split } from "https://cdn.skypack.dev/lodash?dts";
import { asDefaultMap } from "./utils/asDefaultMap.ts";
import { Api } from "./Api.ts";
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

type StartTimestamp = number;
type ProjectAndClient = string;

const ENV = "development" as "development" | "production";
const IS_DEBUG = true;

export class ProjectMonitoringDb {
    @observable public isLoadingTotals = false;

    private _timingsAsProjectAndClient = asDefaultMap<
        ProjectAndClient,
        Map<StartTimestamp, PersistedTiming>
    >(new Map());
    private _storedTotals = new Map<
        string, // client~project
        Totals
    >();
    private storeToServiceInterval = 0;
    private refreshTypingTimeout = 0;

    constructor() {
        makeObservable(this);
        this.storeToServiceInterval = setInterval(
            this._storeTimingsToService,
            ENV == "production" ? 5 * 60000 : 30000 // 5 minutes = production, 30 seconds = development
        );
    }

    public destroy() {
        if (this.storeToServiceInterval) clearInterval(this.storeToServiceInterval);
        if (this.refreshTypingTimeout) clearTimeout(this.refreshTypingTimeout);
    }

    _refreshTotals = ({ client, project }: { client: string; project: string }): Promise<void> => {
        // TODO: Get totals from API
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

    public getTotals = (timing: { client: string; project: string }): Totals => {
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

        // const timings = this._getTimingsByClientAndProject(timing);
        const timings = this._timingsAsProjectAndClient
            .getDefault(`${timing.client}~${timing.project}`)
            .values();
        const splittedTotals = splitTotals(timings);

        return {
            lastWeekTotal: splittedTotals.lastWeekTotal + initialTotals.lastWeekTotal,
            thisWeekTotal: splittedTotals.thisWeekTotal + initialTotals.thisWeekTotal,
            eightWeekTotal: splittedTotals.eightWeekTotal + initialTotals.eightWeekTotal,
            todayTotal: splittedTotals.todayTotal + initialTotals.todayTotal,
            total: splittedTotals.total + initialTotals.total,
        };
    };

    // getTotalsByClientAndProject = (client: string, project: string): Totals => {
    //     let initialTotals = this._initialTotals.getDefault(`${client}~${project}`);
    //     return initialTotals;
    // };

    *_getTimings(): Iterable<PersistedTiming> {
        for (const map of this._timingsAsProjectAndClient.values()) {
            for (const value of map.values()) {
                yield value;
            }
        }
    }

    addOrUpdateTiming = (timing: PersistedTiming) => {
        console.log("addOrUpdateTiming", timing);
        this._timingsAsProjectAndClient
            .setDefault(`${timing.client}~${timing.project}`)
            .set(timing.start.getTime(), timing);
    };

    _deleteTimings = (timings: PersistedTiming[]) => {
        for (const t of timings) {
            this._timingsAsProjectAndClient
                .get(`${t.client}~${t.project}`)
                ?.delete(t.start.getTime());
        }
    };

    private _storeTimingsToService = async () => {
        // TODO: Get all but the last?
        const timings = [...this._getTimings()];

        try {
            // TODO:
            await Api.timings.post(timings);
            this._deleteTimings(timings);
        } catch (e) {
            console.error("storeTimingsToService:", e);
        }
    };

    /*
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
    */
}
