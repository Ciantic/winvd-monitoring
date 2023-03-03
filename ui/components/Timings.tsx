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
export const Timings = (p: TimingsProps) => {
    let isFocused = false;
    const onChangeClient = (e: JSX.TargetedEvent<HTMLInputElement, Event>) => {
        if (p.onChangeClient) p.onChangeClient(e.currentTarget?.value);
    };
    const onChangeProject = (e: JSX.TargetedEvent<HTMLInputElement, Event>) => {
        if (p.onChangeProject) p.onChangeProject(e.currentTarget?.value);
    };
    const onFocus = (e: JSX.TargetedEvent<HTMLInputElement, Event>) => {
        isFocused = true;
        e.currentTarget?.select();
        setTimeout(() => isFocused && p.onFocusedInput && p.onFocusedInput(true), 30);
    };
    const onBlur = (e: JSX.TargetedEvent<HTMLInputElement, Event>) => {
        isFocused = false;
        if (e.currentTarget) {
            e.currentTarget.setSelectionRange(0, 0, "none");
        }
        setTimeout(() => !isFocused && p.onFocusedInput && p.onFocusedInput(false), 30);
    };
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
                onChange={onChangeProject}
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
