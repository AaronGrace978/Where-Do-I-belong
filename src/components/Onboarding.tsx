import { useState } from "react";
import type { ArchetypeId, SoulProfile } from "../lib/types";
import { ARCHETYPES } from "../lib/types";
import { ARCHETYPE_META } from "../lib/archetypes";

interface Props {
  profile: SoulProfile;
  onDone: (p: SoulProfile) => void;
  onSkip: () => void;
}

export default function Onboarding({ profile, onDone, onSkip }: Props) {
  const [step, setStep] = useState(0);
  const [p, setP] = useState(profile);

  const next = () => setStep((s) => Math.min(3, s + 1));

  return (
    <div className="veil">
      <div className="letter">
        <p className="eyebrow">Where Do I Belong</p>
        {step === 0 ? (
          <>
            <h1>A love letter to yourself.</h1>
            <p className="lede">
              Boston is not a sentence. If the people around you are wrong, the globe will point —
              not at a prettier version of the same room, at a different climate.
            </p>
            <label>
              Who are you, really?
              <textarea
                value={p.story}
                onChange={(e) => setP({ ...p, story: e.target.value })}
                placeholder="I don't have the right people. I am tired of rooms that make me smaller. I am…"
                rows={5}
              />
            </label>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h1>Who belongs around you.</h1>
            <p className="lede">
              Drag each climate. High-game is where manipulators live. Unique is where originals
              concentrate. This is a weather map, not a verdict.
            </p>
            <div className="sliders">
              {ARCHETYPES.map((a) => (
                <label key={a} className="slider">
                  <span>
                    {ARCHETYPE_META[a].label}
                    <small>{ARCHETYPE_META[a].short}</small>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={p.traits[a] ?? 40}
                    onChange={(e) =>
                      setP({
                        ...p,
                        traits: { ...p.traits, [a]: Number(e.target.value) } as SoulProfile["traits"],
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h1>The body still has to eat.</h1>
            <p className="lede">A place that cannot pay you is a visit, not a life.</p>
            <label>
              Cost of living you can stand (1 cheap · 10 NYC)
              <input
                type="range"
                min={1}
                max={10}
                value={p.budget}
                onChange={(e) => setP({ ...p, budget: Number(e.target.value) })}
              />
              <em>{p.budget}/10</em>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={p.needsJob}
                onChange={(e) => setP({ ...p, needsJob: e.target.checked })}
              />
              I need the local job market to work
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={p.remoteOk}
                onChange={(e) => setP({ ...p, remoteOk: e.target.checked })}
              />
              I can bring remote income
            </label>
            <label>
              Climate
              <select
                value={p.climatePref}
                onChange={(e) => setP({ ...p, climatePref: e.target.value })}
              >
                <option value="any">Any weather</option>
                <option value="warm">Warm / light</option>
                <option value="cold">Cold / north</option>
                <option value="mild">Mild / coastal</option>
              </select>
            </label>
            <label>
              Papers
              <select value={p.visa} onChange={(e) => setP({ ...p, visa: e.target.value })}>
                <option value="flexible">Flexible / will figure it out</option>
                <option value="us">Need to stay close to US systems</option>
                <option value="eu">EU / easy Schengen</option>
                <option value="citizen">I can live where I am a citizen</option>
              </select>
            </label>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h1>What you are walking away from.</h1>
            <label>
              The room you need to leave
              <textarea
                value={p.leaving}
                onChange={(e) => setP({ ...p, leaving: e.target.value })}
                placeholder="Boston. Mean rooms. People who only love the useful version of me."
                rows={3}
              />
            </label>
            <label>
              The people you still want
              <textarea
                value={p.lookingFor}
                onChange={(e) => setP({ ...p, lookingFor: e.target.value })}
                placeholder="Kind, strange, serious about making things. Not a networking event."
                rows={3}
              />
            </label>
          </>
        ) : null}

        <footer className="letter-actions">
          <button className="ghost" type="button" onClick={onSkip}>
            Skip — just show me the Earth
          </button>
          {step < 3 ? (
            <button type="button" onClick={next}>
              Continue
            </button>
          ) : (
            <button type="button" onClick={() => onDone({ ...p, completed: true })}>
              Show me where I belong
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

export function ArchetypeStrip({
  active,
  onPick,
}: {
  active: ArchetypeId | null;
  onPick: (a: ArchetypeId | null) => void;
}) {
  return (
    <div className="strip">
      {ARCHETYPES.map((a) => (
        <button
          key={a}
          type="button"
          className={active === a ? "chip on" : "chip"}
          style={{ ["--c" as string]: ARCHETYPE_META[a].color }}
          onClick={() => onPick(active === a ? null : a)}
        >
          {ARCHETYPE_META[a].label}
        </button>
      ))}
    </div>
  );
}
