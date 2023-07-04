/** @jsxImportSource npm:solid-js */
/// <reference lib="dom" />

import { For, Show, createResource, Suspense, Resource } from "npm:solid-js";
import {
    createSolidTable,
    flexRender,
    createColumnHelper,
    getCoreRowModel,
    ColumnDef,
} from "npm:@tanstack/solid-table";

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

function StatsTable({ data }: { data: Resource<Stats[]> }) {
    const columnHelper = createColumnHelper<Stats>();
    const columns = [
        columnHelper.accessor("day", {
            header: Lang.day,
            // Finnish date format
            cell: (cell) => formatDate(cell.getValue()),
        }),
        columnHelper.accessor("client", {
            header: Lang.client,
        }),
        columnHelper.accessor("project", {
            header: Lang.project,
        }),
        columnHelper.accessor("hours", {
            header: Lang.hours,
            cell: (cell) => {
                const value = cell.getValue();
                return Math.round(value * 10) / 10;
            },
        }),
        columnHelper.accessor((row) => row, {
            header: Lang.summary,
            cell: (cell) => {
                const value = cell.getValue();
                return (
                    <input
                        class="form-control"
                        type="text"
                        value={value.summary}
                        onInput={(e) => {
                            insertSummaryForDay(timingDb, {
                                day: value.day,
                                summary: e.currentTarget.value,
                                client: value.client,
                                project: value.project,
                            });
                        }}
                    />
                );
            },
        }),
    ];

    const table = () =>
        createSolidTable<Stats>({
            columns,
            data: data() || [],
            getCoreRowModel: getCoreRowModel(),
        });

    return (
        <table class="table">
            <thead>
                <For each={table().getHeaderGroups()}>
                    {(headerGroup) => (
                        <tr>
                            <For each={headerGroup.headers}>
                                {(header) => (
                                    <th>
                                        <Show when={!header.isPlaceholder}>
                                            {flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                        </Show>
                                    </th>
                                )}
                            </For>
                        </tr>
                    )}
                </For>
            </thead>
            <tbody>
                <For each={table().getRowModel().rows}>
                    {(row) => (
                        <tr>
                            <For each={row.getVisibleCells()}>
                                {(cell) => (
                                    <td>
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                )}
                            </For>
                        </tr>
                    )}
                </For>
            </tbody>
            <tfoot>
                <For each={table().getFooterGroups()}>
                    {(footerGroup) => (
                        <tr>
                            <For each={footerGroup.headers}>
                                {(header) => (
                                    <th>
                                        <Show when={!header.isPlaceholder}>
                                            {flexRender(
                                                header.column.columnDef.footer,
                                                header.getContext()
                                            )}
                                        </Show>
                                    </th>
                                )}
                            </For>
                        </tr>
                    )}
                </For>
            </tfoot>
        </table>
    );
}

const timingDb = createTimingDatabase();

export function Stats() {
    const daysAgo120 = new Date();
    daysAgo120.setDate(daysAgo120.getDate() - 120);

    async function fetchData() {
        // Simulate by waiting
        // await new Promise((resolve) => setTimeout(resolve, 1000));

        return await getDailyTotals(timingDb, {
            from: daysAgo120,
            to: new Date(),
        });
    }

    const [getData] = createResource(fetchData);

    return (
        <div>
            <Suspense
                fallback={
                    <div class="loading-fullscreen">
                        <div class="spinner">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    </div>
                }
            >
                <StatsTable data={getData} />
            </Suspense>
        </div>
    );
}
