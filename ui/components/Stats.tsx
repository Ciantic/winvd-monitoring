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
    Accessor,
    Setter,
    createEffect,
    onCleanup,
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

function debounce<T>(fn: (arg: T) => void, delay: number): (arg: T) => void {
    let timeoutId: number | undefined;
    return (arg: T) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            fn(arg);
            timeoutId = undefined;
        }, delay);
    };
}

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

function parseFinnishDateRange(range: string): { from: Date; to: Date } | undefined {
    const match = range.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})?-(\d{1,2})\.(\d{1,2})\.(\d{4})?$/);
    if (!match) {
        return undefined;
    }
    const fromDay = parseInt(match[1]);
    const fromMonth = parseInt(match[2]) - 1;
    const fromYear = match[3] ? parseInt(match[3]) : undefined;
    const toDay = parseInt(match[4]);
    const toMonth = parseInt(match[5]) - 1;
    const toYear = match[6] ? parseInt(match[6]) : undefined;
    const from = new Date();
    from.setDate(fromDay);
    from.setMonth(fromMonth);
    if (fromYear) {
        from.setFullYear(fromYear);
    }
    const to = new Date();
    to.setDate(toDay);
    to.setMonth(toMonth);
    if (toYear) {
        to.setFullYear(toYear);
    }
    return { from, to };
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
        const finnishDateRange = parseFinnishDateRange(range);
        if (finnishDateRange) {
            return finnishDateRange;
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

async function fetchData(props: { from?: Date; to?: Date; client: string; project: string }) {
    // Simulate by waiting
    // await new Promise((resolve) => setTimeout(resolve, 1000));
    if (!props.from || !props.to) {
        return [];
    }

    return await getDailyTotals(timingDb, {
        from: props.from,
        to: props.to,
        client: props.client ? props.client + "%" : undefined,
        project: props.project ? props.project + "%" : undefined,
    });
}

function createCheckboxManager(rows: () => { id: string }[]) {
    let lastChangedRow = undefined as string | undefined;
    const [checkedRows, setCheckedRows] = createSignal<string[]>([]);
    const isAllChecked = createMemo(() => {
        return rows().length > 0 && checkedRows().length === rows().length;
    });
    const onChangeAllChecked = (
        e: Event & { currentTarget: HTMLInputElement; target: HTMLInputElement }
    ) => {
        if (e.currentTarget.checked) {
            setCheckedRows(rows().map((x) => x.id));
        } else {
            setCheckedRows([]);
        }
    };
    const [shiftPressed, setShiftPressed] = createSignal(false);
    const onKeyDown = (e: KeyboardEvent): void => {
        if (e.key === "Shift") {
            setShiftPressed(true);
        }
    };
    const onKeyUp = (e: KeyboardEvent): void => {
        if (e.key === "Shift") {
            setShiftPressed(false);
            lastChangedRow = undefined;
        }
    };
    self.addEventListener("keydown", onKeyDown);
    self.addEventListener("keyup", onKeyUp);
    onCleanup(() => {
        self.removeEventListener("keydown", onKeyDown);
        self.removeEventListener("keyup", onKeyUp);
    });

    function onChangeChecked(
        e: Event & { currentTarget: HTMLInputElement; target: HTMLInputElement },
        currentRow: { id: string }
    ) {
        const isChecked = checkedRows().find((x) => x === currentRow.id) !== undefined;

        if (shiftPressed()) {
            const lastChangedRowIndex = rows().findIndex((x) => x.id === lastChangedRow);
            const thisRowIndex = rows().findIndex((x) => x.id === currentRow.id);
            const start = Math.min(lastChangedRowIndex, thisRowIndex);
            const end = Math.max(lastChangedRowIndex, thisRowIndex);

            if (lastChangedRow && !isChecked && rows) {
                // Check all rows between this and the last checked row
                const newCheckedRows = [...checkedRows()];
                for (let i = start; i <= end; i++) {
                    const id = rows()[i].id;
                    if (newCheckedRows.find((x) => x === id) === undefined) {
                        newCheckedRows.push(id);
                    }
                }
                setCheckedRows(newCheckedRows);
            } else if (lastChangedRow && isChecked && rows) {
                // Uncheck all rows between this and the last checked row
                const newCheckedRows = [...checkedRows()];
                for (let i = start; i <= end; i++) {
                    const id = rows()[i].id;
                    const index = newCheckedRows.findIndex((x) => x === id);
                    if (index !== -1) {
                        newCheckedRows.splice(index, 1);
                    }
                }
                setCheckedRows(newCheckedRows);
            }
        } else if (isChecked) {
            setCheckedRows(checkedRows().filter((x) => x !== currentRow.id));
        } else {
            setCheckedRows([...checkedRows(), currentRow.id]);
        }

        // setLastChangedRow(currentRow.id);
        lastChangedRow = currentRow.id;
    }
    return {
        checkedRows,
        isAllChecked,
        onChangeChecked,
        onChangeAllChecked,
        // setIsAllChecked,
    };
}

export function Stats() {
    const [fxExpr, setFxExpr] = createSignal("x");
    const [dayFilter, setDayFilter] = createSignal("1 months");
    const [clientFilter, setClientFilter] = createSignal("");
    const [projectFilter, setProjectFilter] = createSignal("");
    const parsedDateRange = createMemo(() => parseDateRange(dayFilter()));

    const fxFunc = createMemo(() => (x: number) => {
        try {
            return Math.round(new Function("x", "return " + fxExpr())(x) * 100) / 100;
        } catch (e) {
            return "Error";
        }
    });

    const [getData] = createResource(
        () => ({
            ...parsedDateRange(),
            client: clientFilter(),
            project: projectFilter(),
        }),
        fetchData
    );

    const dataProcessed = createMemo(() => {
        const data = getData();

        return {
            isLoading: data === undefined,
            totalHours: data?.reduce((acc, x) => acc + x.hours, 0),
            rows:
                data?.map((x) => ({
                    ...x,
                    id: x.day.toISOString() + x.client + x.project,
                    fx: fxFunc()(x.hours),
                })) ?? [],
        };
    });

    const { checkedRows, isAllChecked, onChangeChecked, onChangeAllChecked } =
        createCheckboxManager(() => dataProcessed().rows);

    return (
        <div>
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th class="cb"></th>
                        <th class="day">{Lang.day}</th>
                        <th class="client">{Lang.client}</th>
                        <th class="project">{Lang.project}</th>
                        <th class="hours">{Lang.hours}</th>
                        <th class="sum">{Lang.sum}</th>
                        <th class="summary">{Lang.summary}</th>
                    </tr>
                    <tr>
                        <th class="cb">
                            <input
                                class="form-check-input"
                                type="checkbox"
                                checked={isAllChecked()}
                                onChange={onChangeAllChecked}
                            />
                        </th>
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
                                value={fxExpr()}
                                onInput={(e) => {
                                    setFxExpr(e.currentTarget.value);
                                }}
                            />
                        </th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    <Suspense
                        fallback={
                            <tr>
                                <td colspan="7">
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
                        <For each={dataProcessed().rows}>
                            {(row) => (
                                <tr>
                                    <td>
                                        <input
                                            class="form-check-input"
                                            type="checkbox"
                                            checked={
                                                checkedRows().find((x) => x === row.id) !==
                                                undefined
                                            }
                                            onChange={(e) => {
                                                onChangeChecked(e, row);
                                            }}
                                        />
                                    </td>
                                    <td>{formatDate(row.day)}</td>
                                    <td>{row.client}</td>
                                    <td>{row.project}</td>
                                    <td>{Math.round(row.hours * 10) / 10}</td>
                                    <td>{row.fx}</td>
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
                        <th class="cb"></th>
                        <th class="day"></th>
                        <th class="client"></th>
                        <th class="project"></th>
                        <th class="hours">{dataProcessed().totalHours}</th>
                        <th class="sum"></th>
                        <th class="summary"></th>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}
