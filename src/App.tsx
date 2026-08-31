import { useEffect, useMemo, useState } from "react";
import Globe from "./components/Globe";
import ChatPanel from "./components/ChatPanel";
import PlaceDossier from "./components/PlaceDossier";
import Onboarding, { ArchetypeStrip } from "./components/Onboarding";
import SettingsPanel from "./components/SettingsPanel";
import type { ArchetypeId, ChatMsg, PinPlace, SoulProfile, StreamChunk } from "./lib/types";
import { CITIES, cityById } from "./data/cities";
import { byArchetype, rankCities } from "./lib/engine";
import { localCompass, seedGreeting } from "./lib/localCompass";
import { buildSystemPrompt } from "./lib/systemPrompt";
import {
  chatStream,
  inTauri,
  invokeSafe,
  loadChat,
  loadProfile,
  loadSettings,
  saveChat,
  saveProfile,
  saveSettings,
} from "./lib/store";
import { PROVIDER_LABEL } from "./lib/models";

export default function App() {
  const [profile, setProfile] = useState<SoulProfile>(() => loadProfile());
  const [settings, setSettings] = useState(() => loadSettings());
  const [showLetter, setShowLetter] = useState(() => !loadProfile().completed);
  const [showSettings, setShowSettings] = useState(false);
  const [pin, setPin] = useState<PinPlace | null>(null);
  const [pins, setPins] = useState<PinPlace[]>([]);
  const [archetype, setArchetype] = useState<ArchetypeId | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    const saved = loadChat();
    return saved.length ? saved : [seedGreeting(loadProfile())];
  });
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => saveProfile(profile), [profile]);
  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => saveChat(messages), [messages]);

  const hasKey =
    (settings.provider === "ollama" && settings.ollamaKey) ||
    (settings.provider === "openai" && settings.openaiKey) ||
    (settings.provider === "anthropic" && settings.anthropicKey) ||
    (settings.provider === "openrouter" && settings.openrouterKey);

  function applyTools(tools: Array<{ name: string; arguments: Record<string, unknown> }>) {
    for (const t of tools) {
      const args = t.arguments ?? {};
      if (t.name === "fly_to_place") {
        const lat = Number(args.lat);
        const lon = Number(args.lon);
        const name = String(args.name ?? "Here");
        const city = CITIES.find(
          (c) =>
            c.name.toLowerCase() === name.toLowerCase() ||
            (Math.abs(c.lat - lat) < 0.4 && Math.abs(c.lon - lon) < 0.4),
        );
        const next: PinPlace = {
          name: city?.name ?? name,
          lat: city?.lat ?? lat,
          lon: city?.lon ?? lon,
          city,
          country: city?.country,
          reason: args.reason ? String(args.reason) : undefined,
        };
        setPin(next);
        setPins((prev) => {
          const rest = prev.filter((p) => p.name !== next.name);
          return [...rest, next];
        });
      }
      if (t.name === "highlight_archetype") {
        const a = String(args.archetype) as ArchetypeId;
        setArchetype(a);
        setPins(
          byArchetype(a, 16).map((c) => ({
            name: c.name,
            lat: c.lat,
            lon: c.lon,
            city: c,
            country: c.country,
          })),
        );
      }
      if (t.name === "recommend_matches") {
        const ids = (args.cityIds as string[]) || [];
        const list = ids.map(cityById).filter(Boolean).map((c) => ({
          name: c!.name,
          lat: c!.lat,
          lon: c!.lon,
          city: c!,
          country: c!.country,
        }));
        if (list.length) {
          setPins(list);
          setArchetype(null);
        }
      }
    }
  }

  async function send(text: string) {
    const user: ChatMsg = { id: crypto.randomUUID(), role: "user", content: text };
    const history = [...messages, user];
    setMessages(history);
    setBusy(true);
    setError(null);
    setStreaming("");

    const runLocal = () => {
      const local = localCompass(text, profile, pin);
      applyTools(local.tools);
      setMessages([
        ...history,
        { id: crypto.randomUUID(), role: "assistant", content: local.text },
      ]);
    };

    if (!hasKey) {
      runLocal();
      setBusy(false);
      return;
    }

    try {
      let acc = "";
      const tools: Array<{ name: string; arguments: Record<string, unknown> }> = [];
      await chatStream(settings, buildSystemPrompt(profile, pin), history, (chunk: StreamChunk) => {
        if (chunk.kind === "token" && chunk.text) {
          acc += chunk.text;
          setStreaming(acc);
        }
        if (chunk.kind === "tool" && chunk.tool) {
          tools.push(chunk.tool);
        }
      });
      applyTools(tools);
      setStreaming("");
      setMessages([
        ...history,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: acc || "(The model was silent. Try another, or use the local compass.)",
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      runLocal();
    } finally {
      setBusy(false);
      setStreaming("");
    }
  }

  function finishLetter(next: SoulProfile) {
    setProfile(next);
    setShowLetter(false);
    const ranked = rankCities(next, 6);
    setPins(
      ranked.map((c) => ({
        name: c.name,
        lat: c.lat,
        lon: c.lon,
        city: c,
        country: c.country,
      })),
    );
    if (ranked[0]) {
      setPin({
        name: ranked[0].name,
        lat: ranked[0].lat,
        lon: ranked[0].lon,
        city: ranked[0],
        country: ranked[0].country,
      });
    }
    setMessages([
      seedGreeting(next),
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: localCompass("where do I belong", next, null).text,
      },
    ]);
    applyTools(localCompass("where do I belong", next, null).tools);
  }

  async function search(q: string) {
    const hit = CITIES.find(
      (c) =>
        c.name.toLowerCase().includes(q.toLowerCase()) ||
        c.country.toLowerCase().includes(q.toLowerCase()),
    );
    if (hit) {
      setPin({ name: hit.name, lat: hit.lat, lon: hit.lon, city: hit, country: hit.country });
      return;
    }
    if (inTauri() && q.trim()) {
      try {
        const results = await invokeSafe<Array<{ name: string; lat: number; lon: number; country?: string; displayName: string }>>(
          "search_places",
          { query: q },
        );
        const r = results[0];
        if (r) {
          setPin({
            name: r.name,
            lat: r.lat,
            lon: r.lon,
            country: r.country,
            displayName: r.displayName,
          });
        }
      } catch {
        setError("Search failed. Try a city name from the atlas.");
      }
    }
  }

  const title = useMemo(() => "Where Do I Belong", []);

  return (
    <div className="app">
      <Globe
        pin={pin}
        pins={pins}
        archetype={archetype}
        ionToken={settings.cesiumIonToken}
        globeMode={settings.globeMode}
        hasDossier={Boolean(pin)}
        onPick={(place) => {
          setPin(place);
          setShowLetter(false);
        }}
      />

      <header className="topbar">
        <div className="brand">
          <span className="mark" />
          <div>
            <strong>{title}</strong>
            <em>a love letter with a globe</em>
          </div>
        </div>
        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault();
            void search(query);
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a city, a coast, a nowhere…"
          />
        </form>
        <div className="top-actions">
          <button type="button" className="ghost" onClick={() => setShowLetter(true)}>
            Letter
          </button>
          <button type="button" className="ghost" onClick={() => setShowSettings(true)}>
            Keys
          </button>
        </div>
      </header>

      <ArchetypeStrip
        active={archetype}
        onPick={(a) => {
          setArchetype(a);
          if (a) {
            setPins(
              byArchetype(a, 16).map((c) => ({
                name: c.name,
                lat: c.lat,
                lon: c.lon,
                city: c,
                country: c.country,
              })),
            );
          }
        }}
      />

      <ChatPanel
        messages={messages}
        streaming={streaming}
        busy={busy}
        error={error}
        onSend={(t) => void send(t)}
        onOpenSettings={() => setShowSettings(true)}
        providerLabel={hasKey ? PROVIDER_LABEL[settings.provider] : "Local compass"}
        model={hasKey ? settings.model : "atlas"}
      />

      {pin ? <PlaceDossier pin={pin} profile={profile} onClose={() => setPin(null)} /> : null}

      <p className="credit">Esri World Imagery · OSM · Wikimedia · spin the earth until it tells the truth</p>

      {showLetter ? (
        <Onboarding
          profile={profile}
          onDone={finishLetter}
          onSkip={() => setShowLetter(false)}
        />
      ) : null}
      {showSettings ? (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          onClose={() => setShowSettings(false)}
        />
      ) : null}
    </div>
  );
}
