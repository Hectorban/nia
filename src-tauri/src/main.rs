// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Workaround for WebKitGTK + NVIDIA GBM buffer error on Linux.
// See https://v2.tauri.app/develop/debug/linux-graphics/
// and https://github.com/tauri-apps/tauri/issues/13493
#[cfg(target_os = "linux")]
fn apply_linux_graphics_workaround() {
    // Disable DMABUF renderer — fixes "Failed to create GBM buffer" and
    // "Error 71 (Protocol error)" on NVIDIA GPUs with proprietary drivers.
    // Cost: falls back to a slightly slower rendering path, but fixes stability.
    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
}

fn main() {
    #[cfg(target_os = "linux")]
    apply_linux_graphics_workaround();
    nia_lib::run()
}
