import type { AppSettings } from "../lib/types";
import { MODELS, PROVIDER_LABEL } from "../lib/models";

interface Props {
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
  onClose: () => void;
}

export default function SettingsPanel({ settings, onChange, onClose }: Props) {
  const set = (patch: Partial<AppSettings>) => onChange({ ...settings, ...patch });
  const models = MODELS[settings.provider];

  return (
    <div className="veil" onClick={onClose}>
      <div className="letter settings" onClick={(e) => e.stopPropagation()}>
        <p className="eyebrow">Keys & globe</p>
        <h1>The models and the Earth</h1>
        <p className="lede">
          Keys stay on this machine. The compass still speaks without them — add a model when you
          want a deeper reading.
        </p>

        <label>
          Provider
          <select
            value={settings.provider}
            onChange={(e) => {
              const provider = e.target.value as AppSettings["provider"];
              set({ provider, model: MODELS[provider][0].id });
            }}
          >
            {Object.keys(PROVIDER_LABEL).map((k) => (
              <option key={k} value={k}>
                {PROVIDER_LABEL[k]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Model
          <select value={settings.model} onChange={(e) => set({ model: e.target.value })}>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        {settings.provider === "ollama" ? (
          <label>
            Ollama Cloud API key
            <input
              type="password"
              value={settings.ollamaKey}
              onChange={(e) => set({ ollamaKey: e.target.value })}
              placeholder="From ollama.com/settings/keys"
            />
          </label>
        ) : null}
        {settings.provider === "openai" ? (
          <label>
            OpenAI API key
            <input
              type="password"
              value={settings.openaiKey}
              onChange={(e) => set({ openaiKey: e.target.value })}
              placeholder="sk-…"
            />
          </label>
        ) : null}
        {settings.provider === "anthropic" ? (
          <label>
            Anthropic API key
            <input
              type="password"
              value={settings.anthropicKey}
              onChange={(e) => set({ anthropicKey: e.target.value })}
              placeholder="sk-ant-…"
            />
          </label>
        ) : null}
        {settings.provider === "openrouter" ? (
          <label>
            OpenRouter API key
            <input
              type="password"
              value={settings.openrouterKey}
              onChange={(e) => set({ openrouterKey: e.target.value })}
              placeholder="sk-or-…"
            />
          </label>
        ) : null}

        <label>
          Globe
          <select
            value={settings.globeMode}
            onChange={(e) => set({ globeMode: e.target.value as AppSettings["globeMode"] })}
          >
            <option value="satellite">Photoreal satellite (works now)</option>
            <option value="ion">Cesium World Terrain + OSM buildings</option>
            <option value="photoreal">Google Photorealistic 3D Cities</option>
          </select>
        </label>
        {settings.globeMode !== "satellite" ? (
          <label>
            Cesium ion token
            <input
              type="password"
              value={settings.cesiumIonToken}
              onChange={(e) => set({ cesiumIonToken: e.target.value })}
              placeholder="ion.cesium.com — enables terrain, buildings, 3D cities"
            />
          </label>
        ) : null}

        <footer className="letter-actions">
          <span className="muted">
            Version {__APP_VERSION__} · © 2026 Aaron Grace · All rights reserved
            <br />
            Esri World Imagery · OpenStreetMap · Wikimedia
          </span>
          <button type="button" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
