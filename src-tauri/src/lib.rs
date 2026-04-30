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

  // Setup tray
  setup_tray(app)?;

  // Start file watcher
  crate::watcher::start_watcher(app.handle().clone());

  Ok(())
}

fn setup_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
  use tauri::menu::Menu;
  use tauri::tray::TrayIconBuilder;
  use tauri::image::Image;

  println!("[SETUP] Creating tray icon...");

  // Create menu - build items directly with builder pattern
  let menu = Menu::with_items(
    app,
    &[
      &tauri::menu::MenuItemBuilder::with_id("toggle", "Toggle Window").build(app)?,
    ],
  )?;

  println!("[SETUP] Menu created successfully");

  // Try to load tray icon from app resources
  let tray_builder = {
    let app_handle = app.handle();
    
    // Try multiple icon locations
    let icon_paths = vec![
      // Release mode (bundled)
      app_handle.path().resource_dir().ok().map(|p| p.join("icons/tray_icon.png")),
      // Dev mode (source directory)
      std::path::PathBuf::from("src-tauri/icons/tray_icon.png").canonicalize().ok(),
      std::path::PathBuf::from("icons/tray_icon.png").canonicalize().ok(),
    ];
    
    let icon_path = icon_paths.into_iter().find_map(|p| {
      p.as_ref().and_then(|path| {
        if path.exists() {
          println!("[SETUP] Icon found at: {:?}", path);
          Some(path.clone())
        } else {
          None
        }
      })
    });
    
    if let Some(path) = icon_path {
      if let Ok(icon) = Image::from_path(&path) {
        println!("[SETUP] Icon loaded successfully");
        TrayIconBuilder::new()
          .icon(icon)
          .menu(&menu)
      } else {
        println!("[SETUP] Failed to load icon image, creating tray without icon");
        TrayIconBuilder::new()
          .menu(&menu)
      }
    } else {
      println!("[SETUP] Icon file not found at any location, creating tray without icon");
      TrayIconBuilder::new()
        .menu(&menu)
    }
  };

  let _tray = tray_builder
    .on_menu_event({
      let handle = app.handle().clone();
      move |_tray_id, event| {
        println!("[TRAY] Menu event: {:?}", event.id);
        if let Some(w) = handle.get_webview_window("main") {
          match event.id.as_ref() {
            "toggle" => {
              let visible = w.is_visible().unwrap_or(false);
              println!("[TRAY] Toggle pressed, window visible: {}", visible);
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

  println!("[SETUP] Tray icon created successfully!");

  Ok(())
}
