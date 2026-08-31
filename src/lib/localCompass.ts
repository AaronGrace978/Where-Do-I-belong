import type { ChatMsg, PinPlace, SoulProfile } from "./types";
import { ARCHETYPES } from "./types";
import { ARCHETYPE_META } from "./archetypes";
import { byArchetype, rankCities } from "./engine";
import { CITIES, nearestCity } from "../data/cities";

export interface LocalResult {
  text: string;
  tools: Array<{ name: string; arguments: Record<string, unknown> }>;
}

export function localCompass(
  input: string,
  profile: SoulProfile,
  pin: PinPlace | null,
): LocalResult {
  const q = input.toLowerCase();
  const tools: LocalResult["tools"] = [];

  for (const a of ARCHETYPES) {
    const meta = ARCHETYPE_META[a];
    if (
      q.includes(a) ||
      q.includes(meta.label.toLowerCase()) ||
      (a === "manipulator" && (q.includes("manipulat") || q.includes("high-game") || q.includes("status"))) ||
      (a === "unique" && (q.includes("weird") || q.includes("strange") || q.includes("neuro"))) ||
      (a === "highTrust" && (q.includes("kind") || q.includes("trust") || q.includes("nice")))
    ) {
      const top = byArchetype(a, 6);
      tools.push({ name: "highlight_archetype", arguments: { archetype: a } });
      if (top[0]) {
        tools.push({
          name: "fly_to_place",
          arguments: {
            name: top[0].name,
            lat: top[0].lat,
            lon: top[0].lon,
            reason: meta.short,
          },
        });
      }
      const lines = top.map(
        (c, i) =>
          `${i + 1}. **${c.name}**, ${c.country} — ${c.people.split(".").slice(0, 2).join(".").trim()}.`,
      );
      return {
        tools,
        text: `Here is where **${meta.label.toLowerCase()}** people concentrate — not a morality map, a climate map.\n\n${lines.join("\n\n")}\n\nJobs still matter. ${top[0]?.name} lives on ${top[0]?.jobs.slice(0, 3).join(", ") || "mixed work"}. Click any pin. I will show the street, the photos, and whether you can actually stay.`,
      };
    }
  }

  const named = CITIES.find(
    (c) => q.includes(c.name.toLowerCase()) || q.includes(c.id),
  );
  if (named) {
    tools.push({
      name: "fly_to_place",
      arguments: { name: named.name, lat: named.lat, lon: named.lon },
    });
    return {
      tools,
      text: `**${named.name}, ${named.country}**\n\n${named.people}\n\n${named.environment}\n\n**Living:** ${named.liveability}\n**Work:** ${named.jobs.join(", ")} · cost ${named.cost}/10\n**Climate:** ${named.climate}\n\nIf this is not your people, say what you are actually looking for — unique, high-trust, hustle, quiet, chosen family — and I will spin the globe.`,
    };
  }

  if (
    q.includes("where") ||
    q.includes("belong") ||
    q.includes("should i go") ||
    q.includes("recommend") ||
    q.includes("match") ||
    q.includes("leave") ||
    profile.story
  ) {
    const ranked = rankCities(profile, 5);
    tools.push({
      name: "recommend_matches",
      arguments: { cityIds: ranked.map((c) => c.id) },
    });
    if (ranked[0]) {
      tools.push({
        name: "fly_to_place",
        arguments: {
          name: ranked[0].name,
          lat: ranked[0].lat,
          lon: ranked[0].lon,
          reason: ranked[0].reasons[0],
        },
      });
    }
    const block = ranked
      .map(
        (m) =>
          `**${m.belong} · ${m.name}, ${m.country}**\n${m.people}\nWhy you: ${m.reasons.join(" ")}${m.cautions.length ? `\nWatch: ${m.cautions.join(" ")}` : ""}`,
      )
      .join("\n\n");
    const opening = profile.leaving
      ? `You said you are leaving ${profile.leaving}. I took that seriously.`
      : "I matched your people-climate against the atlas.";
    return {
      tools,
      text: `${opening}\n\n${block}\n\nThe globe is dropping pins on these. Click one. If none of them feel like home, tell me who hurt you and who you still want — I will aim again.\n\n_Add an API key in Settings if you want a deeper model. The compass still works without one._`,
    };
  }

  if (pin) {
    const near = pin.city ?? nearestCity(pin.lat, pin.lon, 120);
    return {
      tools: [],
      text: `You pinned **${pin.name}**${pin.country ? `, ${pin.country}` : ""}.\n\n${
        near
          ? `${near.people}\n\n${near.liveability}`
          : "This is off the catalog. I can still read the land: look at the photos and the Wikipedia extract in the dossier. Tell me what you need from people — and I will compare this pin to cities that already have a climate."
      }\n\nAsk me if you would belong here, or say "show unique people" / "show high-game cities".`,
    };
  }

  return {
    tools: [],
    text: "Tell me who you are, or click the Earth.\n\nYou can say things like:\n- *I am unique and tired of mean rooms*\n- *Where do manipulators actually live?*\n- *I need a job and kindness and I have to leave Boston*\n\nI will fly you there.",
  };
}

export function seedGreeting(profile: SoulProfile): ChatMsg {
  return {
    id: "hello",
    role: "assistant",
    content: profile.completed
      ? `I have your letter. ${profile.leaving ? `You are trying to leave ${profile.leaving}.` : "You are looking for your people."}\n\nDrag the globe. Click to drop a pin. Or ask me where you belong.`
      : "This is a love letter with a globe attached.\n\nIf the people around you are wrong, we will not fix them. We will find the room you were supposed to walk into.\n\nStart the letter, or click any place on Earth.",
  };
}
