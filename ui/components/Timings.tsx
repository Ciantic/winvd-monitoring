/**
 * @jsxImportSource npm:solid-js
 **/

import { JSX } from "npm:solid-js/jsx-runtime";
import { Lang } from "../Lang.ts";
import { cns } from "../utils/classnames.ts";

export interface TimingsProps {
    // currentDesktop: string;
    clientName: string;
    projectName: string;
    summary: string;
    isFocused: boolean;
    isRunning: boolean;
    isPaused: boolean;
    personDetectorConnected: boolean;
    todayTotal: number;
    thisWeekTotal: number;
    lastWeekTotal: number;
    eightWeekTotal: number;
    isLoadingTotals: boolean;
    isLoadingSummary: boolean;

    startDragging: () => void;
    onFocusedInput?: (focused: boolean) => void;
    onChangeClient?: (value: string) => void;
    onChangeProject?: (value: string) => void;
    onChangeSummary?: (value: string) => void;
    onClickPlayPause?: () => void;
}

// Intentionally outside the component
let focusedTimeout = 0;

function durationFormatHHMMSS(hours: number): string {
    const fullHours = Math.floor(hours);
    const minutes = Math.floor((hours - fullHours) * 60);
    const seconds = Math.floor(((hours - fullHours) * 60 - minutes) * 60);

    const hoursStr = fullHours.toString();
    const minutesStr = minutes.toString().padStart(2, "0");
    const secondsStr = seconds.toString().padStart(2, "0");
    return `${hoursStr}:${minutesStr}:${secondsStr}`;
}
function durationFormatHHMM(hours: number): string {
    const fullHours = Math.floor(hours);
    const minutes = Math.floor((hours - fullHours) * 60);

    const hoursStr = fullHours.toString();
    const minutesStr = minutes.toString().padStart(2, "0");
    return `${hoursStr}:${minutesStr}`;
}

export const Timings = (p: TimingsProps) => {
    const onChangeClient: JSX.EventHandlerUnion<HTMLInputElement, InputEvent> = (e) => {
        p.onChangeClient?.(e.currentTarget?.value);
    };

    const onChangeProject: JSX.EventHandlerUnion<HTMLInputElement, InputEvent> = (e) => {
        p.onChangeProject?.(e.currentTarget?.value);
    };

    const onChangeSummary: JSX.EventHandlerUnion<HTMLInputElement, InputEvent> = (e) => {
        p.onChangeSummary?.(e.currentTarget?.value);
    };

    const onFocus: JSX.EventHandlerUnion<HTMLInputElement, FocusEvent> = (e) => {
        e.currentTarget?.select();

        if (focusedTimeout) clearTimeout(focusedTimeout);
        focusedTimeout = setTimeout(() => {
            p.onFocusedInput?.(true);
        }, 200);
    };

    const onBlur: JSX.EventHandlerUnion<HTMLInputElement, FocusEvent> = (e) => {
        // setFocused(false);
        e.currentTarget?.setSelectionRange(0, 0, "none");

        if (focusedTimeout) clearTimeout(focusedTimeout);
        focusedTimeout = setTimeout(() => {
            p.onFocusedInput?.(false);
        }, 200);
    };

    const onClickPlayPause = () => {
        p.onClickPlayPause?.();
    };

    const onStartDragging: JSX.EventHandlerUnion<HTMLDivElement, MouseEvent> = (e) => {
        if (e.target instanceof HTMLInputElement) return;
        if (e.target instanceof HTMLDivElement && e.target.matches(".indicator")) return;
        p.startDragging();
    };

    return (
        <div
            class={cns(
                "timings",
                p.isFocused && "isFocused",
                p.isLoadingTotals && "loadingTotals",
                p.isLoadingTotals && "loadingSummary",
                p.summary.length > 0 && "hasSummary"
            )}
            onMouseDown={onStartDragging}
        >
            <input
                type="text"
                onFocus={onFocus}
                onBlur={onBlur}
                onInput={onChangeClient}
                class={"clientName"}
                value={p.clientName}
                spellcheck={false}
            />
            <input
                type="text"
                onFocus={onFocus}
                onBlur={onBlur}
                onInput={onChangeProject}
                class={"projectName"}
                value={p.projectName}
                spellcheck={false}
            />
            <input
                type="text"
                onFocus={onFocus}
                onBlur={onBlur}
                onInput={onChangeSummary}
                class={"summary"}
                value={p.summary}
                spellcheck={false}
                disabled={p.isLoadingSummary}
            />
            <div class="todayIndicator">
                <div
                    class={cns(
                        "indicator",
                        p.isRunning ? "enabled" : "disabled",
                        p.isPaused && "paused"
                    )}
                    onClick={onClickPlayPause}
                >
                    <div
                        class={["sensor", p.personDetectorConnected ? "enabled" : "disabled"].join(
                            " "
                        )}
                    />
                </div>
                <div class={"today"}>{p.todayTotal.toFixed(1)}</div>
            </div>
            <div class={"eightWeek"}>
                <div class={"count"}>{p.eightWeekTotal.toFixed(1)}</div>
                <div class={"text"}>{Lang.eightWeek}</div>
            </div>
            <div class={"lastWeek"}>
                <div class={"count"}>{p.lastWeekTotal.toFixed(1)}</div>
                <div class={"text"}>{Lang.lastWeek}</div>
            </div>
            <div class={"thisWeek"}>
                <div class={"count"}>{p.thisWeekTotal.toFixed(1)}</div>
                <div class={"text"}>{Lang.thisWeek}</div>
            </div>
        </div>
    );
};
