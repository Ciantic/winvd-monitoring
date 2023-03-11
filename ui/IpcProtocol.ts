declare const __TAURI__: typeof import("npm:@tauri-apps/api");

function invoke(name: string, payload?: any): Promise<any> {
    if (typeof __TAURI__ !== "undefined") {
        return __TAURI__.invoke(name, payload);
    }
    console.log("invoke", name, payload);

    // For tests
    if (name === "monitoring_connected") {
        return Promise.resolve({
            desktop: { index: 0, name: "Desktop 1" },
            person_detector_connected: false,
            person_is_visible: false,
        });
    }

    return Promise.resolve();
}

function listen(name: string, cb: (e: any) => void): Promise<any> {
    if (typeof __TAURI__ !== "undefined") {
        return __TAURI__.event.listen(name, (e) => {
            cb(e.payload);
        });
    }
    console.log("listen", name, cb);
    return Promise.resolve();
}

export class TauriProtocol {
    monitoringChangeDesktopName(name: string): Promise<void> {
        return invoke("monitoring_change_desktop_name", { name });
    }
    monitoringHideWindow(): Promise<void> {
        return invoke("monitoring_hide_window");
    }
    monitoringShowWindow(): Promise<void> {
        return invoke("monitoring_show_window");
    }
    monitoringRunningChanged(running: boolean): Promise<void> {
        return invoke("monitoring_running_changed", { running });
    }
    monitoringConnected(): Promise<{
        desktop: { index: number; name: string };
        person_detector_connected: boolean;
        person_is_visible: boolean;
    }> {
        return invoke("monitoring_connected");
    }

    onVirtulaDesktopChanged(cb: (desktop: { index: number; name: string }) => void): void {
        listen("virtual_desktop_changed", cb);
    }

    onMonitoringPersonDetected(cb: (personIsVisible: boolean) => void): void {
        listen("monitoring_person_detected", cb);
    }

    onMonitoringPersonDetectorConnection(cb: (personDetectorConnected: boolean) => void): void {
        listen("monitoring_person_detector_connection", cb);
    }

    onMonitoringPowerStatusChanged(cb: (event: "suspend" | "resume") => void): void {
        listen("monitoring_power_status_changed", cb);
    }

    onTrayLeftClick(cb: () => void): void {
        listen("tray_left_click", cb);
    }

    onBlur(cb: () => void): void {
        listen("blur", cb);
    }

    onFocus(cb: () => void): void {
        listen("focus", cb);
    }
}
