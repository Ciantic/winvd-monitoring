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

import { Lang } from "../Lang.ts";
import {
    formatDateLong,
    formatDateRange,
    formatDateTsv,
    formatDecimal,
    parseDateRange,
} from "../utils/formatDate.ts";
import { getDailyTotals, getSummaries, insertSummaryForDay } from "../TimingDb.ts";
import { createTimingDatabase } from "../TimingDbCreator.ts";
import { minMaxValue } from "../utils/minMaxValue.ts";
import { createUrlSignal } from "../utils/createUrlSignal.ts";

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

async function fetchData(props: { from?: Date; to?: Date; client: string; project: string }) {
    // Simulate by waiting
    // await new Promise((resolve) => setTimeout(resolve, 1000));
    if (!props.from) {
        return [];
    }

    return await getDailyTotals(timingDb, {
        from: props.from,
        to: props.to ?? new Date(),
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
    const [fxExpr, setFxExpr] = createUrlSignal("r(x*1.25*2,0)/2", "expr");
    const [hoursFilter, setHoursFilter] = createUrlSignal("x>0.01", "hours");
    const [dayFilter, setDayFilter] = createUrlSignal("1 months", "day");
    const [clientFilter, setClientFilter] = createUrlSignal("", "client");
    const [projectFilter, setProjectFilter] = createUrlSignal("", "project");
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
        const [showProject, setShowProject] = createSignal(true);
        const [showClient, setShowClient] = createSignal(true);
        const [gropuByProject, setGroupByProject] = createSignal(false);
        const [textareaRef, setTextareaRef] = createSignal<HTMLTextAreaElement | null>(null);

        function allRows() {
            return checkedRows().map((id) => {
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
            });
        }

        function groupByProject() {
            const grouped = dataProcessed()
                .rows.filter((x) => checkedRows().find((id) => id === x.id))
                .reduce((acc, x) => {
                    const key = x.client + "\t" + x.project;
                    if (!acc[key]) {
                        acc[key] = {
                            client: x.client,
                            project: x.project,
                            fx: 0,
                            summaries: [],
                        };
                    }
                    acc[key].fx += typeof x.fx === "number" ? x.fx : 0;
                    acc[key].summaries.push({ day: x.day, summary: x.summary });
                    return acc;
                }, {} as Record<string, { client: string; project: string; fx: number; summaries: { day: Date; summary: string }[] }>);
            return Object.values(grouped).map((x) => {
                const cols = [];
                if (showClient()) {
                    cols.push(x.client);
                }
                if (showProject()) {
                    cols.push(x.project);
                }
                cols.push(formatDecimal(x.fx));
                const [first, last] = minMaxValue(x.summaries, (x) => x.day.getTime());
                if (!first || !last) {
                    return "";
                }

                cols.push(
                    first.day === last.day
                        ? formatDateTsv(first.day)
                        : formatDateRange({ from: first.day, to: last.day })
                );
                return cols.join("\t") + "\n";
            });
        }
        const tsvText = createMemo(() => {
            if (gropuByProject()) {
                return groupByProject();
            } else {
                return allRows();
            }
        });
        createEffect(() => {
            const textarea = textareaRef();
            if (textarea) {
                textarea.select();
                textarea.setSelectionRange(0, 99999);
                document.execCommand("copy");
            }
        });
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
                                        checked={showClient()}
                                        onInput={(_e) => setShowClient(!showClient())}
                                        id="show-client"
                                    />
                                    <label class="form-check-label" for="show-client">
                                        {Lang.showClients}
                                    </label>
                                </div>
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
                                </div>
                                <div class="form-check">
                                    <input
                                        class="form-check-input"
                                        type="checkbox"
                                        value=""
                                        checked={gropuByProject()}
                                        onInput={(_e) => setGroupByProject(!gropuByProject())}
                                        id="group-by-project"
                                    />
                                    <label class="form-check-label" for="group-by-project">
                                        {Lang.groupByProject}
                                    </label>
                                </div>
                                <textarea
                                    class="form-control"
                                    rows="15"
                                    cols="70"
                                    ref={setTextareaRef}
                                >
                                    {tsvText()}
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
                                    <td class="day">{formatDateLong(row.day)}</td>
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
