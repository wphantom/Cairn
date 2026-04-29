use notify::{Watcher, RecursiveMode, Result as NotifyResult};
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static LAST_SELF_WRITE: AtomicU64 = AtomicU64::new(0);

pub fn mark_self_write() {
  let now = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_millis() as u64)
    .unwrap_or(0);
  LAST_SELF_WRITE.store(now, Ordering::Relaxed);
}

pub fn start_watcher(app_handle: tauri::AppHandle) {
  std::thread::spawn(move || {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let todo_path = home.join("todo.txt");

    if let Ok(mut watcher) = create_watcher(&app_handle, todo_path.clone()) {
      let home_dir = home.clone();
      let _ = watcher.watch(&home_dir, RecursiveMode::NonRecursive);
      std::mem::forget(watcher);
    }

    loop {
      std::thread::sleep(std::time::Duration::from_secs(60));
    }
  });
}

fn create_watcher(
  app_handle: &tauri::AppHandle,
  todo_path: PathBuf,
) -> NotifyResult<impl Watcher> {
  use notify::Event;
  use tauri::{Emitter, Manager};

  let app = app_handle.clone();
  let path = todo_path.clone();
  let mut last_content = String::new();
  if path.exists() {
    if let Ok(content) = fs::read_to_string(&path) {
      last_content = content;
    }
  }

  let watcher = notify::recommended_watcher(move |res: Result<Event, _>| {
    if let Ok(event) = res {
      if event.paths.iter().any(|p| p.ends_with("todo.txt")) {
        let now = SystemTime::now()
          .duration_since(UNIX_EPOCH)
          .map(|d| d.as_millis() as u64)
          .unwrap_or(0);

        let last_write = LAST_SELF_WRITE.load(Ordering::Relaxed);
        if now - last_write < 500 {
          return;
        }

        if let Ok(content) = fs::read_to_string(&path) {
          if content != last_content {
            if let Some(w) = app.get_webview_window("main") {
              let _ = w.emit("file-changed", &content);
            }
          }
        }
      }
    }
  })?;

  Ok(watcher)
}
