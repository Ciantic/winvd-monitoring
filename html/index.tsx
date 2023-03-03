/**
 * @jsxImportSource https://esm.sh/preact
 **/

declare global {
    const __TAURI__: typeof import("npm:@tauri-apps/api");
}

import { autorun } from "https://esm.sh/mobx";
import { useState, useCallback, useEffect } from "https://esm.sh/preact/hooks";
import { render } from "https://esm.sh/preact";
import { useImmer } from "./useImmer.ts";
import { ProjectMonitoringApp } from "../ui/ProjectMonitoringApp.ts";
import { Timings } from "../ui/components/Timings.tsx";

interface Desktop {
    index: number;
    name: string;
}

type DesktopChanged = Desktop;

type SystemTrayEvent = "LeftClick";

const TauriEvent = __TAURI__.event.TauriEvent;
const currentWindow = __TAURI__.window.getCurrent();

function useIntervalEffect(func: () => void, timeout: number) {
    useEffect(() => {
        const interval = setInterval(() => {
            func();
        }, timeout);
        return () => clearInterval(interval);
    }, []);
}

function useTauriListen<T>(eventName: string, callback: (e: T) => void) {
    useEffect(() => {
        const unlistenPromise = __TAURI__?.event.listen<T>(eventName, (e) => {
            callback(e.payload);
        });
        return () => {
            unlistenPromise?.then((unlisten) => unlisten());
        };
    }, []);
}

function useAppState() {
    const [state, setState] = useImmer({
        titleFocused: false,
        subtitleFocused: false,
        showTimeout: 0,
        currentDesktop: {
            index: 0,
            name: "Untitled",
        } as Desktop,
    });

    return {
        state,
        setDesktop(desktop: Desktop) {
            setState((draft) => {
                draft.currentDesktop = desktop;
            });
        },
        showFor3Seconds() {
            this.cancelShowTimeout();
            setState((draft) => {
                console.log("Shwo for 3 seconds");
                currentWindow?.show();
                draft.showTimeout = setTimeout(() => {
                    setState((draft) => {
                        draft.showTimeout = 0;
                        if (!draft.titleFocused && !draft.subtitleFocused) {
                            console.log("Hiding window", draft.titleFocused, draft.subtitleFocused);
                            currentWindow?.hide();
                        }
                    });
                }, 3000);
            });
        },

        setFocused(field: "titleFocused" | "subtitleFocused", focused: boolean) {
            setState((draft) => {
                draft[field] = focused;
                if (!draft.subtitleFocused || !draft.titleFocused) {
                    this.showFor3Seconds();
                }
            });
        },

        cancelShowTimeout() {
            console.log("Cancel hiding");
            setState((draft) => {
                if (draft.showTimeout) {
                    clearTimeout(draft.showTimeout);
                    draft.showTimeout = 0;
                }
            });
        },
    };
}

const app = new ProjectMonitoringApp();

const App = () => {
    const [state, setState] = useState(app.render());
    useEffect(() => {
        autorun(() => {
            setState(app.render());
        });
    }, []);
    //const app = useAppState();

    // useTauriListen<DesktopChanged>("DesktopChanged", (desktop) => {
    //     app.showFor3Seconds();
    //     console.log("DesktopChanged", desktop);
    //     app.setDesktop(desktop);
    // });

    // useTauriListen<SystemTrayEvent>("SystemTrayEvent", async (eventName) => {
    //     if (eventName === "LeftClick") {
    //         app.cancelShowTimeout();
    //         if (await currentWindow?.isVisible()) {
    //             await currentWindow?.hide();
    //         } else {
    //             await currentWindow?.show();
    //         }
    //     }
    // });

    // useTauriListen<void>(TauriEvent.WINDOW_MOVED, () => {
    //     app.showFor3Seconds();
    // });

    // useTauriListen<void>(TauriEvent.WINDOW_RESIZED, () => {
    //     app.showFor3Seconds();
    // });

    const startDrag = useCallback(async (e: MouseEvent) => {
        await currentWindow?.startDragging();
    }, []);

    // (e: InputEvent) => {
    //     const input = e.target as HTMLInputElement;
    //     const value = input.value;

    //     __TAURI__.event.emit("DesktopNameChanged", {
    //         index: app.state.currentDesktop.index,
    //         name: value,
    //     });
    // },
    // [app.state.currentDesktop.index]

    // const [firstLineName, secondLineName] = app.state.currentDesktop.name.split(":") || [];
    // const firstLineName = app.state.currentDesktop.name;
    // const secondLineName = "";

    return (
        <div onMouseDown={startDrag} id="app">
            <Timings
                // currentDesktop={state.currentDesktop}
                clientName={state.clientName}
                projectName={state.projectName}
                eightWeekTotal={state.eightWeekTotal}
                isLoadingTotals={state.isLoadingTotals}
                isPaused={state.isPaused}
                isRunning={state.isRunning}
                lastWeekTotal={state.lastWeekTotal}
                personDetectorConnected={state.personDetectorConnected}
                thisWeekTotal={state.thisWeekTotal}
                todayTotal={state.todayTotal}
                onChangeClient={state.onChangeClient}
                onChangeProject={state.onChangeProject}
                onClickPlayPause={state.onClickPlayPause}
                onFocusedInput={state.onFocusedInput}
            />
            {/* <input
                class="title"
                type="text"
                value={firstLineName}
                onInput={onInput as any}
                onFocus={useCallback(() => app.setFocused("titleFocused", true), [])}
                onBlur={useCallback(() => app.setFocused("titleFocused", false), [])}
            />
            <input
                class="subtitle"
                type="text"
                value={secondLineName}
                onFocus={useCallback(() => app.setFocused("subtitleFocused", true), [])}
                onBlur={useCallback(() => app.setFocused("subtitleFocused", false), [])}
            />
            {app.state.showTimeout ? "hiding in ..." : ""} */}
        </div>
    );
};

render(<App />, document.getElementById("root") as any);
