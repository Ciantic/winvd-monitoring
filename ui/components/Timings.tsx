/**
 * @jsxImportSource https://esm.sh/preact
 **/

import { useState, useCallback, useEffect } from "https://esm.sh/preact/hooks";
import { render, JSX } from "https://esm.sh/preact";

// import styles from "./Timings.module.scss";
import { Lang } from "../Lang.ts";
import { cns } from "../utils/classnames.ts";

export interface TimingsProps {
    // currentDesktop: string;
    clientName: string;
    projectName: string;
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
            className={cns("timings", p.isLoadingTotals && "loadingTotals")}
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
                <div className={"today"}>{p.todayTotal.toFixed(8)}</div>
            </div>
            <div className={"eightWeek"}>
                <div className={"count"}>{p.eightWeekTotal.toFixed(8)}</div>
                <div className={"text"}>{Lang.eightWeek}</div>
            </div>
            <div className={"lastWeek"}>
                <div className={"count"}>{p.lastWeekTotal.toFixed(8)}</div>
                <div className={"text"}>{Lang.lastWeek}</div>
            </div>
            <div className={"thisWeek"}>
                <div className={"count"}>{p.thisWeekTotal.toFixed(8)}</div>
                <div className={"text"}>{Lang.thisWeek}</div>
            </div>
        </div>
    );
};
