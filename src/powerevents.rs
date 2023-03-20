use std::sync::mpsc::Sender;

use windows::{
    core::Result,
    s,
    Win32::{
        Foundation::{HANDLE, HWND, LPARAM, LRESULT, WPARAM},
        System::{
            LibraryLoader::GetModuleHandleA,
            Power::{
                RegisterPowerSettingNotification, UnregisterPowerSettingNotification,
                POWERBROADCAST_SETTING,
            },
            SystemServices::{GUID_CONSOLE_DISPLAY_STATE, GUID_POWERSCHEME_PERSONALITY},
        },
        UI::WindowsAndMessaging::{
            CreateWindowExA, DefWindowProcA, DispatchMessageA, GetMessageA, LoadCursorW,
            PostMessageA, PostQuitMessage, RegisterClassA, CREATESTRUCTA, CS_HREDRAW, CS_VREDRAW,
            CW_USEDEFAULT, IDC_ARROW, MSG, PBT_APMBATTERYLOW, PBT_APMOEMEVENT,
            PBT_APMPOWERSTATUSCHANGE, PBT_APMQUERYSUSPEND, PBT_APMQUERYSUSPENDFAILED,
            PBT_APMRESUMEAUTOMATIC, PBT_APMRESUMECRITICAL, PBT_APMRESUMESUSPEND, PBT_APMSUSPEND,
            PBT_POWERSETTINGCHANGE, WINDOW_EX_STYLE, WM_CLOSE, WM_CREATE, WM_DESTROY,
            WM_POWERBROADCAST, WNDCLASSA, WS_OVERLAPPEDWINDOW,
        },
    },
};

#[derive(Debug)]
pub enum PowerEvent {
    ComputerWillSleep,
    ComputerResumed,
    MonitorsTurnedOff,
    MonitorsTurnedOn,
}

/// Create power events listener window, return type is function that will post
/// quit message to window stopping the thread.
pub fn create_power_events_listener(powerevents_sender: Sender<PowerEvent>) -> Box<impl FnOnce()> {
    let (hwnd_sender, hwnd_receiver) = std::sync::mpsc::channel::<HWND>();
    let thread = std::thread::spawn(|| unsafe {
        run_new_window(hwnd_sender, powerevents_sender).unwrap();
    });
    let hwnd = hwnd_receiver.recv().unwrap();
    return Box::new(move || {
        // Post quit message to hwnd
        unsafe { PostMessageA(hwnd, WM_CLOSE, WPARAM(0), LPARAM(0)) };
        thread.join().unwrap();
    });
}

unsafe fn run_new_window(
    hwnd_sender: Sender<HWND>,
    powerevents_sender: Sender<PowerEvent>,
) -> Result<()> {
    let powerevents_sender_boxed = Box::new(powerevents_sender);

    let instance = GetModuleHandleA(None)?;
    debug_assert!(instance.0 != 0);
    let window_class = s!("pwrevents");

    let wc = WNDCLASSA {
        hCursor: LoadCursorW(None, IDC_ARROW)?,
        hInstance: instance,
        lpszClassName: window_class,
        style: CS_HREDRAW | CS_VREDRAW,
        lpfnWndProc: Some(wndproc),
        ..Default::default()
    };

    let atom = RegisterClassA(&wc);
    debug_assert!(atom != 0);

    let hwnd = CreateWindowExA(
        WINDOW_EX_STYLE::default(),
        window_class,
        s!("Power events listener window"),
        WS_OVERLAPPEDWINDOW, // | WS_VISIBLE,
        CW_USEDEFAULT,
        CW_USEDEFAULT,
        CW_USEDEFAULT,
        CW_USEDEFAULT,
        None,
        None,
        instance,
        Some(Box::into_raw(powerevents_sender_boxed) as *mut _),
    );
    debug_assert!(hwnd.0 != 0);

    hwnd_sender.send(hwnd).unwrap();
    drop(hwnd_sender);

    // Listen for power scheme changes e.g. suspend and resume
    let reg1 =
        RegisterPowerSettingNotification(HANDLE(hwnd.0), &GUID_POWERSCHEME_PERSONALITY, 0).unwrap();

    // Listen for monitor sleeping
    let reg2 =
        RegisterPowerSettingNotification(HANDLE(hwnd.0), &GUID_CONSOLE_DISPLAY_STATE, 0).unwrap();

    let mut message = MSG::default();
    while GetMessageA(&mut message, None, 0, 0).into() {
        DispatchMessageA(&message);
    }

    UnregisterPowerSettingNotification(reg1);
    UnregisterPowerSettingNotification(reg2);

    Ok(())
}

