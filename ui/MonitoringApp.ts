import { makeObservable, observable, computed, action, reaction } from "https://esm.sh/mobx";
import { TauriProtocol } from "./IpcProtocol.ts";
import { createSchema, getDailyTotals, insertTimings } from "./TimingDb.ts";
import { TimingRecorder } from "./TimingRecorder.ts";
import { emptyTotals, TotalsCache } from "./TotalsCache.ts";
import { cancellablePromise, CancellablePromise } from "./utils/cancellablePromise.ts";
import { Database } from "./utils/Database.ts";

declare function requestAnimationFrame(callback: () => void): void;

function key(client: string, project: string) {
    return `${client}~${project}`;
}

export class MonitoringApp {
    @observable private isVisiblePerson = false;
    @observable private personDetectorConnected = false;
    @observable private isFocusedApp = false;
    @observable private isFocusedInput = false;
    @observable private isSuspended = false;
    @observable private client = "";
    @observable private project = "";
    @observable private pausedProjects = new Map<string, boolean>();
    @observable private isLoadingTotals = false;
    @observable private totals = emptyTotals();

    private ipcRenderer: TauriProtocol = new TauriProtocol();
    private hideAfterTimeout = 0;
    private tickTimeout = 0;
    private updateTotalsTimeout = 0;
    private sendDesktopNameBounceTimeout = 0;
    private timingDb = new Database("sqlite:projects.db", createSchema);
    private recorder = new TimingRecorder(true, insertTimings.bind(null, this.timingDb));
    private totalsCache = new TotalsCache(getDailyTotals.bind(null, this.timingDb));
    private lastUpdateFromDb?: CancellablePromise<void>;

    private cleanReactionClientOrProjectChanges: () => void;

    constructor() {
        makeObservable(this);

        this.recorder.onInsertTiming.addListener(this.totalsCache.insertTiming, this.totalsCache);

        this.ipcRenderer.onVirtulaDesktopChanged(this.onChangeDesktop);
        this.ipcRenderer.onMonitoringPersonDetected(this.isPersonVisibleChanged);
        this.ipcRenderer.onMonitoringPersonDetectorConnection(
            this.onPersonDetectorConnectionChange
        );
        this.ipcRenderer.onMonitoringPowerStatusChanged(this.onPowerMonitorChanges);
        this.ipcRenderer.onTrayLeftClick(this.onTrayClick);
        this.ipcRenderer.onBlur(this.onBlurApp);
        this.ipcRenderer.onFocus(this.onFocusApp);

        this.ipcRenderer.monitoringConnected().then(this.onMainConnected.bind(this));

        this.tickTimeout = setTimeout(this.tick, 0);

        this.cleanReactionClientOrProjectChanges = reaction(
            () => ({
                client: this.client,
                project: this.project,
                isRunning: this.isRunning,
            }),
            (newValue, oldValue) => this.clientOrProjectOrRunningChanges(newValue, oldValue)
        );
    }

    destroy() {
        // Call this on componentWillUnmount
        this.recorder.onInsertTiming.removeListener(this.totalsCache.insertTiming);

        clearTimeout(this.tickTimeout);
        clearTimeout(this.hideAfterTimeout);
        clearTimeout(this.sendDesktopNameBounceTimeout);
        clearTimeout(this.updateTotalsTimeout);
        this.cleanReactionClientOrProjectChanges();
        if (this.lastUpdateFromDb) {
            this.lastUpdateFromDb.cancel();
        }
        this.recorder.destroy();
    }

    render() {
        return {
            // currentDesktop: this.currentDesktop,
            clientName: this.client,
            projectName: this.project,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            isFocused: this.isFocusedApp,
            personDetectorConnected: this.personDetectorConnected,
            isLoadingTotals: this.isLoadingTotals,
            todayTotal: this.totals.todayTotal,
            thisWeekTotal: this.totals.thisWeekTotal,
            lastWeekTotal: this.totals.lastWeekTotal,
            eightWeekTotal: this.totals.eightWeekTotal,
            onFocusedInput: this.onFocusedInput,
            onChangeClient: this.onChangeClient,
            onChangeProject: this.onChangeProject,
            onClickPlayPause: this.onClickPlayPause,
        };
    }

    private show = () => {
        clearTimeout(this.hideAfterTimeout);
        if (this.ipcRenderer) {
            // setTimeout(() => {
            this.ipcRenderer.monitoringShowWindow();
            // }, 30);
        }
        this.hideWait();
    };

    private hideWait = () => {
        clearTimeout(this.hideAfterTimeout);
        this.hideAfterTimeout = setTimeout(() => {
            if (this.isFocusedInput || this.isFocusedApp) {
                return;
            }

            if (this.ipcRenderer) {
                this.ipcRenderer.monitoringHideWindow();
            }
        }, 5000);
    };

    @action
    private tick = () => {
        this.tickTimeout = setTimeout(() => {
            requestAnimationFrame(this.tick);
        }, 1000);

        if (!this.isRunning) {
            return;
        }
        this.updateTotals();
    };

