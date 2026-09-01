import { inTauri, invokeSafe } from "./store";

export interface PlatformInfo {
  os: string;
  steamDeck: boolean;
  gamescope: boolean;
  handheld: boolean;
}

function guessOs(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "macos";
  if (ua.includes("win")) return "windows";
  if (ua.includes("linux")) return "linux";
  return "unknown";
}

export function isConservativeGpu(info: PlatformInfo): boolean {
  return info.os === "linux" || info.steamDeck || info.gamescope || info.handheld;
}

export function handheldViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 1360px), (max-height: 860px)").matches;
}

export async function loadPlatform(): Promise<PlatformInfo> {
  if (inTauri()) {
    try {
      const info = await invokeSafe<PlatformInfo>("platform_info", {});
      return {
        ...info,
        handheld: info.handheld || handheldViewport(),
      };
    } catch {
      /* browser / missing command */
    }
  }
  return {
    os: guessOs(),
    steamDeck: false,
    gamescope: false,
    handheld: handheldViewport(),
  };
}