extern "system" fn wndproc(window: HWND, message: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    // This assumes there is only one instance of this wndproc, which suffices for my use case.
    static mut SENDER_PTR: Option<Box<Sender<PowerEvent>>> = None;
    unsafe {
        match message {
            WM_CREATE => {
                let create_struct = &*(lparam.0 as *const CREATESTRUCTA);
                let sender_pointer = create_struct.lpCreateParams;
                SENDER_PTR = Some(Box::from_raw(sender_pointer as *mut Sender<PowerEvent>));
                LRESULT(0)
            }
            WM_DESTROY => {
                SENDER_PTR.take();
                PostQuitMessage(0);
                LRESULT(0)
            }
            WM_POWERBROADCAST => {
                match wparam.0 as u32 {
                    PBT_APMBATTERYLOW => {
                        // https://learn.microsoft.com/en-us/windows/win32/power/pbt-apmbatterylow
                    }
                    PBT_APMOEMEVENT => {
                        // https://learn.microsoft.com/en-us/windows/win32/power/pbt-apmoemevent
                    }
                    PBT_APMPOWERSTATUSCHANGE => {
                        // https://learn.microsoft.com/en-us/windows/win32/power/pbt-apmpowerstatuschange
                        // "An application should process this event by calling the
                        // GetSystemPowerStatus function to retrieve the current
                        // power status of the computer."
                    }
                    PBT_APMQUERYSUSPEND => {
                        // https://learn.microsoft.com/en-us/windows/win32/power/pbt-apmquerysuspend
                    }
                    PBT_APMQUERYSUSPENDFAILED => {
                        // https://learn.microsoft.com/en-us/windows/win32/power/pbt-apmquerysuspendfailed
                    }
                    PBT_APMRESUMEAUTOMATIC => {
                        // https://learn.microsoft.com/en-us/windows/win32/power/pbt-apmresumeautomatic
                    }
                    PBT_APMRESUMECRITICAL => {
                        // https://learn.microsoft.com/en-us/windows/win32/power/pbt-apmresumecritical
                    }
                    PBT_APMRESUMESUSPEND => {
                        // https://learn.microsoft.com/en-us/windows/win32/power/pbt-apmresumesuspend
                        if let Some(sender) = &SENDER_PTR {
                            sender.send(PowerEvent::ComputerResumed).unwrap();
                        }
                    }
                    PBT_APMSUSPEND => {
                        // https://learn.microsoft.com/en-us/windows/win32/power/pbt-apmsuspend
                        if let Some(sender) = &SENDER_PTR {
                            sender.send(PowerEvent::ComputerWillSleep).unwrap();
                        }
                    }
                    PBT_POWERSETTINGCHANGE => {
                        // https://learn.microsoft.com/en-us/windows/win32/power/pbt-powersettingchange
                        // https://learn.microsoft.com/en-us/windows/win32/power/power-setting-guids
                        let setting = &*(lparam.0 as *const POWERBROADCAST_SETTING);
                        if setting.PowerSetting == GUID_CONSOLE_DISPLAY_STATE {
                            let state = setting.Data[0];

                            match state {
                                0 => {
                                    if let Some(sender) = &SENDER_PTR {
                                        sender.send(PowerEvent::MonitorsTurnedOff).unwrap();
                                    }
                                }
                                1 => {
                                    if let Some(sender) = &SENDER_PTR {
                                        sender.send(PowerEvent::MonitorsTurnedOn).unwrap();
                                    }
                                }
                                _ => {}
                            }
                        }
                    }

                    _ => {}
                }
                LRESULT(1)
            }
            _ => DefWindowProcA(window, message, wparam, lparam),
        }
    }
}

#[cfg(feature = "integration-tests")]
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn power_events_integration_test() {
        let (sender, receiver) = std::sync::mpsc::channel::<PowerEvent>();
        let stop_listening = create_power_events_listener(sender);

        std::thread::spawn(|| {
            for event in receiver {
                println!("Event: {:?}", event);
            }
        });

        // Wait for keypress
        let mut input = String::new();
        println!("⛔ Press ENTER to exit...");
        std::io::stdin().read_line(&mut input).unwrap();
        stop_listening();
    }
}
