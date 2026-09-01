//! Linux / Steam Deck graphics workarounds.
//!
//! Tauri paints through WebKitGTK. On SteamOS, Gamescope, Mesa, and NVIDIA the
//! DMA-BUF renderer often leaves a blank white window that never loads.
//! See: https://v2.tauri.app/develop/debug/linux-graphics/
//!      https://github.com/tauri-apps/tauri/issues/5143 (Steam Deck)

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformInfo {
    pub os: String,
    pub steam_deck: bool,
    pub gamescope: bool,
    pub handheld: bool,
}

pub fn platform_info() -> PlatformInfo {
    let steam_deck = is_steam_deck();
    let gamescope = is_gamescope();
    PlatformInfo {
        os: std::env::consts::OS.to_string(),
        steam_deck,
        gamescope,
        handheld: steam_deck || gamescope,
    }
}

/// Must run before the webview is created.
pub fn apply_graphics_workarounds() {
    #[cfg(target_os = "linux")]
    {
        // Keeps GPU compositing, but avoids the DMA-BUF path that whites out
        // WebKitGTK on Steam Deck, Gamescope, Mesa, and NVIDIA.
        set_if_unset("WEBKIT_DISABLE_DMABUF_RENDERER", "1");

        if is_steam_deck() || is_gamescope() {
            // Nested Wayland inside Gamescope is the Steam Deck Game Mode stack.
            // Force X11 so GTK/WebKit do not attach to the nested compositor.
            set_if_unset("GDK_BACKEND", "x11");
        }
    }
}

pub fn configure_main_window<R: tauri::Runtime>(app: &tauri::App<R>) {
    #[cfg(target_os = "linux")]
    {
        use tauri::Manager;
        if !(is_steam_deck() || is_gamescope()) {
            return;
        }
        if let Some(win) = app.get_webview_window("main") {
            let _ = win.maximize();
        }
    }
    let _ = app;
}

pub fn is_steam_deck() -> bool {
    if std::env::var("SteamDeck").ok().as_deref() == Some("1") {
        return true;
    }
    for path in [
        "/sys/devices/virtual/dmi/id/board_name",
        "/sys/class/dmi/id/board_name",
        "/sys/devices/virtual/dmi/id/product_name",
        "/sys/class/dmi/id/product_name",
    ] {
        if let Ok(raw) = std::fs::read_to_string(path) {
            if board_is_steam_deck(raw.trim()) {
                return true;
            }
        }
    }
    false
}

pub fn is_gamescope() -> bool {
    std::env::var_os("GAMESCOPE_WAYLAND_DISPLAY").is_some()
        || std::env::var("XDG_CURRENT_DESKTOP")
            .unwrap_or_default()
            .to_ascii_lowercase()
            .contains("gamescope")
}

pub fn board_is_steam_deck(name: &str) -> bool {
    let n = name.trim();
    n.eq_ignore_ascii_case("Jupiter")
        || n.eq_ignore_ascii_case("Galileo")
        || n.to_ascii_lowercase().contains("steamdeck")
        || n.to_ascii_lowercase().contains("steam deck")
}

#[cfg(target_os = "linux")]
fn set_if_unset(key: &str, value: &str) {
    if std::env::var_os(key).is_none() {
        std::env::set_var(key, value);
    }
}

#[cfg(test)]
mod tests {
    use super::board_is_steam_deck;

    #[test]
    fn lcd_and_oled_board_names() {
        assert!(board_is_steam_deck("Jupiter"));
        assert!(board_is_steam_deck("jupiter"));
        assert!(board_is_steam_deck("Galileo"));
        assert!(board_is_steam_deck("Steam Deck"));
        assert!(!board_is_steam_deck("Default string"));
        assert!(!board_is_steam_deck("Framework"));
    }
}
