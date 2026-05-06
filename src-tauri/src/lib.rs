mod commands;
mod watcher;

use tauri::Manager;

// NSWindowCollectionBehavior flags (from AppKit)
// CanJoinAllSpaces (1) | Stationary (16) | IgnoresCycle (64)
const ALL_SPACES_BEHAVIOR: usize = 1 | 16 | 64;

// NSStatusWindowLevel (25): macOS keeps these above all apps and on ALL Spaces
const STATUS_WINDOW_LEVEL: i64 = 25;

#[cfg(target_os = "macos")]
fn apply_all_spaces_behavior(window: &tauri::WebviewWindow) {
  use objc2::runtime::AnyObject;
  use objc2::msg_send;

  if let Ok(ns_win) = window.ns_window() {
    unsafe {
      let ns_window = &*(ns_win as *const AnyObject);
      // Set truly borderless style mask (removes close/minimize/zoom from AX tree).
      // AeroSpace skips managing windows where activationPolicy==.accessory && closeBtn==nil.
      // Tauri's decorations:false may still keep .titled mask with hidden buttons — this fixes it.
      let borderless: usize = 0; // NSWindowStyleMask.borderless
      let _: () = msg_send![ns_window, setStyleMask: borderless];
      // Level 25 (NSStatusWindowLevel): treated like status-bar overlays by macOS
      let _: () = msg_send![ns_window, setLevel: STATUS_WINDOW_LEVEL];
      // Set all-spaces flags BEFORE ordering front
      let _: () = msg_send![ns_window, setCollectionBehavior: ALL_SPACES_BEHAVIOR];
      // orderFrontRegardless does NOT reassign the window to the current Space,
      // unlike makeKeyAndOrderFront: which pins the window and undoes CanJoinAllSpaces.
      let _: () = msg_send![ns_window, orderFrontRegardless];
    }
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let app = tauri::Builder::default()
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .setup(|app| {
      setup_tray(app)?;
      crate::watcher::start_watcher(app.handle().clone());

      if let Some(window) = app.get_webview_window("main") {
        // Do NOT call window.show() — makeKeyAndOrderFront: would pin to current Space
        // and undo CanJoinAllSpaces. Use orderFrontRegardless (inside apply_all_spaces_behavior)
        // which bypasses Space assignment entirely.
        #[cfg(target_os = "macos")]
        apply_all_spaces_behavior(&window);
        #[cfg(not(target_os = "macos"))]
        let _ = window.show();
      }

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      crate::commands::get_default_path,
      crate::commands::read_file,
      crate::commands::write_file,
      crate::commands::archive_done,
      crate::commands::open_in_finder,
      crate::commands::hide_window,
      crate::commands::show_window,
      crate::commands::toggle_window,
      crate::commands::quit_app,
      crate::commands::load_config,
    ])
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(|app_handle, event| {
    // Handle macOS URL scheme activation (cairn://toggle)
    #[cfg(target_os = "macos")]
    if let tauri::RunEvent::Opened { urls } = &event {
      for url in urls {
        if url.host_str() == Some("toggle") || url.path().trim_start_matches('/') == "toggle" {
          if let Some(window) = app_handle.get_webview_window("main") {
            let visible = window.is_visible().unwrap_or(false);
            if visible {
              let _ = window.hide();
            } else {
              #[cfg(target_os = "macos")]
              apply_all_spaces_behavior(&window);
              #[cfg(not(target_os = "macos"))]
              let _ = window.show();
              let _ = window.set_focus();
            }
          }
        }
      }
    }
  });
}

fn setup_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
  use tauri::menu::Menu;
  use tauri::tray::TrayIconBuilder;
  use tauri::image::Image;

  // Create menu with toggle option
  let menu = Menu::with_items(
    app,
    &[
      &tauri::menu::MenuItemBuilder::with_id("toggle", "Toggle Window").build(app)?,
    ],
  )?;

  // Try to load tray icon from app resources
  let tray_builder = {
    let app_handle = app.handle();
    
    // Try multiple icon locations (dev vs release)
    let resource_dir = app_handle.path().resource_dir().ok();
    
    let icon_paths = vec![
      resource_dir.as_ref().map(|p| p.join("icons/tray_icon.png")),
      std::path::PathBuf::from("src-tauri/icons/tray_icon.png").canonicalize().ok(),
      std::path::PathBuf::from("icons/tray_icon.png").canonicalize().ok(),
    ];
    
    let icon_path = icon_paths.into_iter().find_map(|p| {
      p.as_ref().and_then(|path| {
        if path.exists() {
          Some(path.clone())
        } else {
          None
        }
      })
    });
    
    if let Some(path) = icon_path {
      match Image::from_path(&path) {
        Ok(icon) => {
          TrayIconBuilder::new()
            .icon(icon)
            .menu(&menu)
        }
        Err(_) => {
          TrayIconBuilder::new()
            .menu(&menu)
        }
      }
    } else {
      TrayIconBuilder::new()
        .menu(&menu)
    }
  };

  let _tray = tray_builder
    .on_menu_event({
      let handle = app.handle().clone();
      move |_tray_id, event| {
        if let Some(w) = handle.get_webview_window("main") {
          match event.id.as_ref() {
            "toggle" => {
              let visible = w.is_visible().unwrap_or(false);
              if visible {
                let _ = w.hide();
              } else {
                #[cfg(target_os = "macos")]
                apply_all_spaces_behavior(&w);
                #[cfg(not(target_os = "macos"))]
                let _ = w.show();
                let _ = w.set_focus();
              }
            }
            _ => {}
          }
        }
      }
    })
    .build(app)?;

  Ok(())
}
