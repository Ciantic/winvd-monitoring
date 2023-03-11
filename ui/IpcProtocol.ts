declare const __TAURI__: typeof import("npm:@tauri-apps/api");

const invoke = __TAURI__.invoke;
const listen = __TAURI__.event.listen;

export class TauriProtocol {
    monitoring_change_desktop_name(name: string): Promise<void> {
        return invoke("monitoring_change_desktop_name", { name });
    }
    monitoring_hide_window(): Promise<void> {
        return invoke("monitoring_hide_window");
    }
    monitoring_show_window(): Promise<void> {
        return invoke("monitoring_show_window");
    }
    monitoring_running_changed(running: boolean): Promise<void> {
        return invoke("monitoring_running_changed", { running });
    }
    monitoring_connected(): Promise<{
        desktop: { index: number; name: string };
        personDetectorConnected: boolean;
        personIsVisible: boolean;
    }> {
        return invoke("monitoring_connected");
    }

    onVirtulaDesktopChanged(listener: (desktop: { index: number; name: string }) => void): void {
        listen("virtual_desktop_changed", (e) => {
            console.log("Got event", "virtual_desktop_changed", e.payload);
            listener(e.payload as any);
        });
    }

    onMonitoringPersonDetected(listener: (personIsVisible: boolean) => void): void {
        listen("monitoring_person_detected", (e) => {
            console.log("Got event", "monitoring_person_detected", e.payload);
            listener(e.payload as any);
        });
    }

    onMonitoringPersonDetectorConnection(
        listener: (personDetectorConnected: boolean) => void
    ): void {
        listen("monitoring_person_detector_connection", (e) => {
            listener(e.payload as any);
        });
    }

    onMonitoringPowerStatusChanged(listener: (event: "suspend" | "resume") => void): void {
        listen("monitoring_power_status_changed", (e) => {
            listener(e.payload as any);
        });
    }

    onTrayLeftClick(listener: () => void): void {
        listen("tray_left_click", () => {
            listener();
        });
    }

    onBlur(listener: () => void): void {
        listen("blur", () => {
            listener();
        });
    }

    onFocus(listener: () => void): void {
        listen("focus", (e) => {
            listener();
        });
    }
}
/*
this.ipcRenderer.on("virtual_desktop_changed", this.onChangeDesktop);
this.ipcRenderer.on("monitoring_person_detected", this.isPersonVisibleChanged);
this.ipcRenderer.on(
    "monitoring_person_detector_connection",
    this.onPersonDetectorConnectionChange
);
this.ipcRenderer.on("monitoring_power_status_changed", this.onPowerMonitorChanges);
this.ipcRenderer.on("tray_left_click", this.onTrayClick);
this.ipcRenderer.on("blur", this.onBlurApp);
this.ipcRenderer.on("focus", this.onFocusApp);

*/
