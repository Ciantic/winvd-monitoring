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

    onFocusedInput?: (focused: boolean) => void;
    onChangeClient?: (value: string) => void;
    onChangeProject?: (value: string) => void;
    onClickPlayPause?: () => void;
}

let focusedTimeout = 0;

export const Timings = (p: TimingsProps) => {
    const onChangeClient = useCallback((e: JSX.TargetedEvent<HTMLInputElement, Event>) => {
        if (p.onChangeClient) p.onChangeClient(e.currentTarget?.value);
    }, []);

    const onChangeProject = useCallback((e: JSX.TargetedEvent<HTMLInputElement, Event>) => {
        if (p.onChangeProject) p.onChangeProject(e.currentTarget?.value);
    }, []);

    const onFocus = useCallback((e: JSX.TargetedEvent<HTMLInputElement, Event>) => {
        // setFocused(true);
        e.currentTarget?.select();

        if (focusedTimeout) clearTimeout(focusedTimeout);
        focusedTimeout = setTimeout(() => {
            if (p.onFocusedInput) p.onFocusedInput(true);
        }, 200);

        // setTimeout(() => isFocused && p.onFocusedInput && p.onFocusedInput(true), 30);
    }, []);

    const onBlur = useCallback((e: JSX.TargetedEvent<HTMLInputElement, Event>) => {
        // setFocused(false);
        if (e.currentTarget) {
            e.currentTarget.setSelectionRange(0, 0, "none");
        }
        if (focusedTimeout) clearTimeout(focusedTimeout);
        focusedTimeout = setTimeout(() => {
            if (p.onFocusedInput) p.onFocusedInput(false);
        }, 200);
        // setTimeout(() => !isFocused && p.onFocusedInput && p.onFocusedInput(false), 30);
    }, []);

    return (
        <div
            className={cns("timings", p.isLoadingTotals && "loadingTotals", p.isPaused && "paused")}
        >
            <input
                type="text"
                onFocus={onFocus}
                onBlur={onBlur}
                onInput={onChangeClient}
                className={"clientName"}
                value={p.clientName}
            />
            <input
                type="text"
                onFocus={onFocus}
                onBlur={onBlur}
                onInput={onChangeProject}
                className={"projectName"}
                value={p.projectName}
            />
            <div className="todayIndicator">
                <div
                    className={["indicator", p.isRunning ? "enabled" : "disabled"].join(" ")}
                    onClick={p.onClickPlayPause}
                >
                    <div
                        className={[
                            "sensor",
                            p.personDetectorConnected ? "enabled" : "disabled",
                        ].join(" ")}
                    />
                </div>
                <div className={"today"}>{p.todayTotal.toFixed(3)}</div>
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
