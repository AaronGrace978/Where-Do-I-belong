import { useEffect, useState } from "react";
import type { JobPost, PinPlace, PlaceIntel, PlacePhoto, SoulProfile } from "../lib/types";
import { scoreCity } from "../lib/engine";
import { ARCHETYPE_META } from "../lib/archetypes";
import { ARCHETYPES } from "../lib/types";
import { fetchPlaceIntel, inTauri, invokeSafe } from "../lib/store";

interface Props {
  pin: PinPlace | null;
  profile: SoulProfile;
  onClose: () => void;
}

export default function PlaceDossier({ pin, profile, onClose }: Props) {
  const [intel, setIntel] = useState<PlaceIntel | null>(null);
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [photo, setPhoto] = useState<PlacePhoto | null>(null);

  useEffect(() => {
    if (!pin) return;
    setIntel(null);
    setJobs([]);
    setPhoto(null);
    void fetchPlaceIntel(pin.lat, pin.lon).then((data) => {
      setIntel(data);
      setPhoto(data.photos[0] ?? null);
    });
    if (inTauri()) {
      void invokeSafe<JobPost[]>("search_jobs", {
        location: pin.city?.name ?? pin.name,
        query: pin.city?.jobs[0] ?? null,
      }).then(setJobs);
    }
  }, [pin?.lat, pin?.lon, pin?.name]);

  if (!pin) return null;
  const match = pin.city ? scoreCity(pin.city, profile) : null;

  return (
    <aside className="panel dossier">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Pinned earth</p>
          <h2>
            {pin.name}
            {pin.country ? <span className="country"> {pin.country}</span> : null}
          </h2>
          <p className="coords">
            {pin.lat.toFixed(3)}°, {pin.lon.toFixed(3)}°
          </p>
        </div>
        <button className="ghost" type="button" onClick={onClose}>
          Close
        </button>
      </header>

      {match ? (
        <div className="belong-meter">
          <div className="belong-top">
            <span>Would you belong</span>
            <strong>{match.belong}</strong>
          </div>
          <div className="meter">
            <i style={{ width: `${match.belong}%` }} />
          </div>
        </div>
      ) : null}

      <div className="photos">
        {(intel?.photos.length ? intel.photos : []).slice(0, 8).map((p) => (
          <button
            key={p.url}
            className={photo?.url === p.url ? "on" : ""}
            type="button"
            onClick={() => setPhoto(p)}
            title={p.title}
          >
            <img src={p.thumb || p.url} alt={p.title} />
          </button>
        ))}
      </div>
      {photo ? (
        <figure className="hero-photo">
          <img src={photo.url} alt={photo.title} />
          <figcaption>
            {photo.title} · {photo.source}
          </figcaption>
        </figure>
      ) : (
        <p className="muted">Loading the ground truth — satellite is already under your pin.</p>
      )}

      {pin.city ? (
        <section>
          <h3>The people</h3>
          <p>{pin.city.people}</p>
          <h3>The ground</h3>
          <p>{pin.city.environment}</p>
          <h3>Can you live</h3>
          <p>{pin.city.liveability}</p>
          <p className="chips">
            {pin.city.jobs.map((j) => (
              <span key={j}>{j}</span>
            ))}
            <span>cost {pin.city.cost}/10</span>
            <span>{pin.city.climate}</span>
          </p>
          <div className="bars">
            {ARCHETYPES.map((a) => (
              <div key={a} className="bar">
                <em>{ARCHETYPE_META[a].label}</em>
                <b>
                  <i
                    style={{
                      width: `${pin.city!.scores[a]}%`,
                      background: ARCHETYPE_META[a].color,
                    }}
                  />
                </b>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {intel?.wikiExtract ? (
        <section>
          <h3>{intel.wikiTitle ?? "This place"}</h3>
          <p>{intel.wikiExtract.slice(0, 720)}{intel.wikiExtract.length > 720 ? "…" : ""}</p>
          {intel.wikiUrl ? (
            <a href={intel.wikiUrl} target="_blank" rel="noreferrer">
              Wikipedia
            </a>
          ) : null}
        </section>
      ) : intel?.geo ? (
        <section>
          <h3>On the map</h3>
          <p>{intel.geo.displayName}</p>
        </section>
      ) : null}

      <section>
        <h3>Work in reach</h3>
        {jobs.length ? (
          <ul className="jobs">
            {jobs.slice(0, 8).map((j) => (
              <li key={j.url + j.title}>
                <a href={j.url} target="_blank" rel="noreferrer">
                  {j.title}
                </a>
                <span>
                  {j.company} · {j.location}
                  {j.remote ? " · remote" : ""} · {j.source}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">
            {pin.city
              ? `Look for ${pin.city.jobs.join(", ")}. Remote work is ${pin.city.remoteFriendly ? "a real door" : "harder here"}.`
              : "Drop closer to a city for job listings, or add a model in Settings to ask the compass."}
          </p>
        )}
      </section>
    </aside>
  );
}
