import type { AppSettings, ChatMsg, PlaceIntel, SoulProfile, StreamChunk } from "./types";
import { defaultProfile, defaultSettings } from "./types";

const KEY = "wdib";

export function loadProfile(): SoulProfile {
  try {
    const raw = localStorage.getItem(`${KEY}:profile`);
    return raw ? { ...defaultProfile(), ...JSON.parse(raw) } : defaultProfile();
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(p: SoulProfile) {
  localStorage.setItem(`${KEY}:profile`, JSON.stringify(p));
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(`${KEY}:settings`);
    return raw ? { ...defaultSettings(), ...JSON.parse(raw) } : defaultSettings();
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(s: AppSettings) {
  localStorage.setItem(`${KEY}:settings`, JSON.stringify(s));
}

export function loadChat(): ChatMsg[] {
  try {
    const raw = localStorage.getItem(`${KEY}:chat`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveChat(msgs: ChatMsg[]) {
  localStorage.setItem(`${KEY}:chat`, JSON.stringify(msgs.slice(-80)));
}

export async function invokeSafe<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

export function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function chatStream(
  settings: AppSettings,
  system: string,
  messages: ChatMsg[],
  onChunk: (chunk: StreamChunk) => void,
): Promise<void> {
  const key =
    settings.provider === "ollama"
      ? settings.ollamaKey
      : settings.provider === "openai"
        ? settings.openaiKey
        : settings.provider === "anthropic"
          ? settings.anthropicKey
          : settings.openrouterKey;

  if (!inTauri()) {
    throw new Error("Open this app through Tauri so the compass can reach the models.");
  }

  const { Channel } = await import("@tauri-apps/api/core");
  const channel = new Channel<StreamChunk>();
  channel.onmessage = onChunk;
  await invokeSafe("chat", {
    request: {
      provider: settings.provider,
      model: settings.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      apiKey: key,
      system,
    },
    onChunk: channel,
  });
}

export async function fetchPlaceIntel(lat: number, lon: number): Promise<PlaceIntel> {
  if (inTauri()) {
    return invokeSafe<PlaceIntel>("place_intel", { lat, lon });
  }
  return { photos: [] };
}
