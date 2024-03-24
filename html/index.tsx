/**
 * @jsxImportSource npm:solid-js
 **/

declare const __TAURI__: typeof import("npm:@tauri-apps/api");

import { autorun } from "npm:mobx";
import { createSignal } from "npm:solid-js";
import { render } from "npm:solid-js/web";
import { MonitoringApp } from "../ui/MonitoringApp.ts";
import { Timings } from "../ui/components/Timings.tsx";

function startDragging() {
    if (typeof __TAURI__ === "undefined") return;
    __TAURI__.window.getCurrent().startDragging();
}

const app = new MonitoringApp();

const App = () => {
    const [state, setState] = createSignal(app.render());

    autorun(() => {
        setState(app.render());
    });

    const startDrag = async () => {
        await startDragging();
    };

    return (
        <div id="app">
            <Timings
                // currentDesktop={state().currentDesktop}
                clientName={state().clientName}
                projectName={state().projectName}
                summary={state().summary}
                eightWeekTotal={state().eightWeekTotal}
                isLoadingTotals={state().isLoadingTotals}
                isLoadingSummary={state().isLoadingSummary}
                isFocused={state().isFocused}
                isPaused={state().isPaused}
                isRunning={state().isRunning}
                lastWeekTotal={state().lastWeekTotal}
                personDetectorConnected={state().personDetectorConnected}
                thisWeekTotal={state().thisWeekTotal}
                todayTotal={state().todayTotal}
                startDragging={startDrag}
                onChangeClient={state().onChangeClient}
                onChangeProject={state().onChangeProject}
                onChangeSummary={state().onChangeSummary}
                onClickPlayPause={state().onClickPlayPause}
                onFocusedInput={state().onFocusedInput}
            />
        </div>
    );
};

render(() => <App />, document.getElementById("root") as any);
