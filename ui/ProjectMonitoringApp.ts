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
    runInAction,
} from "https://esm.sh/mobx";
import { Api } from "./Api.ts";
import { IPCProtocol, TauriProtocol } from "./IpcProtocol.ts";
import { ProjectMonitoringDb } from "./ProjectMonitoringDb.ts";
import { reactionWithOldValue } from "./utils/reactionWithOldValue.ts";

interface Timing {
    client: string;
    project: string;
    start: Date;
    end: Date;
}

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
    @observable private isLoadingTotals = false;
    @observable private totals = {
        todayTotal: 0,
        thisWeekTotal: 0,
        lastWeekTotal: 0,
        eightWeekTotal: 0,
        total: 0,
    };

    private ipcRenderer: IPCProtocol;
    private hideAfterTimeout = 0;
    private listenerInterval = 0;
    private updateTotalsTimeout = 0;
    private sendDesktopNameBounceTimeout = 0;
    private db = new ProjectMonitoringDb();

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

        // this.updateListenerInterval = setInterval(() => {
        //     if (this.isRunning) {
        //         this.db.addOrUpdateTiming(this.currentTiming);
        //     }
        // }, 30000);
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
        clearTimeout(this.hideAfterTimeout);
        clearTimeout(this.sendDesktopNameBounceTimeout);
        clearTimeout(this.updateTotalsTimeout);
        this.cleanReactionClientOrProjectChanges();
        this.db.destroy();
    }

    render() {
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
            todayTotal: this.totals.todayTotal,
            thisWeekTotal: this.totals.thisWeekTotal,
            lastWeekTotal: this.totals.lastWeekTotal,
            eightWeekTotal: this.totals.eightWeekTotal,
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
        if (!this.isRunning) {
            return;
        }
        this.updateTotals();
    };

    @action
    private updateTotals = (loadApiTotals = true) => {
        const { totals, loadingTotals } = this.db.getTotals(
            {
                client: this.client,
                project: this.project,
            },
            loadApiTotals
        );

        this.totals = totals;

        // Wait for totals to load, and refresh totals again
        if (loadingTotals) {
            this.isLoadingTotals = true;
            loadingTotals.then(() => {
                runInAction(() => {
                    this.isLoadingTotals = false;
                });
                console.log("REFRESH AGAIN", this.client, this.project);
                this.updateTotals();
            });
        }
    };

    @computed get isPaused() {
        return !!this.pausedProjects.find(
            (f) => f.client === this.client && f.project === this.project
        );
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

        this.updateTotals(false);

        // Update API totals after a timeout, to avoid throttling
        clearTimeout(this.updateTotalsTimeout);
        this.updateTotalsTimeout = setTimeout(() => {
            console.log("Update after timeout");
            this.updateTotals();
        }, 333);
    };

    @action
    private playPause() {
        if (!this.client || !this.project) {
            return;
        }
        const i = this.pausedProjects.findIndex(
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
        console.log("Set project name", v);
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
