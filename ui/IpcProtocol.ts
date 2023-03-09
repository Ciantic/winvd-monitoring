declare const __TAURI__: typeof import("npm:@tauri-apps/api");

export interface IPCProtocol {
    // on(event: string, listener: (...args: any[]) => void): void;
    // send(event: string, ...args: any[]): void;
    send(event: "projectMonitoringConnected"): void;
    send(event: "projectMonitoringHide"): void;
    send(event: "projectMonitoringShow"): void;
    send(event: "projectMonitoringIsRunningChanged", isRunning: boolean): void;
    send(
        event: "desktopNameChanged",
        newName: {
            name: string;
        }
    ): void;
}

export class TauriProtocol implements IPCProtocol {
    on(event: string, listener: (...args: any[]) => void): void {
        if (typeof __TAURI__ != "undefined") {
            __TAURI__.event.listen(event, (e) => {
                console.log("Got event", event, e.payload);
                listener(e.payload);
            });
        } else console.log("on", event);
    }

    send(event: string, payload?: any): void {
        if (typeof __TAURI__ != "undefined") {
            if (event == "projectMonitoringHide") {
                __TAURI__.invoke("hide_window");
                // __TAURI__.window.getCurrent().hide();
                return;
            }
            if (event == "projectMonitoringShow") {
                __TAURI__.invoke("show_window");
                // __TAURI__.window.getCurrent().show();
                return;
            }
            __TAURI__.event.emit(event, payload);
        } else console.log("send", event, payload);
    }
}
/*
this.ipcRenderer.send("projectMonitoringConnected");
this.ipcRenderer.send("projectMonitoringShow");
this.ipcRenderer.send("projectMonitoringHide");
this.ipcRenderer.send("projectMonitoringIsRunningChanged", newValue.isRunning);

ipcRenderer.on("desktopChanged", this.onChangeDesktop as any);
ipcRenderer.on("isVisiblePersonChanged", this.isPersonVisibleChanged as any);
ipcRenderer.on("personDetectorConnectionChanged", this.onPersonDetectorConnectionChange as any
ipcRenderer.on("mainConnected", this.onMainConnected as any);
ipcRenderer.on("powerMonitorStatusChanged", this.onPowerMonitorChanges as any);
ipcRenderer.on("trayClick", this.onTrayClick as any);
ipcRenderer.on("blur", this.onBlurApp as any);
ipcRenderer.on("focus", this.onFocusApp as any);

*/
