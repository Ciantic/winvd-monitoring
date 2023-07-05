/** @jsxImportSource npm:solid-js */
/// <reference lib="dom" />

import {
    For,
    Show,
    createResource,
    Suspense,
    Resource,
    Switch,
    Match,
    createSignal,
    createMemo,
} from "npm:solid-js";

import { Lang, formatDate } from "../Lang.ts";
import { getDailyTotals, getSummaries, insertSummaryForDay } from "../TimingDb.ts";
import { createTimingDatabase } from "../TimingDbCreator.ts";

type Stats = {
    day: Date;
    client: string;
    project: string;
    hours: number;
    summary: string;
};

const timingDb = createTimingDatabase();

function parseFinnishDate(date: string): Date | undefined {
    // If date in format "jj.nn.(yyyy)?"
    const match = date.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})?$/);
    if (!match) {
        return undefined;
    }
    const day = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    const maybeYear = match[3];
    const d = new Date();
    d.setDate(day);
    d.setMonth(month);
    if (maybeYear) {
        d.setFullYear(parseInt(maybeYear));
    }
    return d;
}

function parseDateRange(range: string): { from: Date; to: Date } | undefined {
    {
        const finnishDate = parseFinnishDate(range);
        if (finnishDate) {
            const to = new Date();
            const from = new Date(finnishDate);
            return { from, to };
        }
    }
    {
        // If the range is "n months" or "n weeks" or "n days" or "n hours" or "n minutes"
        const match = range.match(/^(\d+) (months?|weeks?|days?)$/);
        if (match) {
            const amount = parseInt(match[1]);
            const unit = match[2];
            const to = new Date();
            const from = new Date(to);
            switch (unit) {
                case "month":
                case "months":
                    from.setMonth(from.getMonth() - amount);
                    break;
                case "week":
                case "weeks":
                    from.setDate(from.getDate() - amount * 7);
                    break;
                case "day":
                case "days":
                    from.setDate(from.getDate() - amount);
                    break;
            }
            return { from, to };
        }
    }
    return undefined;
}

export function Stats() {
    const [sigma, setSigma] = createSignal("x");
    const [dayFilter, setDayFilter] = createSignal("1 months");
    const [clientFilter, setClientFilter] = createSignal("");
    const [projectFilter, setProjectFilter] = createSignal("");
    const parsedDateRange = createMemo(() => parseDateRange(dayFilter()));

    const textFunc = createMemo(() => (x: number) => {
        try {
            return Math.round(new Function("x", "return " + sigma())(x) * 100) / 100;
        } catch (e) {
            return "Error";
        }
    });

    const daysAgo120 = new Date();
    daysAgo120.setDate(daysAgo120.getDate() - 120);

    async function fetchData(props: { from?: Date; to?: Date; client: string; project: string }) {
        // Simulate by waiting
        // await new Promise((resolve) => setTimeout(resolve, 1000));
        if (!props.from || !props.to) {
            return [];
        }

        return await getDailyTotals(timingDb, {
            from: props.from,
            to: props.to,
            client: props.client ? props.client : undefined,
            project: props.project ? props.project : undefined,
        });
    }

    const [getData] = createResource(
        () => ({
            ...parsedDateRange(),
            client: clientFilter(),
            project: projectFilter(),
        }),
        fetchData
    );

    const dataFiltered = createMemo(() => {
        const data = getData();
        const parsedDateRange = parseDateRange(dayFilter());
        const filteredData = data?.filter((x) => {
            if (parsedDateRange) {
                if (x.day < parsedDateRange[0] || x.day > parsedDateRange[1]) {
                    return false;
                }
            }
            return true;
        });
        return {
            totalHours: filteredData?.reduce((acc, x) => acc + x.hours, 0),
            rows: filteredData,
        };
    });

    return (
        <div>
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th class="day">{Lang.day}</th>
                        <th class="client">{Lang.client}</th>
                        <th class="project">{Lang.project}</th>
                        <th class="hours">{Lang.hours}</th>
                        <th class="sum">{Lang.sum}</th>
                        <th class="summary">{Lang.summary}</th>
                    </tr>
                    <tr>
                        <th>
                            <input
                                class="form-control"
                                type="text"
                                value={dayFilter()}
                                onInput={(e) => {
                                    setDayFilter(e.currentTarget.value);
                                }}
                            />
                        </th>
                        <th>
                            <input
                                class="form-control"
                                type="text"
                                value={clientFilter()}
                                onInput={(e) => {
                                    setClientFilter(e.currentTarget.value);
                                }}
                            />
                        </th>
                        <th>
                            <input
                                class="form-control"
                                type="text"
                                value={projectFilter()}
                                onInput={(e) => {
                                    setProjectFilter(e.currentTarget.value);
                                }}
                            />
                        </th>
                        <th>
                            <input class="form-control" type="text" />
                        </th>
                        <th>
                            <input
                                class="form-control"
                                type="text"
                                value={sigma()}
                                onInput={(e) => {
                                    setSigma(e.currentTarget.value);
                                }}
                            />
                        </th>
                        <th>
                            <input class="form-control" type="text" />
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <Suspense
                        fallback={
                            <tr>
                                <td colspan="6">
                                    <div class="loading-fullscreen">
                                        <div class="spinner">
                                            <div class="spinner-border text-primary" role="status">
                                                <span class="visually-hidden">Loading...</span>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        }
                    >
                        <For each={dataFiltered().rows}>
                            {(row) => (
                                <tr>
                                    <td>{formatDate(row.day)}</td>
                                    <td>{row.client}</td>
                                    <td>{row.project}</td>
                                    <td>{Math.round(row.hours * 10) / 10}</td>
                                    <td>{textFunc()(row.hours)}</td>
                                    <td>
                                        <input
                                            class="form-control"
                                            type="text"
                                            value={row.summary}
                                            onInput={(e) => {
                                                insertSummaryForDay(timingDb, {
                                                    day: row.day,
                                                    summary: e.currentTarget.value,
                                                    client: row.client,
                                                    project: row.project,
                                                });
                                            }}
                                        />
                                    </td>
                                </tr>
                            )}
                        </For>
                    </Suspense>
                </tbody>
                <tfoot>
                    <tr>
                        <th class="day"></th>
                        <th class="client"></th>
                        <th class="project"></th>
                        <th class="hours">{dataFiltered().totalHours}</th>
                        <th class="sum"></th>
                        <th class="summary"></th>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}
