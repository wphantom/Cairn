fn main() {
  tauri_build::build();
  
  // Register the cairn:// protocol scheme for macOS
  #[cfg(target_os = "macos")]
  {
    println!("cargo:rustc-env=TAURI_PROTOCOL_CAIRN=1");
  }
}
