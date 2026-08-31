export const ARCHETYPES = [
  "unique",
  "manipulator",
  "highTrust",
  "hustle",
  "quiet",
  "queer",
  "intellectual",
  "traditional",
  "luxury",
  "creative",
  "tech",
  "diaspora",
] as const;

export type ArchetypeId = (typeof ARCHETYPES)[number];

export interface City {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  climate: string;
  languages: string[];
  cost: number;
  jobs: string[];
  remoteFriendly: boolean;
  scores: Record<ArchetypeId, number>;
  people: string;
  environment: string;
  liveability: string;
  wikiTitle: string;
}

export interface SoulProfile {
  story: string;
  lookingFor: string;
  leaving: string;
  traits: Partial<Record<ArchetypeId, number>>;
  budget: number;
  needsJob: boolean;
  remoteOk: boolean;
  climatePref: string;
  visa: string;
  completed: boolean;
}

export interface PinPlace {
  name: string;
  lat: number;
  lon: number;
  city?: City;
  displayName?: string;
  country?: string;
  reason?: string;
}

export interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface AppSettings {
  provider: "ollama" | "openai" | "anthropic" | "openrouter";
  model: string;
  ollamaKey: string;
  openaiKey: string;
  anthropicKey: string;
  openrouterKey: string;
  cesiumIonToken: string;
  globeMode: "satellite" | "ion" | "photoreal";
}

export interface PlacePhoto {
  url: string;
  thumb: string;
  title: string;
  source: string;
}

export interface PlaceIntel {
  geo?: {
    name: string;
    displayName: string;
    lat: number;
    lon: number;
    kind?: string;
    country?: string;
    city?: string;
  };
  wikiTitle?: string;
  wikiExtract?: string;
  wikiUrl?: string;
  photos: PlacePhoto[];
}

export interface JobPost {
  title: string;
  company: string;
  location: string;
  url: string;
  tags: string[];
  remote: boolean;
  source: string;
}

export interface StreamChunk {
  kind: string;
  text?: string;
  tool?: { name: string; arguments: Record<string, unknown> };
}

export const defaultProfile = (): SoulProfile => ({
  story: "",
  lookingFor: "",
  leaving: "",
  traits: {
    unique: 70,
    manipulator: 20,
    highTrust: 80,
    hustle: 45,
    quiet: 55,
    queer: 40,
    intellectual: 60,
    traditional: 30,
    luxury: 25,
    creative: 65,
    tech: 50,
    diaspora: 40,
  },
  budget: 5,
  needsJob: true,
  remoteOk: true,
  climatePref: "any",
  visa: "flexible",
  completed: false,
});

export const defaultSettings = (): AppSettings => ({
  provider: "ollama",
  model: "glm-5.3",
  ollamaKey: "",
  openaiKey: "",
  anthropicKey: "",
  openrouterKey: "",
  cesiumIonToken: "",
  globeMode: "satellite",
});
