#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use raw_window_handle::HasRawWindowHandle;
use std::sync::Mutex;
use tauri::{CustomMenuItem, Icon, Manager, SystemTray, SystemTrayMenu, Window, WindowEvent};
use windows::Win32::{
    Foundation::HWND,
    UI::WindowsAndMessaging::{AnimateWindow, AW_BLEND, AW_HIDE},
};
use winvd::get_current_desktop;

#[derive(Clone, serde::Serialize)]
struct Payload {
    message: String,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
struct WebDesktop {
    index: u32,
    name: String,
}

// From Desktop
impl From<winvd::Desktop> for WebDesktop {
    fn from(d: winvd::Desktop) -> Self {
        let index = d.get_index().unwrap_or(0);
        let name = d.get_name().unwrap_or("".to_string());
        WebDesktop { index, name }
    }
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
struct MainConnected {
    desktop: WebDesktop,
    person_detector_connected: bool,
    person_is_visible: bool,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
struct DesktopNameChanged {
    name: String,
}

// #[derive(Clone, serde::Serialize)]
// enum WebDesktopEvent {
//     DesktopChanged(WebDesktop),
// }

fn emit_desktop_event_thread(window: &Window) {
    use winvd::{listen_desktop_events, DesktopEvent};

    let window = window.clone();
    std::thread::spawn(move || {
        let (sender, receiver) = std::sync::mpsc::channel::<DesktopEvent>();
        let event_thread = Mutex::new(listen_desktop_events(sender).unwrap());
        window.on_window_event(move |f| match f {
            WindowEvent::Destroyed { .. } => {
                println!("Destroyed");
                event_thread.lock().unwrap().stop().unwrap();
            }
            _ => {}
        });
        for m in &receiver {
            match m {
                DesktopEvent::DesktopChanged { new, old: _ } => {
                    window
                        .emit("virtual_desktop_changed", WebDesktop::from(new))
                        .unwrap();
                }
                _ => {}
            }
        }
    });
}

fn pin_to_all_desktops(window: &Window) {
    match raw_window_handle::HasRawWindowHandle::raw_window_handle(window) {
        #[cfg(target_os = "windows")]
        raw_window_handle::RawWindowHandle::Win32(handle) => {
            let hwnd = handle.hwnd;
            winvd::pin_window(HWND(hwnd as isize)).unwrap();
        }
        _ => (),
    }
}

fn setup_native_shadows(window: &impl raw_window_handle::HasRawWindowHandle) {
    use windows::Win32::{Graphics::Dwm::DwmExtendFrameIntoClientArea, UI::Controls::MARGINS};

    match window.raw_window_handle() {
        #[cfg(target_os = "windows")]
        raw_window_handle::RawWindowHandle::Win32(handle) => {
            // Enable shadows
            let m = 1;
            let margins = MARGINS {
                cxLeftWidth: m,
                cxRightWidth: m,
                cyTopHeight: m,
                cyBottomHeight: m,
            };
            unsafe {
                let _ = DwmExtendFrameIntoClientArea(HWND(handle.hwnd as _), &margins);
            };
        }
        _ => (),
    }
}

#[tauri::command]
fn monitoring_show_window(window: Window) {
    match window.raw_window_handle() {
        #[cfg(target_os = "windows")]
        raw_window_handle::RawWindowHandle::Win32(handle) => {
            // Show window, but don't activate it
            // println!("SHOW WINDOW");
            // let _ = ShowWindow(HWND(handle.hwnd as _), SW_SHOWNOACTIVATE);

            // Hide window with fade out
            unsafe {
                let _ = AnimateWindow(HWND(handle.hwnd as _), 200, AW_BLEND);
            }
        }
        _ => {
            let _ = window.show();
        }
    }
}

#[tauri::command]
fn monitoring_hide_window(window: Window) {
    match window.raw_window_handle() {
        #[cfg(target_os = "windows")]
        raw_window_handle::RawWindowHandle::Win32(handle) => {
            // Hide window normal way
            // let _ = ShowWindow(HWND(handle.hwnd as _), SW_HIDE);

            // Hide window with fade out
            unsafe {
                let _ = AnimateWindow(HWND(handle.hwnd as _), 200, AW_BLEND | AW_HIDE);
            }
        }
        _ => {
            let _ = window.hide();
        }
    }
}

#[tauri::command]
fn monitoring_running_changed(app: tauri::AppHandle, running: bool) {
    let icon = if running {
        ICON_RUNNING.with(|i| i.clone())
    } else {
        ICON_STOPPED.with(|i| i.clone())
    };
    let _ = app.tray_handle().set_icon(icon);
}

#[tauri::command]
fn monitoring_connected() -> MainConnected {
    MainConnected {
        desktop: WebDesktop::from(get_current_desktop().unwrap()),
        person_detector_connected: false,
        person_is_visible: false,
    }
}

#[tauri::command]
fn monitoring_change_desktop_name(name: String) {
    let _ = get_current_desktop().map(|d| d.set_name(&name));
}

fn emit_focus_and_blur_events(window: &Window) {
    let win2 = window.clone();
    window.on_window_event(move |f| match f {
        WindowEvent::Focused(true) => {
            let _ = win2.emit("focus", ());
        }
        WindowEvent::Focused(false) => {
            let _ = win2.emit("blur", ());
        }
        _ => {}
    });
}

fn emit_monitoring_person_detected(window: &Window) {
    let _ = window.emit("monitoring_person_detected", true);
}

fn emit_monitoring_person_detector_connection(window: &Window) {
    let _ = window.emit("monitoring_person_detector_connection", false);
}

// fn listen_desktop_events(window: &Window) {
//     window.listen("desktopNameChanged", |ev| {
//         if let Some(str) = ev.payload() {
//             if let Ok(desktop) = serde_json::from_str::<DesktopNameChanged>(str) {
//                 println!("Change desktop name {}", &desktop.name);
//                 let _ = get_current_desktop().map(|d| d.set_name(&desktop.name));
//             }
//         }
//     });
// }

thread_local! {
    static ICON_RUNNING: Icon = Icon::Raw(include_bytes!("../icons/icon-running.ico").to_vec());
    static ICON_STOPPED: Icon = Icon::Raw(include_bytes!("../icons/icon-stopped.ico").to_vec());
}

fn main() {
    let tray_menu = SystemTrayMenu::new().add_item(CustomMenuItem::new("quit", "Quit"));

    let system_tray = SystemTray::new().with_menu(tray_menu);
    tauri::Builder::default()
        .setup(move |app| {
            let window = app.get_window("main").unwrap();
            window.open_devtools();
            pin_to_all_desktops(&window);
            emit_desktop_event_thread(&window);
            setup_native_shadows(&window);
            emit_focus_and_blur_events(&window);
            // listen_desktop_events(&window);

            Ok(())
        })
        .plugin(tauri_plugin_sql::Builder::default().build())
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            tauri::SystemTrayEvent::MenuItemClick { id, .. } => {
                if id == "quit" {
                    let window = app.get_window("main").unwrap();
                    window.close().unwrap();
                }
            }
            tauri::SystemTrayEvent::LeftClick { .. } => {
                let window = app.get_window("main").unwrap();
                window.emit("tray_left_click", ()).unwrap();
            }
            // tauri::SystemTrayEvent::RightClick {
            //     tray_id,
            //     position,
            //     size,
            //     ..
            // } => (),
            // tauri::SystemTrayEvent::DoubleClick {
            //     tray_id,
            //     position,
            //     size,
            //     ..
            // } => (),
            _ => {}
        })
        // .manage(Mutex::new(event_thread))
        // .invoke_handler(tauri::generate_handler![desktop_event_process])
        .invoke_handler(tauri::generate_handler![
            monitoring_show_window,
            monitoring_hide_window,
            monitoring_running_changed,
            monitoring_connected,
            monitoring_change_desktop_name
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
    println!("Exit?");
}
