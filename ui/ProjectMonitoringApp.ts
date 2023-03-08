import { makeObservable, observable, computed, action, reaction } from "https://esm.sh/mobx";
import { IPCProtocol, TauriProtocol } from "./IpcProtocol.ts";
import { ProjectMonitoringDb } from "./ProjectMonitoringDb.ts";
import { emptyTotals, TotalsCache } from "./TotalsCache.ts";
import { cancellablePromise, CancellablePromise } from "./utils/cancellablePromise.ts";

function key(client: string, project: string) {
    return `${client}~${project}`;
}

export class ProjectMonitoringApp {
    @observable private isVisiblePerson = false;
    @observable private personDetectorConnected = false;
    @observable private isFocusedInput = false;
    @observable private isSuspended = false;
    @observable private client = "";
    @observable private project = "";
    @observable private pausedProjects = new Map<string, boolean>();
    @observable private isLoadingTotals = false;
    @observable private totals = emptyTotals();

    private ipcRenderer: IPCProtocol;
    private hideAfterTimeout = 0;
    private listenerInterval = 0;
    private updateTotalsTimeout = 0;
    private sendDesktopNameBounceTimeout = 0;
    private db = new ProjectMonitoringDb();
    private lastUpdateFromDb?: CancellablePromise<void>;
    private totalsCache = new TotalsCache();

    private cleanReactionClientOrProjectChanges: () => void;

    constructor() {
        makeObservable(this);

        this.db.onInsertTiming.addListener(this.totalsCache.insertTiming, this.totalsCache);

        this.ipcRenderer = new TauriProtocol();
        this.ipcRenderer.on("desktopChanged", this.onChangeDesktop);
        this.ipcRenderer.on("isVisiblePersonChanged", this.isPersonVisibleChanged);
        this.ipcRenderer.on(
            "personDetectorConnectionChanged",
            this.onPersonDetectorConnectionChange
        );
        this.ipcRenderer.on("mainConnected", this.onMainConnected);
        this.ipcRenderer.on("powerMonitorStatusChanged", this.onPowerMonitorChanges);
        this.ipcRenderer.on("trayClick", this.onTrayClick);
        this.ipcRenderer.on("blur", this.onBlurApp);
        this.ipcRenderer.on("focus", this.onFocusApp);
        this.ipcRenderer.send("projectMonitoringConnected");

        this.listenerInterval = setInterval(this.tick, 1000);

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
        this.db.onInsertTiming.removeListener(this.totalsCache.insertTiming);

        clearInterval(this.listenerInterval);
        clearTimeout(this.hideAfterTimeout);
        clearTimeout(this.sendDesktopNameBounceTimeout);
        clearTimeout(this.updateTotalsTimeout);
        this.cleanReactionClientOrProjectChanges();
        if (this.lastUpdateFromDb) {
            this.lastUpdateFromDb.cancel();
        }
        this.db.destroy();
    }

    render() {
        return {
            // currentDesktop: this.currentDesktop,
            clientName: this.client,
            projectName: this.project,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
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
            this.ipcRenderer.send("projectMonitoringShow");
            // }, 30);
        }
        this.hideWait();
    };

    private hideWait = () => {
        clearTimeout(this.hideAfterTimeout);
        this.hideAfterTimeout = setTimeout(() => {
            if (this.isFocusedInput) {
                return;
            }

            if (this.ipcRenderer) {
                this.ipcRenderer.send("projectMonitoringHide");
            }
        }, 5000);
    };

    @action
    private tick = () => {
        if (!this.isRunning) {
            return;
        }
        this.updateTotals();
    };

    @action
    private updateTotals = () => {
        const clientAndProject = {
            client: this.client,
            project: this.project,
        };

        const { totals, updateFromDb } = this.totalsCache.getTotals(
            clientAndProject,
            this.db.getCurrentTiming(),
            new Date()
        );

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
                            this.isLoadingTotals = false;

                            // Reupdate the totals, without hitting to db
                            const { totals } = this.totalsCache.getTotals(
                                clientAndProject,
                                this.db.getCurrentTiming()
                            );

                            this.totals = totals;
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
            this.db.stopTiming(now);
        }
        if (newValue.isRunning) {
            this.db.startTiming(
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
            this.ipcRenderer.send("projectMonitoringIsRunningChanged", newValue.isRunning);
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
    };

    private onFocusApp = () => {
        // Nothing at the moment
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
        this.ipcRenderer.send("desktopNameChanged", {
            name: `${this.client}: ${this.project}`,
        });
    };

    @action
    private onPowerMonitorChanges = (event: "suspend" | "resume") => {
        this.isSuspended = event === "suspend" ? true : false;
    };

    @action
    private onMainConnected = (data: {
        desktop: { index: number; name: string };
        personDetectorConnected: boolean;
        personIsVisible: boolean;
    }) => {
        this.personDetectorConnected = data.personDetectorConnected;
        this.isVisiblePerson = data.personIsVisible;
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
