import type { ArchetypeId, City, SoulProfile } from "./types";
import { ARCHETYPES } from "./types";
import { CITIES } from "../data/cities";
import { ARCHETYPE_META } from "./archetypes";

export interface Match extends City {
  belong: number;
  reasons: string[];
  cautions: string[];
}

export function scoreCity(city: City, profile: SoulProfile): Match {
  const traits = profile.traits;
  let acc = 0;
  let w = 0;
  for (const a of ARCHETYPES) {
    const u = (traits[a] ?? 40) / 100;
    const c = city.scores[a] / 100;
    const importance = 0.4 + u * u;
    acc += importance * (1 - Math.abs(u - c));
    w += importance;
    if (u >= 0.68 && c >= 0.72) acc += 0.12;
    if (u >= 0.68 && c <= 0.38) acc -= 0.22;
    if (u <= 0.3 && c >= 0.85) acc -= 0.1;
  }
  let belong = (acc / Math.max(w, 0.01)) * 100;

  const reasons: string[] = [];
  const cautions: string[] = [];

  const ranked = ARCHETYPES.map((a) => ({
    a,
    user: traits[a] ?? 40,
    city: city.scores[a],
    fit: ((traits[a] ?? 40) / 100) * (city.scores[a] / 100),
  })).sort((x, y) => y.fit - x.fit);

  for (const r of ranked.slice(0, 3)) {
    if (r.user >= 55 && r.city >= 60) {
      reasons.push(`${ARCHETYPE_META[r.a].label}: ${ARCHETYPE_META[r.a].short.toLowerCase()}.`);
    }
  }

  if (profile.budget && city.cost > profile.budget + 2) {
    belong -= (city.cost - profile.budget) * 4;
    cautions.push(`Cost of living sits above your budget (${city.cost}/10 vs ${profile.budget}/10).`);
  } else if (city.cost <= profile.budget) {
    reasons.push("The money math can actually work.");
  }

  if (profile.needsJob && city.jobs.length) {
    reasons.push(`Work exists in ${city.jobs.slice(0, 3).join(", ")}.`);
    if (profile.remoteOk && city.remoteFriendly) {
      belong += 4;
      reasons.push("Remote-friendly if you bring your own laptop.");
    }
  }

  if (profile.climatePref && profile.climatePref !== "any") {
    const blob = city.climate.toLowerCase();
    if (profile.climatePref === "warm" && /cold|winter|dark|grey|rain/.test(blob) && !/hot|tropical|sun|mediterranean/.test(blob)) {
      belong -= 8;
      cautions.push("The weather may fight you.");
    }
    if (profile.climatePref === "cold" && /hot|tropical|humid|desert/.test(blob)) {
      belong -= 8;
      cautions.push("The heat is not a vibe, it is a climate.");
    }
  }

  const leaving = profile.leaving.toLowerCase();
  if (leaving && (city.people.toLowerCase().includes(leaving.split(" ")[0]) || city.id === "boston" && leaving.includes("boston"))) {
    if (city.id === "boston") {
      belong -= 25;
      cautions.push("This is the climate you said you are leaving.");
    }
  }

  belong = Math.max(8, Math.min(99, Math.round(belong)));
  if (!reasons.length) reasons.push(city.people.split(".")[0] + ".");

  return { ...city, belong, reasons: reasons.slice(0, 4), cautions };
}

export function rankCities(profile: SoulProfile, n = 8): Match[] {
  return CITIES.map((c) => scoreCity(c, profile))
    .sort((a, b) => b.belong - a.belong)
    .slice(0, n);
}

export function byArchetype(id: ArchetypeId, n = 14): City[] {
  return [...CITIES].sort((a, b) => b.scores[id] - a.scores[id]).slice(0, n);
}

export function describeMatch(m: Match): string {
  const lines = [
    `${m.name}, ${m.country} — belonging ${m.belong}/100`,
    m.people,
    m.environment,
    m.liveability,
    m.reasons.length ? `Why you: ${m.reasons.join(" ")}` : "",
    m.cautions.length ? `Watch: ${m.cautions.join(" ")}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}
