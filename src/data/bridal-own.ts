/** The bride's own clothes and jewellery. Each slot is optional. */

export const OWN_LOOK_SLOTS = [
  {
    id: "saree",
    label: "Saree",
    subtitle: "",
    noun: "saree",
    optional: true,
    place: "Drape that saree on her as a bridal saree.",
  },
  {
    id: "blouse",
    label: "Blouse",
    subtitle: "",
    noun: "blouse",
    optional: true,
    place: "Put that blouse on her.",
  },
  {
    id: "earrings",
    label: "Earrings",
    subtitle: "Jhumkas",
    noun: "earrings",
    optional: true,
    place: "Hang those earrings from her earlobes.",
  },
  {
    id: "ear-chain",
    label: "Ear chain",
    subtitle: "Champaswaralu",
    noun: "ear chain",
    optional: true,
    place: "Place the champaswaralu chain from the top of the earring, arcing back into her hair.",
  },
  {
    id: "forehead-pendant",
    label: "Forehead pendant",
    subtitle: "Papidi billa / Maang tikka",
    noun: "forehead pendant",
    optional: true,
    place: "Place the papidi billa on the hair parting and forehead. Keep her own bindi from the selfie.",
  },
  {
    id: "necklace",
    label: "Necklace / Choker",
    subtitle: "Kanthe / Addigai",
    noun: "necklace",
    optional: true,
    place: "Place that necklace or choker at her neck.",
  },
  {
    id: "long-haram",
    label: "Long haram",
    subtitle: "",
    noun: "long haram",
    optional: true,
    place: "Hang the long haram below the necklace.",
  },
  {
    id: "bangles",
    label: "Bangles",
    subtitle: "Gajulu",
    noun: "bangles",
    optional: true,
    place: "Place those bangles on both wrists.",
  },
  {
    id: "waist-belt",
    label: "Waist belt",
    subtitle: "Vaddanam",
    noun: "waist belt",
    optional: true,
    place: "Place the vaddanam around her waist, over the saree pleats.",
  },
  {
    id: "hair-accessories",
    label: "Hair accessories",
    subtitle: "Jada billa / clips",
    noun: "hair accessories",
    optional: true,
    place: "Place those hair accessories on the bun. If the photo shows a brooch and separate small hair clips, keep the clips separate from the brooch.",
  },
  {
    id: "arm-band",
    label: "Arm band",
    subtitle: "Vanki",
    noun: "arm band",
    optional: true,
    more: true,
    place: "Place the vanki on her upper arm.",
  },
  {
    id: "braid-ornament",
    label: "Braid ornament",
    subtitle: "Jada / Jadagantalu",
    noun: "braid ornament",
    optional: true,
    more: true,
    place: "Place the jada ornament down the braid.",
  },
  {
    id: "anklets",
    label: "Anklets",
    subtitle: "Pattilu",
    noun: "anklets",
    optional: true,
    more: true,
    place: "Place the pattilu on her ankles only if her feet are visible. If her feet are not in the frame, leave the anklets out and do not change the crop.",
  },
  {
    id: "rings",
    label: "Rings",
    subtitle: "",
    noun: "rings",
    optional: true,
    more: true,
    place: "Place those rings on the fingers shown in her photo.",
  },
] as const;

export type OwnLookSlotId = (typeof OWN_LOOK_SLOTS)[number]["id"];

/** Precise edit model. Quality stays medium. input_fidelity is not in this model's parameter table. */
export const OWN_LOOK_MODEL = "gpt-image-2.5-sunburst";
export const OWN_LOOK_QUALITY = "medium" as const;
/** 3:4 selfie canvas. Other aspects use a catalogue size chosen from the photo. */
export const OWN_LOOK_THREE_BY_FOUR = "1024x1360" as const;
/** Longest edge for the saree photo. */
export const OWN_LOOK_SAREE_EDGE = 512;
/** Longest edge for a jewellery photo, so the piece stays readable. */
export const OWN_LOOK_JEWELLERY_EDGE = 640;
/** Longest edge for the blouse and hair accessories. */
export const OWN_LOOK_ITEM_EDGE = 384;

const JEWELLERY_SLOTS = new Set<OwnLookSlotId>([
  "earrings",
  "ear-chain",
  "forehead-pendant",
  "necklace",
  "long-haram",
  "bangles",
  "waist-belt",
  "arm-band",
  "braid-ornament",
  "anklets",
  "rings",
]);

export function ownLookItemEdge(id: string) {
  if (id === "saree") return OWN_LOOK_SAREE_EDGE;
  if (JEWELLERY_SLOTS.has(id as OwnLookSlotId)) return OWN_LOOK_JEWELLERY_EDGE;
  return OWN_LOOK_ITEM_EDGE;
}
export const OWN_LOOK_MAX_BYTES = 2 * 1024 * 1024;
/** Largest request the route reads: selfie and every slot at the per-photo cap, plus form overhead. */
export const OWN_LOOK_MAX_BODY_BYTES = 20 * 1024 * 1024;
export const OWN_LOOK_TOO_LARGE = "These photos are too large together. Remove a piece and try again. No try was used.";
/** Many input photos make the edit slower than a single-photo look. The route allows 120 s. */
export const OWN_LOOK_PROVIDER_TIMEOUT_MS = 100_000;
/** Selfie plus every slot. A request with more files is refused. */
export const OWN_LOOK_MAX_IMAGES = 1 + OWN_LOOK_SLOTS.length;

export function ownLookSlot(id: string) {
  return OWN_LOOK_SLOTS.find((slot) => slot.id === id) ?? null;
}
