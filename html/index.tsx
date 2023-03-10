/**
 * @jsxImportSource https://esm.sh/preact
 **/

declare const __TAURI__: typeof import("npm:@tauri-apps/api");

import { autorun } from "https://esm.sh/mobx";
import { useState, useCallback, useEffect } from "https://esm.sh/preact/hooks";
import { render } from "https://esm.sh/preact";
import { ProjectMonitoringApp } from "../ui/ProjectMonitoringApp.ts";
import { Timings } from "../ui/components/Timings.tsx";

const currentWindow = __TAURI__.window.getCurrent();

const app = new ProjectMonitoringApp();

const App = () => {
    const [state, setState] = useState(() => app.render());
    useEffect(() => {
        autorun(() => {
            const vals = app.render();
            setState(vals);
        });
    }, []);

    const startDrag = useCallback(async () => {
        await currentWindow?.startDragging();
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
