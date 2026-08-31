import type { ArchetypeId } from "./types";

export interface ArchetypeMeta {
  id: ArchetypeId;
  label: string;
  short: string;
  prompt: string;
  color: string;
}

export const ARCHETYPE_META: Record<ArchetypeId, ArchetypeMeta> = {
  unique: {
    id: "unique",
    label: "Unique",
    short: "Strange is normal here",
    prompt: "people who are unusual, original, neurodivergent, or refusing the script",
    color: "#7dd3c7",
  },
  manipulator: {
    id: "manipulator",
    label: "High-game",
    short: "Status, leverage, politics",
    prompt: "high-game social climates: status, sales, politics, extraction — where manipulators thrive",
    color: "#e07a5f",
  },
  highTrust: {
    id: "highTrust",
    label: "High-trust",
    short: "Kindness is the default",
    prompt: "high-trust, low-cruelty people who mean what they say",
    color: "#c9a227",
  },
  hustle: {
    id: "hustle",
    label: "Hustle",
    short: "Ambition as weather",
    prompt: "ambitious grind cultures where work is identity",
    color: "#f2c14e",
  },
  quiet: {
    id: "quiet",
    label: "Quiet",
    short: "Room to be left alone",
    prompt: "quiet, solitude-friendly places that do not punish introversion",
    color: "#8aa2b4",
  },
  queer: {
    id: "queer",
    label: "Chosen family",
    short: "Queer and self-made kin",
    prompt: "queer, chosen-family, and self-invented communities",
    color: "#d4a0c4",
  },
  intellectual: {
    id: "intellectual",
    label: "Intellectual",
    short: "Books over branding",
    prompt: "academic, bookish, idea-drunk people",
    color: "#9bb8d3",
  },
  traditional: {
    id: "traditional",
    label: "Traditional",
    short: "Roots, ritual, family",
    prompt: "traditional, faith, family, and rooted cultures",
    color: "#c4a484",
  },
  luxury: {
    id: "luxury",
    label: "Luxury",
    short: "Old money and new velvet",
    prompt: "luxury, elite, and high-polish social worlds",
    color: "#e6d5a8",
  },
  creative: {
    id: "creative",
    label: "Creative",
    short: "Making is the currency",
    prompt: "artists, musicians, filmmakers, designers",
    color: "#e8a87c",
  },
  tech: {
    id: "tech",
    label: "Tech",
    short: "Builders and operators",
    prompt: "engineers, startups, and technical scenes",
    color: "#7eb8da",
  },
  diaspora: {
    id: "diaspora",
    label: "Diaspora",
    short: "Everyone is from somewhere",
    prompt: "immigrant, mixed, and in-between cities",
    color: "#b8c99a",
  },
};
