/** Wedding grooming for the groom. No stock photos: every choice is a text chip. */

export type GroomChoice = {
  id: string;
  name: string;
  prompt: string;
};

export const GROOM_HAIR: GroomChoice[] = [
  { id: "groom-side-part", name: "Clean side part", prompt: "Style his hair as a clean side part, neat and modern. Keep the length close to his photo." },
  { id: "groom-textured-crop", name: "Textured crop", prompt: "Style his hair as a short textured crop, natural and tidy." },
  { id: "groom-slick-back", name: "Slick back", prompt: "Style his hair slicked back, smooth and modern, without a heavy shine." },
  { id: "groom-soft-quiff", name: "Soft quiff", prompt: "Style his hair as a soft quiff with a little height at the front." },
];

export const GROOM_BEARDS: GroomChoice[] = [
  { id: "groom-short-beard", name: "Neat short beard", prompt: "Shape his beard into a neat short beard. Keep his beard colour and density." },
  { id: "groom-stubble", name: "Defined stubble", prompt: "Shape his beard into defined stubble along the jaw. Do not shave him bare." },
  { id: "groom-clean-jaw", name: "Clean jawline", prompt: "Tidy the jawline. Keep the beard he already has and only neaten the edge." },
  { id: "groom-moustache", name: "Trimmed moustache", prompt: "Neaten his moustache. Do not add a beard he does not have." },
];

export const GROOM_GROOMING: GroomChoice[] = [
  { id: "groom-glow", name: "Facial glow", prompt: "A light facial glow: even, healthy skin with a soft sheen. Do not lighten, whiten, or smooth the skin." },
  { id: "groom-natural", name: "Natural skin", prompt: "Leave the skin natural. No glow, no powder, and no colour change." },
];

export const GROOM_OWN_SLOTS = [
  { id: "sherwani", label: "Sherwani", noun: "sherwani" },
  { id: "kurta", label: "Kurta", noun: "kurta" },
  { id: "turban", label: "Turban / safa", noun: "turban or safa" },
  { id: "mala", label: "Mala", noun: "mala" },
  { id: "watch", label: "Watch", noun: "watch" },
] as const;

export type GroomSlotId = (typeof GROOM_OWN_SLOTS)[number]["id"];

export const GROOM_MODEL = "gpt-image-2.5-sunburst";
export const GROOM_QUALITY = "medium" as const;
export const GROOM_CLOTH_EDGE = 512;
export const GROOM_JEWELLERY_EDGE = 640;
export const GROOM_MAX_BYTES = 2 * 1024 * 1024;
export const GROOM_MAX_IMAGES = 1 + GROOM_OWN_SLOTS.length;

const CLOTH_SLOTS = new Set<GroomSlotId>(["sherwani", "kurta", "turban"]);

export function groomItemEdge(id: string) {
  if (CLOTH_SLOTS.has(id as GroomSlotId)) return GROOM_CLOTH_EDGE;
  return GROOM_JEWELLERY_EDGE;
}

export function groomSlot(id: string) {
  return GROOM_OWN_SLOTS.find((slot) => slot.id === id) ?? null;
}

export function groomChoice(list: GroomChoice[], id: string) {
  return list.find((item) => item.id === id) ?? null;
}

/** A single category has no pill row. Two or more categories do. */
export function categoryPills<T>(groups: T[]) {
  return groups.length > 1 ? groups : [];
}
