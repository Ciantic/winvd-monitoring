import { moment } from "./Lang.ts";
import { asDefaultMap } from "./utils/asDefaultMap.ts";
import { Api } from "./Api.ts";
import { ProjectMonitoringDb } from "./ProjectMonitoringDb.ts";

interface Timing {
    client: string;
    project: string;
    start: Date;
    end: Date;
}

interface GetTotals {
    todayTotal: number;
    thisWeekTotal: number;
    lastWeekTotal: number;
    eightWeekTotal: number;
    total: number;
}

interface DailyTotal {
    day: string;
    hours: number;
}

type TotalKey = string & { __totalKey: true };
function getTotalKey(key: { client: string; project: string }): TotalKey {
    return `${key.client}~${key.project}` as any;
}

type WeeklyKey = string & { __weeklyKey: true };
function getWeeklyKey(key: { client: string; project: string; start: Date }): WeeklyKey {
    return (moment(key.start).format("GGGGWW") + `-${key.client}~${key.project}`) as any;
}

type DailyKey = string & { __dailyKey: true };
function getDailyKey(key: { client: string; project: string; start: Date }): DailyKey {
    return (moment(key.start).format("YYYYMMDD") + `-${key.client}~${key.project}`) as any;
}

/**
 * Stores total hours by project and client for daily, weekly and grand total.
 */
export class TotalsCache {
    private dailyTotals = asDefaultMap<DailyKey, number>(0);
    private weeklyTotals = asDefaultMap<WeeklyKey, number>(0);
    private totals = asDefaultMap<TotalKey, number>(0);

    constructor(private db: ProjectMonitoringDb) {}

    private set(
        clientProject: { client: string; project: string },
        days: DailyTotal[],
        total: number
    ) {
        this.totals.set(getTotalKey(clientProject), total);
        for (let day of days) {
            let key = Object.assign({}, clientProject, {
                start: new Date(day.day),
            });

            let dailyTotal = this.dailyTotals.getDefault(getDailyKey(key));
            this.dailyTotals.set(getDailyKey(key), dailyTotal + day.hours);

            let weeklyTotal = this.weeklyTotals.getDefault(getWeeklyKey(key));
            this.weeklyTotals.set(getWeeklyKey(key), weeklyTotal + day.hours);
        }
    }

    public add(timing: Timing) {
        let length = (timing.end.getTime() - timing.start.getTime()) / 3600000;

        let dailyKey = getDailyKey(timing);
        let dailyTotals = this.dailyTotals.getDefault(dailyKey);
        this.dailyTotals.set(dailyKey, dailyTotals + length);

        let weeklyKey = getWeeklyKey(timing);
        let weeklyTotals = this.weeklyTotals.getDefault(weeklyKey);
        this.weeklyTotals.set(weeklyKey, weeklyTotals + length);

        let key = getTotalKey(timing);
        let total = this.totals.getDefault(key);
        this.totals.set(key, total + length);
    }

    public get(timing: Timing) {
        let length = (timing.end.getTime() - timing.start.getTime()) / 3600000;
        let totals: GetTotals = {
            lastWeekTotal: 0,
            thisWeekTotal: length,
            eightWeekTotal: 0,
            todayTotal: length,
            total: length,
        };

        let dailyKey = getDailyKey({ ...timing, start: new Date() });
        totals.todayTotal += this.dailyTotals.getDefault(dailyKey);

        let weeklyKey = getWeeklyKey({ ...timing, start: new Date() });
        totals.thisWeekTotal += this.weeklyTotals.getDefault(weeklyKey);

        let lastWeeklyKey = getWeeklyKey({
            ...timing,
            start: moment().subtract(1, "week").toDate(),
        });
        totals.lastWeekTotal += this.weeklyTotals.getDefault(lastWeeklyKey);

        // This week + 8 weeks
        for (let weekN = 0; weekN < 9; weekN++) {
            let weeklyKey = getWeeklyKey({
                ...timing,
                start: moment().subtract(weekN, "week").toDate(),
            });
            totals.eightWeekTotal += this.weeklyTotals.getDefault(weeklyKey);
        }

        let totalKey = getTotalKey(timing);
        totals.total += this.totals.getDefault(totalKey);

        return totals;
    }

    public async refresh(clientProject: { client: string; project: string }) {
        if (this.totals.has(getTotalKey(clientProject))) {
            return;
        }

        for (const timing of this.db._getTimingsByClientAndProject(clientProject)) {
            const len = (timing.end.getTime() - timing.start.getTime()) / 1000 / 3600;

            const dailyKey = getDailyKey(timing);
            const dailyTotals = this.dailyTotals.getDefault(dailyKey);
            this.dailyTotals.set(dailyKey, dailyTotals + len);

            const weeklyKey = getWeeklyKey(timing);
            const weeklyTotals = this.weeklyTotals.getDefault(weeklyKey);
            this.weeklyTotals.set(weeklyKey, weeklyTotals + len);

            const totalKey = getTotalKey(timing);
            const totals = this.totals.getDefault(totalKey);
            this.totals.set(totalKey, totals + len);
        }

        let getFromApi = Promise.all([
            Api.timings.total(clientProject),
            Api.timings.dailyTotals({
                ...clientProject,
                from: moment().subtract(9, "weeks").toDate(),
                to: new Date(),
            }),
        ]).then(([total, days]) => {
            this.set(clientProject, days, total.hours);
        });

        return getFromApi;
    }
}
