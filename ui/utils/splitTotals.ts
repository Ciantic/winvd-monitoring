import { previousMonday, startOfDay, subDays } from "https://cdn.skypack.dev/date-fns";

interface Totals {
    todayTotal: number;
    thisWeekTotal: number;
    lastWeekTotal: number;
    eightWeekTotal: number;
    total: number;
}

interface Timing {
    start: Date;
    end: Date;
}

function sumLength(t: Timing) {
    return (t.end.getTime() - t.start.getTime()) / 3600000;
}

export function splitTotals(timings: Iterable<Timing>): Totals {
    const today = startOfDay(new Date());
    const thisWeek = previousMonday(today);
    const lastWeek = previousMonday(thisWeek);
    const eightWeeksAgo = subDays(new Date(), 7 * 8);
    // TODO: Eight weeks is a bit ambiguous, maybe 60 days instead?

    let todayTotal = 0;
    let thisWeekTotal = 0;
    let lastWeekTotal = 0;
    let eightWeekTotal = 0;
    let total = 0;

    for (const t of timings) {
        const length = sumLength(t);
        if (t.start >= today) {
            todayTotal += length;
        }
        if (t.start >= thisWeek) {
            thisWeekTotal += length;
        }
        if (t.start >= lastWeek && t.start < thisWeek) {
            lastWeekTotal += length;
        }
        if (t.start >= eightWeeksAgo) {
            eightWeekTotal += length;
        }
        total += length;
    }

    return {
        todayTotal,
        thisWeekTotal,
        lastWeekTotal,
        eightWeekTotal,
        total,
    };
}
