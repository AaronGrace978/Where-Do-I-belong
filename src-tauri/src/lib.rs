mod ai;
mod geo;

use ai::{chat_stream, ChatRequest, StreamChunk};
use tauri::ipc::Channel;

#[tauri::command]
async fn chat(request: ChatRequest, on_chunk: Channel<StreamChunk>) -> Result<(), String> {
    chat_stream(request, on_chunk).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            chat,
            geo::reverse_geocode,
            geo::search_places,
            geo::place_intel,
            geo::search_jobs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
