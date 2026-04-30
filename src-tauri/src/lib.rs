mod commands;
mod watcher;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default()
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .plugin(tauri_plugin_window_state::Builder::default().build())
    .setup(setup)
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
    ]);

  builder
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
  use window_vibrancy::apply_vibrancy;

  let window = app.get_webview_window("main").unwrap();
  
  // Apply vibrancy
  let _ = apply_vibrancy(
    &window,
    window_vibrancy::NSVisualEffectMaterial::HudWindow,
    None,
    None,
  );

  // Set activation policy to accessory (no dock icon)
  app.set_activation_policy(tauri::ActivationPolicy::Accessory);

  // Register global shortcut ⌥⌘T (TODO: Fix handler registration for Tauri 2)
  // let _ = app.global_shortcut().register("alt+cmd+t")?;

  // Setup tray - skip for now
  // setup_tray(app)?;

  // Start file watcher
  crate::watcher::start_watcher(app.handle().clone());

  Ok(())
}

fn setup_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
  use tauri::menu::Menu;
  use tauri::tray::TrayIconBuilder;
  use tauri::image::Image;

  let menu = Menu::new(app)?;

  // Try to load tray icon from app resources
  let tray_builder = {
    let app_handle = app.handle();
    let resource_dir = app_handle.path().resource_dir()?;
    let icon_path = resource_dir.join("icons/tray_icon.png");
    
    if icon_path.exists() {
      if let Ok(icon) = Image::from_path(&icon_path) {
        TrayIconBuilder::new()
          .icon(icon)
          .menu(&menu)
      } else {
        TrayIconBuilder::new()
          .menu(&menu)
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
