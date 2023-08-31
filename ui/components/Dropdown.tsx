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
import { onMount } from "npm:solid-js";

function Dropdown(props: { open: boolean; x: number; y: number; children?: JSX.Element }) {
    // const [open, setOpen] = createSignal(false);
}

function ContextMenu(props: { triggerArea: (el: HTMLElement) => void }) {
    
}
