declare const __TAURI__: typeof import("npm:@tauri-apps/api");

const invoke = __TAURI__.invoke;
const listen = __TAURI__.event.listen;

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
        listen("virtual_desktop_changed", (e) => {
            cb(e.payload as any);
        });
    }

    onMonitoringPersonDetected(cb: (personIsVisible: boolean) => void): void {
        listen("monitoring_person_detected", (e) => {
            cb(e.payload as any);
        });
    }

    onMonitoringPersonDetectorConnection(cb: (personDetectorConnected: boolean) => void): void {
        listen("monitoring_person_detector_connection", (e) => {
            cb(e.payload as any);
        });
    }

    onMonitoringPowerStatusChanged(cb: (event: "suspend" | "resume") => void): void {
        listen("monitoring_power_status_changed", (e) => {
            cb(e.payload as any);
        });
    }

    onTrayLeftClick(cb: () => void): void {
        listen("tray_left_click", () => {
            cb();
        });
    }

    onBlur(cb: () => void): void {
        listen("blur", () => {
            cb();
        });
    }

    onFocus(cb: () => void): void {
        listen("focus", () => {
            cb();
        });
    }
}
