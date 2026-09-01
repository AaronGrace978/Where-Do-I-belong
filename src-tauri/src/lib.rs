mod ai;
mod geo;
mod linux;

use ai::{chat_stream, ChatRequest, StreamChunk};
use tauri::ipc::Channel;

#[tauri::command]
async fn chat(request: ChatRequest, on_chunk: Channel<StreamChunk>) -> Result<(), String> {
    chat_stream(request, on_chunk).await
}

#[tauri::command]
fn platform_info() -> linux::PlatformInfo {
    linux::platform_info()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    linux::apply_graphics_workarounds();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            chat,
            platform_info,
            geo::reverse_geocode,
            geo::search_places,
            geo::place_intel,
            geo::search_jobs
        ])
        .setup(|app| {
            linux::configure_main_window(app);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
