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
    JSX,
} from "npm:solid-js";

import { render } from "npm:solid-js/web";

import { Lang, formatDate, formatDateTsv, formatDecimal } from "../Lang.ts";
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
    const onChangeAllChecked = (e: {
        currentTarget: HTMLInputElement;
        target: HTMLInputElement;
    }) => {
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
        e: { currentTarget: HTMLInputElement; target: HTMLInputElement },
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
    const [fxExpr, setFxExpr] = createSignal("r(x*1.25*2,0)/2");
    const [hoursFilter, setHoursFilter] = createSignal("x>0.01");
    const [dayFilter, setDayFilter] = createSignal("1 months");
    const [clientFilter, setClientFilter] = createSignal("");
    const [projectFilter, setProjectFilter] = createSignal("");
    const [showExportDialog, setShowExportDialog] = createSignal(false);
    const parsedDateRange = createMemo(() => parseDateRange(dayFilter()));

    const fxFunc = createMemo(() => (x: number) => {
        const r = (x: number, n = 1) => {
            const factor = Math.pow(10, n);
            return Math.round(x * factor) / factor;
        };
        const c = (x: number) => Math.ceil(x);
        const f = (x: number) => Math.floor(x);

        try {
            return (
                Math.round(
                    new Function("x", "r", "c", "f", "return " + fxExpr())(x, r, c, f) * 100
                ) / 100
            );
        } catch (e) {
            return "Error";
        }
    });

    const hoursFilterFunc = createMemo(() => (x: number): boolean | string => {
        if (hoursFilter() === "") {
            return true;
        }
        try {
            return new Function("x", "return " + hoursFilter())(x);
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

    const ExportDialog = () => {
        const [showProject, setShowProject] = createSignal(false);
        const [showClient, setShowClient] = createSignal(false);
        const data = createMemo(() =>
            checkedRows().map((id) => {
                const row = dataProcessed().rows.find((x) => x.id === id);
                if (!row) {
                    return "";
                }

                const cols = [formatDateTsv(row.day)];
                if (showClient()) {
                    cols.push(row.client);
                }
                if (showProject()) {
                    cols.push(row.project);
                }
                cols.push(typeof row.fx === "number" ? formatDecimal(row.fx) : row.fx);
                cols.push(row.summary);
                return cols.join("\t") + "\n";
            })
        );
        return (
            <>
                <div class="modal-backdrop fade show"></div>
                <div
                    class="modal d-block export-dialog"
                    tabindex="-1"
                    aria-modal="true"
                    role="dialog"
                >
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">{Lang.export}</h5>
                                <button
                                    type="button"
                                    class="btn-close"
                                    aria-label={Lang.close}
                                    onClick={() => setShowExportDialog(false)}
                                ></button>
                            </div>
                            <div class="modal-body">
                                <div class="form-check">
                                    <input
                                        class="form-check-input"
                                        type="checkbox"
                                        value=""
                                        checked={showProject()}
                                        onInput={(_e) => setShowProject(!showProject())}
                                        id="show-project"
                                    />
                                    <label class="form-check-label" for="show-project">
                                        {Lang.showProjects}
                                    </label>
                                </div>{" "}
                                <div class="form-check">
                                    <input
                                        class="form-check-input"
                                        type="checkbox"
                                        value=""
                                        checked={showClient()}
                                        onInput={(_e) => setShowClient(!showClient())}
                                        id="show-client"
                                    />
                                    <label class="form-check-label" for="show-client">
                                        {Lang.showClients}
                                    </label>
                                </div>
                                <textarea class="form-control" rows="15" cols="70">
                                    {data()}
                                </textarea>
                            </div>
                            <div class="modal-footer">
                                <button
                                    type="button"
                                    class="btn btn-secondary"
                                    data-bs-dismiss="modal"
                                    onClick={() => setShowExportDialog(false)}
                                >
                                    {Lang.close}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    };

    const dataProcessed = createMemo(() => {
        const data = getData();
        const rows =
            data
                ?.map((x) => ({
                    ...x,
                    id: x.day.toISOString() + x.client + x.project,
                    fx: fxFunc()(x.hours),
                }))
                .filter((f) => {
                    const hoursFilterResult = hoursFilterFunc()(f.hours);
                    return hoursFilterResult === true;
                }) ?? [];
        return {
            isLoading: data === undefined,
            totalHours: rows.reduce((acc, x) => acc + x.hours, 0),
            totalFx: rows.reduce((acc, x) => acc + (typeof x.fx === "number" ? x.fx : 0), 0),
            rows,
        };
    });

    const { checkedRows, isAllChecked, onChangeChecked, onChangeAllChecked } =
        createCheckboxManager(() => dataProcessed().rows);

    return (
        <>
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th class="cb"></th>
                        <th class="day">{Lang.day}</th>
                        <th class="client">{Lang.client}</th>
                        <th class="project">{Lang.project}</th>
                        <th class="hours">{Lang.hours}</th>
                        <th class="fx">{Lang.sum}</th>
                        <th class="summary">{Lang.summary}</th>
                    </tr>
                    <tr class="filter-row">
                        <th class="cb">
                            <input
                                class="form-check-input"
                                type="checkbox"
                                checked={isAllChecked()}
                                onChange={onChangeAllChecked}
                            />
                        </th>
                        <th class="day">
                            <input
                                class="form-control"
                                type="text"
                                value={dayFilter()}
                                onInput={(e) => {
                                    setDayFilter(e.currentTarget.value);
                                }}
                            />
                        </th>
                        <th class="client">
                            <input
                                class="form-control"
                                type="text"
                                value={clientFilter()}
                                onInput={(e) => {
                                    setClientFilter(e.currentTarget.value);
                                }}
                            />
                        </th>
                        <th class="project">
                            <input
                                class="form-control"
                                type="text"
                                value={projectFilter()}
                                onInput={(e) => {
                                    setProjectFilter(e.currentTarget.value);
                                }}
                            />
                        </th>
                        <th class="hours">
                            <input
                                class="form-control"
                                type="text"
                                value={hoursFilter()}
                                onInput={(e) => {
                                    setHoursFilter(e.currentTarget.value);
                                }}
                            />
                        </th>
                        <th class="fx">
                            <input
                                class="form-control"
                                type="text"
                                value={fxExpr()}
                                onInput={(e) => {
                                    setFxExpr(e.currentTarget.value);
                                }}
                            />
                        </th>
                        <th class="summary"></th>
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
                                    <td class="cb">
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
                                    <td class="day">{formatDate(row.day)}</td>
                                    <td class="client">{row.client}</td>
                                    <td class="project">{row.project}</td>
                                    <td class="hours">{Math.round(row.hours * 10) / 10}</td>
                                    <td class="fx">{row.fx}</td>
                                    <td class="summary">
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
                        <th class="cb">
                            {checkedRows().length > 0 ? (
                                <div class="actions">
                                    <button
                                        type="button"
                                        class="btn btn-primary"
                                        onClick={() => {
                                            setShowExportDialog(showExportDialog() ? false : true);
                                        }}
                                    >
                                        {Lang.export}&hellip;
                                    </button>
                                </div>
                            ) : null}
                        </th>
                        <th class="day"></th>
                        <th class="client"></th>
                        <th class="project"></th>
                        <th class="hours">{dataProcessed().totalHours?.toFixed(2)}</th>
                        <th class="fx">{dataProcessed().totalFx?.toFixed(2)}</th>
                        <th class="summary"></th>
                    </tr>
                </tfoot>
            </table>
            <Show when={showExportDialog()}>
                <ExportDialog />
            </Show>
        </>
    );
}
