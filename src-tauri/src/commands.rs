use std::fs;
use std::path::PathBuf;

#[tauri::command]
pub fn get_default_path() -> Result<String, String> {
  let mut path = dirs::home_dir().ok_or("Could not find home directory")?;
  path.push("todo.txt");
  Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
  let path = PathBuf::from(&path);
  if path.exists() {
    fs::read_to_string(&path).map_err(|e| e.to_string())
  } else {
    fs::write(&path, "").map_err(|e| e.to_string())?;
    Ok(String::new())
  }
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
  let path = PathBuf::from(&path);
  let tmp_path = format!("{}.tmp", path.display());
  
  fs::write(&tmp_path, &content).map_err(|e| e.to_string())?;
  fs::rename(&tmp_path, &path).map_err(|e| e.to_string())?;
  
  // Update last_self_write timestamp in watcher
  super::watcher::mark_self_write();
  
  Ok(())
}

#[tauri::command]
pub fn archive_done(source: String, archive: String) -> Result<usize, String> {
  let source_path = PathBuf::from(&source);
  let archive_path = PathBuf::from(&archive);
  
  let content = fs::read_to_string(&source_path).map_err(|e| e.to_string())?;
  let lines: Vec<&str> = content.lines().collect();
  
  let mut archived = Vec::new();
  let mut remaining = Vec::new();
  let mut count = 0;
  
  for line in lines {
    if line.starts_with("x ") {
      archived.push(line);
      count += 1;
    } else {
      remaining.push(line);
    }
  }
  
  let new_content = remaining.join("\n");
  if !new_content.is_empty() {
    fs::write(&source_path, format!("{}\n", new_content)).map_err(|e| e.to_string())?;
  } else {
    fs::write(&source_path, "").map_err(|e| e.to_string())?;
  }
  
  if !archived.is_empty() {
    let archive_str = archived.join("\n");
    let mut archive_content = if archive_path.exists() {
      fs::read_to_string(&archive_path).map_err(|e| e.to_string())?
    } else {
      String::new()
    };
    
    if !archive_content.is_empty() && !archive_content.ends_with('\n') {
      archive_content.push('\n');
    }
    archive_content.push_str(&archive_str);
    if !archive_content.ends_with('\n') {
      archive_content.push('\n');
    }
    
    fs::write(&archive_path, archive_content).map_err(|e| e.to_string())?;
  }
  
  super::watcher::mark_self_write();
  Ok(count)
}

#[tauri::command]
pub fn open_in_finder(path: String) -> Result<(), String> {
  std::process::Command::new("open")
    .args(&["-R", &path])
    .output()
    .map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
pub fn hide_window(window: tauri::Window) -> Result<(), String> {
  window.hide().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn show_window(window: tauri::Window) -> Result<(), String> {
  window.show().map_err(|e| e.to_string())?;
  window.set_focus().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_window(window: tauri::Window) -> Result<(), String> {
  let visible = window.is_visible().map_err(|e| e.to_string())?;
  if visible {
    window.hide().map_err(|e| e.to_string())
  } else {
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
  }
}

#[tauri::command]
pub fn quit_app(app: tauri::AppHandle) -> Result<(), String> {
  app.exit(0);
  Ok(())
}

#[tauri::command]
pub fn load_config() -> Result<serde_json::Value, String> {
  let home = dirs::home_dir().ok_or("Could not find home directory")?;
  
  let config_paths = vec![
    home.join(".cairn.conf"),
    home.join(".config/cairn.conf"),
    home.join(".config/cairn/cairn.conf"),
  ];
  
  let mut config_file: Option<String> = None;
  for path in config_paths {
    if path.exists() {
      config_file = Some(fs::read_to_string(&path).map_err(|e| e.to_string())?);
      break;
    }
  }
  
  let mut todofile: Option<String> = None;
  let mut commands: Vec<String> = Vec::new();
  
  if let Some(content) = config_file {
    for line in content.lines() {
      let trimmed = line.trim();
      
      // Skip empty lines and comments
      if trimmed.is_empty() || trimmed.starts_with('#') {
        continue;
      }
      
      // Parse todofile setting
      if trimmed.starts_with("todofile=") {
        if let Some(value) = trimmed.strip_prefix("todofile=") {
          let value = value.trim_matches('"').to_string();
          // Expand tilde
          let expanded = if value.starts_with('~') {
            value.replacen('~', home.to_string_lossy().as_ref(), 1)
          } else {
            value
          };
          todofile = Some(expanded);
        }
      } else if trimmed.starts_with(':') {
        // Parse command
        commands.push(trimmed.to_string());
      }
    }
  }
  
  Ok(serde_json::json!({
    "todofile": todofile,
    "commands": commands
  }))
}

