/**
 * @jsxImportSource npm:preact
 **/

declare const __TAURI__: typeof import("npm:@tauri-apps/api");

import { autorun } from "npm:mobx";
import { useState, useCallback, useEffect } from "npm:preact/hooks";
import { render } from "npm:preact";
import { MonitoringApp } from "../ui/MonitoringApp.ts";
import { Timings } from "../ui/components/Timings.tsx";

function startDragging() {
    if (typeof __TAURI__ === "undefined") return;
    __TAURI__.window.getCurrent().startDragging();
}

const app = new MonitoringApp();

const App = () => {
    const [state, setState] = useState(() => app.render());
    useEffect(() => {
        autorun(() => {
            const vals = app.render();
            setState(vals);
        });
    }, []);

    const startDrag = useCallback(async () => {
        await startDragging();
    }, []);

    return (
        <div id="app">
            <Timings
                // currentDesktop={state.currentDesktop}
                clientName={state.clientName}
                projectName={state.projectName}
                eightWeekTotal={state.eightWeekTotal}
                isLoadingTotals={state.isLoadingTotals}
                isFocused={state.isFocused}
                isPaused={state.isPaused}
                isRunning={state.isRunning}
                lastWeekTotal={state.lastWeekTotal}
                personDetectorConnected={state.personDetectorConnected}
                thisWeekTotal={state.thisWeekTotal}
                todayTotal={state.todayTotal}
                startDragging={startDrag}
                onChangeClient={state.onChangeClient}
                onChangeProject={state.onChangeProject}
                onClickPlayPause={state.onClickPlayPause}
                onFocusedInput={state.onFocusedInput}
            />
        </div>
    );
};

render(<App />, document.getElementById("root") as any);
