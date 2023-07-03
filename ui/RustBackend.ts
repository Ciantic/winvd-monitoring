declare const __TAURI__: typeof import("npm:@tauri-apps/api");

function invoke(name: string, payload?: any): Promise<any> {
    if (typeof __TAURI__ !== "undefined") {
        return __TAURI__.invoke(name, payload);
    }
    console.log("invoke", name, payload);

    // For tests
    if (name === "monitoring_connected") {
        return Promise.resolve({
            desktop: { index: 0, name: "Acme Inc: Rocket" },
            person_detector_connected: false,
            person_is_visible: false,
        });
    }

    return Promise.resolve();
}

function listen(name: string, cb: (e: any) => void): Promise<any> {
    if (typeof __TAURI__ !== "undefined") {
        return __TAURI__.event.listen(name, (e) => {
            // console.log("got event", name, cb);
            cb(e.payload);
        });
    }
    console.log("listen", name, cb);
    return Promise.resolve();
}

export const RustBackend = {
    monitoringChangeDesktopName(name: string): Promise<void> {
        return invoke("monitoring_change_desktop_name", { name });
    },

    monitoringHideWindow(): Promise<void> {
        return invoke("monitoring_hide_window");
    },

    monitoringShowWindow(): Promise<void> {
        return invoke("monitoring_show_window");
    },

    monitoringRunningChanged(running: boolean): Promise<void> {
        return invoke("monitoring_running_changed", { running });
    },

    monitoringConnected(): Promise<{
        desktop: { index: number; name: string };
        person_detector_connected: boolean;
        person_is_visible: boolean;
    }> {
        return invoke("monitoring_connected");
    },

    closeCurrentWindow(): Promise<void> {
        if (typeof __TAURI__ === "undefined") {
            return Promise.resolve();
        }
        return __TAURI__.window.getCurrent().close();
    },

    onVirtualDesktopChanged(cb: (desktop: { index: number; name: string }) => void) {
        listen("virtual_desktop_changed", cb);
        return this;
    },

    onMonitoringPersonDetected(cb: (personIsVisible: boolean) => void) {
        listen("monitoring_person_detected", cb);
        return this;
    },

    onMonitoringPersonDetectorConnection(cb: (personDetectorConnected: boolean) => void) {
        listen("monitoring_person_detector_connection", cb);
        return this;
    },

    onComputerSuspend(cb: () => void) {
        listen("computer_will_suspend", cb);
        return this;
    },

    onComputerResumed(cb: () => void) {
        listen("computer_resumed", cb);
        return this;
    },

    onMonitorsTurnedOff(cb: () => void) {
        listen("monitors_turned_off", cb);
        return this;
    },

    onMonitorsTurnedOn(cb: () => void) {
        listen("monitors_turned_on", cb);
        return this;
    },

    onTrayMenuItemClick(cb: (id: "quit") => void) {
        listen("tray_menu_item_click", cb);
        return this;
    },

    onTrayLeftClick(cb: () => void) {
        listen("tray_left_click", cb);
        return this;
    },

    onBlur(cb: () => void) {
        listen("blur", cb);
        return this;
    },

    onFocus(cb: () => void) {
        listen("focus", cb);
        return this;
    },

    onDestroy(cb: () => void) {
        if (typeof __TAURI__ !== "undefined") {
            __TAURI__.window.getCurrent().listen(__TAURI__.event.TauriEvent.WINDOW_DESTROYED, cb);
        }
        return this;
    },

    onCloseRequested(cb: () => void) {
        if (typeof __TAURI__ !== "undefined") {
            __TAURI__.window
                .getCurrent()
                .listen(__TAURI__.event.TauriEvent.WINDOW_CLOSE_REQUESTED, cb);
        }
        return this;
    },
};
