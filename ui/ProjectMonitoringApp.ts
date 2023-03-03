/*
import { reactionWithOldValue } from "../utils/reactionWithOldValue";
import * as React from "react";
import { Api } from "./Api";
import { action, computed, observable, reaction, runInAction } from "mobx";
import { observer } from "mobx-react";
import { asDefaultMap } from "../utils/asDefaultMap";
import { Timings } from "../components/Timings";
import { asObservableDefaultMap } from "../utils/asObservableDefaultMap";
import { IPC_RENDERER, ENV, IS_DEBUG } from "../env";
import { string } from "prop-types";
import { ProjectMonitoringDb } from "./ProjectMonitoringDb";
import { TotalsCache } from "./TotalsCache";
*/
import {
    makeObservable,
    makeAutoObservable,
    observable,
    computed,
    action,
    flow,
    autorun,
} from "https://esm.sh/mobx";
import { Api } from "./Api.ts";
import { asDefaultMap } from "./utils/asDefaultMap.ts";
import { IPCProtocol, TauriProtocol } from "./IpcProtocol.ts";
import { ProjectMonitoringDb } from "./ProjectMonitoringDb.ts";
import { reactionWithOldValue } from "./utils/reactionWithOldValue.ts";
import { TotalsCache } from "./TotalsCache.ts";

interface Timing {
    client: string;
    project: string;
    start: Date;
    end: Date;
}

let db = new ProjectMonitoringDb();

// For debugging, etc. store db to the global variable
(window as any)["db"] = db;

const ENV = "development" as "development" | "production";
const IS_DEBUG = true;
type Timer = number;

export class ProjectMonitoringApp {
    @observable private isVisiblePerson = false;
    @observable private personDetectorConnected = false;
    @observable private isFocusedInput = false;
    @observable private isSuspended = false;
    @observable private client = "";
    @observable private project = "";
    @observable private pausedProjects: {
        client: string;
        project: string;
    }[] = [];
    @observable private start = new Date();
    @observable private end = new Date();
    @observable private isLoadingTotals = false;
    private totalsCache = new TotalsCache(db);

    private ipcRenderer: IPCProtocol;
    private hideAfterTimeout: any;
    private listenerInterval: any;
    private updateListenerInterval: any;
    private sendDesktopNameBounceTimeout: any;
    private refreshTypingTimeout: any;
    private storeToServiceInterval: Timer;
    private cleanReactionClientOrProjectChanges: () => void;

