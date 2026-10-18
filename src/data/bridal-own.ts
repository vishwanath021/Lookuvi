/** The bride's own clothes and jewellery. Each slot is optional. */

export const OWN_LOOK_SLOTS = [
  {
    id: "saree",
    label: "Saree",
    subtitle: "",
    noun: "saree",
    optional: false,
    place: "Drape that saree on her as a bridal saree.",
  },
  {
    id: "blouse",
    label: "Blouse",
    subtitle: "",
    noun: "blouse",
    optional: false,
    place: "Put that blouse on her.",
  },
  {
    id: "earrings",
    label: "Earrings",
    subtitle: "Jhumkas",
    noun: "earrings",
    optional: false,
    place: "Hang those earrings from her earlobes.",
  },
  {
    id: "ear-chain",
    label: "Ear chain",
    subtitle: "Champaswaralu",
    noun: "ear chain",
    optional: false,
    place: "Place the champaswaralu chain from the top of the earring, arcing back into her hair.",
  },
  {
    id: "forehead-pendant",
    label: "Forehead pendant",
    subtitle: "Papidi billa / Maang tikka",
    noun: "forehead pendant",
    optional: false,
    place: "Place the papidi billa on the hair parting and forehead. Keep her own bindi from the selfie.",
  },
  {
    id: "necklace",
    label: "Necklace",
    subtitle: "",
    noun: "necklace",
    optional: false,
    place: "Place that necklace at her neck.",
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
    id: "hair-accessories",
    label: "Hair accessories",
    subtitle: "Jada billa / Vaddanam",
    noun: "hair accessories",
    optional: true,
    place: "Place those hair accessories on the bun.",
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

const JEWELLERY_SLOTS = new Set<OwnLookSlotId>(["earrings", "ear-chain", "forehead-pendant", "necklace", "long-haram"]);

export function ownLookItemEdge(id: string) {
  if (id === "saree") return OWN_LOOK_SAREE_EDGE;
  if (JEWELLERY_SLOTS.has(id as OwnLookSlotId)) return OWN_LOOK_JEWELLERY_EDGE;
  return OWN_LOOK_ITEM_EDGE;
}
export const OWN_LOOK_MAX_BYTES = 2 * 1024 * 1024;
/** Selfie plus every slot. A request with more files is refused. */
export const OWN_LOOK_MAX_IMAGES = 1 + OWN_LOOK_SLOTS.length;

export function ownLookSlot(id: string) {
  return OWN_LOOK_SLOTS.find((slot) => slot.id === id) ?? null;
}
