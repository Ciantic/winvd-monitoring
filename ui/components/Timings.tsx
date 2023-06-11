/**
 * @jsxImportSource npm:preact
 **/

import { useCallback } from "npm:preact/hooks";
import { JSX } from "npm:preact";

// import styles from "./Timings.module.scss";
import { Lang } from "../Lang.ts";
import { cns } from "../utils/classnames.ts";

export interface TimingsProps {
    // currentDesktop: string;
    clientName: string;
    projectName: string;
    isFocused: boolean;
    isRunning: boolean;
    isPaused: boolean;
    personDetectorConnected: boolean;
    todayTotal: number;
    thisWeekTotal: number;
    lastWeekTotal: number;
    eightWeekTotal: number;
    isLoadingTotals: boolean;

    startDragging: () => void;
    onFocusedInput?: (focused: boolean) => void;
    onChangeClient?: (value: string) => void;
    onChangeProject?: (value: string) => void;
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
    const onChangeClient = useCallback((e: JSX.TargetedEvent<HTMLInputElement, Event>) => {
        p.onChangeClient?.(e.currentTarget?.value);
    }, []);

    const onChangeProject = useCallback((e: JSX.TargetedEvent<HTMLInputElement, Event>) => {
        p.onChangeProject?.(e.currentTarget?.value);
    }, []);

    const onFocus = useCallback((e: JSX.TargetedEvent<HTMLInputElement, Event>) => {
        e.currentTarget?.select();

        if (focusedTimeout) clearTimeout(focusedTimeout);
        focusedTimeout = setTimeout(() => {
            p.onFocusedInput?.(true);
        }, 200);
    }, []);

    const onBlur = useCallback((e: JSX.TargetedEvent<HTMLInputElement, Event>) => {
        // setFocused(false);
        e.currentTarget?.setSelectionRange(0, 0, "none");

        if (focusedTimeout) clearTimeout(focusedTimeout);
        focusedTimeout = setTimeout(() => {
            p.onFocusedInput?.(false);
        }, 200);
    }, []);

    const onClickPlayPause = useCallback(() => {
        p.onClickPlayPause?.();
    }, []);

    const onStartDragging = useCallback((e: JSX.TargetedMouseEvent<HTMLDivElement>) => {
        if (e.target instanceof HTMLInputElement) return;
        if (e.target instanceof HTMLDivElement && e.target.matches(".indicator")) return;
        p.startDragging();
    }, []);

    return (
        <div
            className={cns(
                "timings",
                p.isFocused && "isFocused",
                p.isLoadingTotals && "loadingTotals"
            )}
            onMouseDown={onStartDragging}
        >
            <input
                type="text"
                onFocus={onFocus}
                onBlur={onBlur}
                onInput={onChangeClient}
                className={"clientName"}
                value={p.clientName}
                spellcheck={false}
            />
            <input
                type="text"
                onFocus={onFocus}
                onBlur={onBlur}
                onInput={onChangeProject}
                className={"projectName"}
                value={p.projectName}
                spellcheck={false}
            />
            <div className="todayIndicator">
                <div
                    className={cns(
                        "indicator",
                        p.isRunning ? "enabled" : "disabled",
                        p.isPaused && "paused"
                    )}
                    onClick={onClickPlayPause}
                >
                    <div
                        className={[
                            "sensor",
                            p.personDetectorConnected ? "enabled" : "disabled",
                        ].join(" ")}
                    />
                </div>
                <div className={"today"}>{p.todayTotal.toFixed(1)}</div>
            </div>
            <div className={"eightWeek"}>
                <div className={"count"}>{p.eightWeekTotal.toFixed(1)}</div>
                <div className={"text"}>{Lang.eightWeek}</div>
            </div>
            <div className={"lastWeek"}>
                <div className={"count"}>{p.lastWeekTotal.toFixed(1)}</div>
                <div className={"text"}>{Lang.lastWeek}</div>
            </div>
            <div className={"thisWeek"}>
                <div className={"count"}>{p.thisWeekTotal.toFixed(1)}</div>
                <div className={"text"}>{Lang.thisWeek}</div>
            </div>
        </div>
    );
};