    constructor() {
        makeObservable(this);

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
        this.storeToServiceInterval = setInterval(
            this.storeTimingsToService,
            ENV == "production" ? 5 * 60000 : 30000 // 5 minutes = production, 30 seconds = development
        );
        this.updateListenerInterval = setInterval(async () => {
            if (this.isRunning) {
                try {
                    await db.addOrUpdateTiming(this.currentTiming);
                } catch (err) {
                    console.error("updateListenerInterval: Update index db error", err);
                }
            }
        }, 30000);
        this.cleanReactionClientOrProjectChanges = reactionWithOldValue(
            {
                client: "",
                project: "",
                isRunning: false,
            },
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
        clearInterval(this.listenerInterval);
        clearInterval(this.updateListenerInterval);
        clearInterval(this.storeToServiceInterval);
        clearTimeout(this.hideAfterTimeout);
        clearTimeout(this.sendDesktopNameBounceTimeout);
        clearTimeout(this.refreshTypingTimeout);
        this.cleanReactionClientOrProjectChanges();
    }

    render() {
        let totals = this.totalsCache.get(this.currentTiming);

        return {
            // currentDesktop: this.currentDesktop,
            clientName: this.client,
            projectName: this.project,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            onChangeClient: this.onChangeClient,
            onChangeProject: this.onChangeProject,
            personDetectorConnected: this.personDetectorConnected,
            onFocusedInput: this.onFocusedInput,
            isLoadingTotals: this.isLoadingTotals,
            todayTotal: totals.todayTotal,
            thisWeekTotal: totals.thisWeekTotal,
            lastWeekTotal: totals.lastWeekTotal,
            eightWeekTotal: totals.eightWeekTotal,
            onClickPlayPause: this.onClickPlayPause,
        };
    }

    private show = () => {
        clearTimeout(this.hideAfterTimeout);
        if (this.ipcRenderer) {
            setTimeout(() => {
                this.ipcRenderer.send("projectMonitoringShow");
            }, 30);
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
        if (this.isRunning) {
            this.end = new Date();
        }
    };

    @computed get isPaused() {
        return !!this.pausedProjects.find(
            (f) => f.client === this.client && f.project === this.project
        );
    }

    @computed
    private get isRunning() {
        let hasClientValue = !!this.client;
        let hasProjectValue = !!this.project;

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

    @computed
    private get currentTiming() {
        return {
            client: this.client,
            project: this.project,
            start: new Date(this.start.getTime()),
            end: new Date(this.end.getTime()),
        };
    }

    @action
    private clientOrProjectOrRunningChanges = (
        newValue: { client: string; project: string; isRunning: boolean },
        oldValue: { client: string; project: string; isRunning: boolean }
    ) => {
        // Update the totals from the cache or database, to avoid typing client
        // or project from spamming requests there is timeout
        clearTimeout(this.refreshTypingTimeout);
        this.refreshTypingTimeout = setTimeout(() => this.refreshTotals(newValue), 333);

        // If the last value was running, store it
        if (oldValue.isRunning) {
            this.storeCurrentTiming({
                client: oldValue.client,
                project: oldValue.project,
                start: new Date(this.start.getTime()),
                end: new Date(), // Current time
            });
        }

        // Running changes
        if (oldValue.isRunning != newValue.isRunning) {
            if (newValue.isRunning) {
                this.show();
            }
            this.ipcRenderer.send("projectMonitoringIsRunningChanged", newValue.isRunning);
        }

        // Reset the timing
        this.reset();
    };

    @action
    private playPause() {
        if (!this.client || !this.project) {
            return;
        }
        let i = this.pausedProjects.findIndex(
            (f) => f.client === this.client && f.project === this.project
        );
        if (i === -1) {
            this.pausedProjects.push({
                client: this.client,
                project: this.project,
            });
        } else {
            this.pausedProjects.splice(i, 1);
        }
    }

    @action
    private reset() {
        this.start = new Date();
        this.end = new Date();
    }

    private storeCurrentTiming = async (timing: Timing) => {
        let len = timing.end.getTime() - timing.start.getTime();
        if (IS_DEBUG) {
            console.log("try to store", timing.client, timing.project, len);
        }
        if (timing.client && timing.project && len > 3000) {
            await this.refreshTotals(timing);
            this.totalsCache.add(timing);
            await db.addOrUpdateTiming(timing);
        }
    };

    private storeTimingsToService = async () => {
        let timings = await db.getTimings();

        try {
            await Api.timings.post(timings);
            await db.deleteTimings(timings);
        } catch (e) {
            console.error("storeTimingsToService:", e);
        }
    };

    @action private refreshTotals = async (clientProject: { client: string; project: string }) => {
        this.isLoadingTotals = true;
        try {
            await this.totalsCache.refresh(clientProject);
        } catch (err) {
            console.error("refreshTotals:", err);
        } finally {
            this.isLoadingTotals = false;
        }
    };

    @action
    private onBlurApp = () => {
        this.isFocusedInput = false;
    };

    private onFocusApp = () => {
        // Nothing at the moment
    };

    @action
    onChangeClient = (v: string) => {
        // this.desktops.setDefault(this.currentDesktop).client = v;
        this.client = v;
        clearTimeout(this.sendDesktopNameBounceTimeout);
        this.sendDesktopNameBounceTimeout = setTimeout(this.sendDesktopName, 150);
    };

    @action
    private onChangeProject = (v: string) => {
        // this.desktops.setDefault(this.currentDesktop).project = v;
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
        console.log("main connected", data);
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
        console.log("Change desktop", desktop, client, project);
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
