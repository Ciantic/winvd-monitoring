/** @jsxImportSource npm:solid-js */
/// <reference lib="dom" />

import { For, Match } from "npm:solid-js";

import {
    createSolidTable,
    flexRender,
    createColumnHelper,
    getCoreRowModel,
} from "npm:@tanstack/solid-table";

type Stats = {
    client: string;
    project: string;
    hours: number;
};

const columnHelper = createColumnHelper<Stats>();

function App() {
    const table = createSolidTable({
        columns: [columnHelper.accessor("client", {})],
        data: [],
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <table>
            <thead>
                <For each={table.getHeaderGroups()}>
                    {(headerGroup) => (
                        <tr>
                            <For each={headerGroup.headers}>
                                {(header) => (
                                    <th>
                                        <Match when={!header.isPlaceholder}>
                                            {flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                        </Match>
                                    </th>
                                )}
                            </For>
                        </tr>
                    )}
                </For>
            </thead>
            <tbody>
                <For each={table.getRowModel().rows}>
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
                <For each={table.getFooterGroups()}>
                    {(footerGroup) => (
                        <tr>
                            <For each={footerGroup.headers}>
                                {(header) => (
                                    <th>
                                        <Match when={!header.isPlaceholder}>
                                            {flexRender(
                                                header.column.columnDef.footer,
                                                header.getContext()
                                            )}
                                        </Match>
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