    @action
    private updateTotals = (now = new Date()) => {
        const { totals, updateFromDb } = this.totalsCache.getTotals(this.currentTiming, now);

        this.totals = totals;

        // Wait for totals to load, and refresh totals again
        if (updateFromDb) {
            this.isLoadingTotals = true;

            // Debounce database calls, only last one matters
            clearTimeout(this.updateTotalsTimeout);
            this.updateTotalsTimeout = setTimeout(() => {
                // Cancel the previous promise if it's still running
                if (this.lastUpdateFromDb) {
                    this.lastUpdateFromDb.cancel();
                }

                this.lastUpdateFromDb = cancellablePromise(updateFromDb());
                this.lastUpdateFromDb.promise
                    .then(
                        action(() => {
                            const now = new Date();

                            // Reupdate the totals, without hitting to db
                            const { totals } = this.totalsCache.getTotals(this.currentTiming, now);

                            this.totals = totals;
                            this.isLoadingTotals = false;
                        })
                    )
                    .catch(
                        action((e) => {
                            // If the promise was cancelled, we know that there
                            // is another promise that took it's place and it
                            // sets the isLoadingTotals to false
                            if (e.message !== "Promise cancelled") {
                                this.isLoadingTotals = false;
                            }
                        })
                    );
                // Note: finally() cannot be used here for
                // isLoadingTotals=false because we don't want to change the
                // value if the promise was cancelled
            }, 300);
        }
    };

    private get currentTiming() {
        return (
            this.recorder.getCurrent() ?? {
                client: this.client,
                project: this.project,
            }
        );
    }

    @computed
    private get isPaused() {
        return !!this.pausedProjects.get(key(this.client, this.project));
    }

    @computed
    private get isRunning() {
        const hasClientValue = !!this.client;
        const hasProjectValue = !!this.project;

        if (this.personDetectorConnected) {
            return (
                !this.isPaused &&
                this.isVisiblePerson &&
                !this.isFocusedInput &&
                hasClientValue &&
                hasProjectValue &&
                !this.isSuspended
            );
        }
        return (
            !this.isPaused &&
            !this.isFocusedInput &&
            hasProjectValue &&
            hasClientValue &&
            !this.isSuspended
        );
    }

    @action
    private clientOrProjectOrRunningChanges = (
        newValue: { client: string; project: string; isRunning: boolean },
        oldValue: { client: string; project: string; isRunning: boolean }
    ) => {
        const now = new Date();
        // If the last value was running, store it
        if (oldValue.isRunning) {
            this.recorder.stop(now);
        }
        if (newValue.isRunning) {
            this.recorder.start(
                {
                    client: this.client,
                    project: this.project,
                },
                now
            );
        }

        // Running changes
        if (oldValue.isRunning != newValue.isRunning) {
            if (newValue.isRunning) {
                this.show();
            }
            this.ipcRenderer.monitoringRunningChanged(newValue.isRunning);
        }

        this.updateTotals();
    };

    @action
    private playPause() {
        if (!this.client || !this.project) {
            return;
        }
        const paused = this.pausedProjects.get(key(this.client, this.project));
        this.pausedProjects.set(key(this.client, this.project), !paused);
    }

    @action
    private onBlurApp = () => {
        this.isFocusedInput = false;
        this.isFocusedApp = false;
        this.hideWait();
    };

    private onFocusApp = () => {
        this.isFocusedApp = true;
    };

    @action
    private onChangeClient = (v: string) => {
        this.client = v;
        clearTimeout(this.sendDesktopNameBounceTimeout);
        this.sendDesktopNameBounceTimeout = setTimeout(this.sendDesktopName, 150);
    };

    @action
    private onChangeProject = (v: string) => {
        this.project = v;
        clearTimeout(this.sendDesktopNameBounceTimeout);
        this.sendDesktopNameBounceTimeout = setTimeout(this.sendDesktopName, 150);
    };

    private sendDesktopName = () => {
        this.ipcRenderer.monitoringChangeDesktopName(`${this.client}: ${this.project}`);
    };

    @action
    private onPowerMonitorChanges = (event: "suspend" | "resume") => {
        this.isSuspended = event === "suspend" ? true : false;
    };

    @action
    private onMainConnected = (data: {
        desktop: { index: number; name: string };
        person_detector_connected: boolean;
        person_is_visible: boolean;
    }) => {
        this.personDetectorConnected = data.person_detector_connected;
        this.isVisiblePerson = data.person_is_visible;
        // this.updateDesktopsFromLocalDb().then(() => {
        this.onChangeDesktop(data.desktop);
        // });
    };

    @action
    private onChangeDesktop = (desktop: { index: number; name: string }) => {
        // TODO: Do I need desktop number? At the moment I don't

        const [client, project] = desktop.name.split(/:(.*)/, 2);
        this.client = (client ?? "").trim();
        this.project = (project ?? "").trim();
        this.show();
    };

    @action
    private onPersonDetectorConnectionChange = (isConnected: boolean) => {
        this.personDetectorConnected = isConnected;
    };

    @action
    private isPersonVisibleChanged = (isVisible: boolean) => {
        this.isVisiblePerson = isVisible;
    };

    @action
    private onFocusedInput = (isFocused: boolean) => {
        this.isFocusedInput = isFocused;
    };

    private onTrayClick = () => {
        this.show();
    };

    private onClickPlayPause = () => {
        this.playPause();
    };
}
