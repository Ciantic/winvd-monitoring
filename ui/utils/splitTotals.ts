import {
    previousMonday,
    startOfDay,
    subDays,
    addDays,
    eachDayOfInterval,
    eachWeekOfInterval,
    startOfWeek,
} from "https://cdn.skypack.dev/date-fns";

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
    if (t.end < t.start) {
        console.warn("Timing end is before start", t);
        return 0;
    }
    return (t.end.getTime() - t.start.getTime()) / 3600000;
}

export function splitTotals(timings: Iterable<Timing>, now = new Date()): Totals {
    const today = startOfDay(now);
    const thisWeek = previousMonday(today);
    const lastWeek = previousMonday(thisWeek);
    const eightWeeksAgo = subDays(now, 7 * 8);
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

export function splitTotalsFrom(
    dailyTotals: Map<DayTimestamp, TotalHours>,
    now = new Date()
): Totals {
    const today = startOfDay(now);
    const thisWeek = previousMonday(today);
    const lastWeek = previousMonday(thisWeek);
    const eightWeeksAgo = subDays(now, 7 * 8);

    let todayTotal = 0;
    let thisWeekTotal = 0;
    let lastWeekTotal = 0;
    let eightWeekTotal = 0;
    let total = 0;

    for (const [day, length] of dailyTotals) {
        if (day >= today.getTime()) {
            todayTotal += length;
        }
        if (day >= thisWeek.getTime()) {
            thisWeekTotal += length;
        }
        if (day >= lastWeek.getTime() && day < thisWeek.getTime()) {
            lastWeekTotal += length;
        }
        if (day >= eightWeeksAgo.getTime()) {
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

type DayTimestamp = number;
type TotalHours = number;

export function getWeeklyTotals(timing: Timing): Map<DayTimestamp, TotalHours> {
    const result = new Map<DayTimestamp, TotalHours>();
    let current = timing.start;

    for (const day of eachWeekOfInterval(timing)) {
        const ending = startOfDay(addDays(current, 7));
        const length = sumLength({
            start: current,
            end: ending > timing.end ? timing.end : ending,
        });
        result.set(day.getTime(), length);
        current = ending;
    }

    return result;
}

export function getDailyTotals(timing: Timing): Map<DayTimestamp, TotalHours> {
    const result = new Map<DayTimestamp, TotalHours>();
    let current = timing.start;

    for (const day of eachDayOfInterval(timing)) {
        const ending = startOfDay(addDays(current, 1));
        const length = sumLength({
            start: current,
            end: ending > timing.end ? timing.end : ending,
        });
        result.set(day.getTime(), length);
        current = ending;
    }

    return result;
}

import { assertEquals } from "https://deno.land/std/assert/mod.ts";
if (typeof Deno !== "undefined" && "test" in Deno) {
    Deno.test("getDailyTotals", () => {
        const timing = {
            start: new Date("2021-01-01 12:00"),
            end: new Date("2021-01-02 12:00"),
        };
        const result = getDailyTotals(timing);
        assertEquals(result.size, 2);
        assertEquals(result.get(new Date("2021-01-01 00:00").getTime()), 12);
        assertEquals(result.get(new Date("2021-01-02 00:00").getTime()), 12);
    });

    Deno.test("getDailyTotals 2", () => {
        const timing = {
            start: new Date("2021-01-01 12:00"),
            end: new Date("2021-01-01 14:00"),
        };
        const result = getDailyTotals(timing);
        assertEquals(result.size, 1);
        assertEquals(result.get(new Date("2021-01-01 00:00").getTime()), 2);
    });

    Deno.test("getWeeklyTotals", () => {
        const timing = {
            start: new Date("2023-03-07 12:00"), // Tuesday
            end: new Date("2023-03-17 12:00"),
        };
        const result = getWeeklyTotals(timing);
        assertEquals(result.size, 2);
        assertEquals(result.get(startOfWeek(new Date("2023-03-07 12:00")).getTime()), 156);
        assertEquals(
            result.get(addDays(startOfWeek(new Date("2023-03-07 12:00")), 7).getTime()),
            84
        );
    });
}
