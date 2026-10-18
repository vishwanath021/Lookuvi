import {
  GROOM_BEARDS,
  GROOM_GROOMING,
  GROOM_HAIR,
  GROOM_MAX_IMAGES,
  GROOM_MODEL,
  GROOM_OWN_SLOTS,
  GROOM_QUALITY,
  groomChoice,
  groomItemEdge,
  groomSlot,
  type GroomChoice,
  type GroomSlotId,
} from "@/data/groom";
import { OWN_LOOK_MODEL, OWN_LOOK_QUALITY } from "@/data/bridal-own";
import {
  frameOwnLookSelfie,
  isPublicMediaKey,
  ownLookCapInr,
  ownLookForm,
  ownLookOutputTokens,
  shrinkOwnLookJpeg,
  type OwnLookPlan,
  type OwnLookSize,
} from "@/lib/bridal-own";
import { sunburstImageInputTokens } from "@/lib/ai/sunburst-tokens";
import { editFormFields, planImageEdit } from "@/lib/ai/edit-request";
import { restoreFrame, type FrameTransform } from "@/lib/ai/frame";
import { bufferedInr, usdFromTokenCounts } from "@/lib/ai/tiers";
import { numberEnv } from "@/lib/env";

const TEXT_TOKEN_FLOOR = 400;

export class GroomError extends Error {
  constructor(
    readonly code: "LOOK" | "ITEM" | "QUOTE" | "CAP",
    message: string,
  ) {
    super(message);
    this.name = "GroomError";
  }
}

export type GroomQuote = {
  model: typeof GROOM_MODEL;
  quality: typeof GROOM_QUALITY;
  size: OwnLookSize;
  imageCount: number;
  estimateUsd: number;
  estimateInr: number;
};

function catalogueSize(size: OwnLookSize) {
  return size === "1024x1360" ? "1024x1536" as const : size;
}

export function groomCapInr() {
  return Math.max(0, numberEnv("GROOM_CAP_INR", ownLookCapInr()));
}

const IDENTITY = [
  "Keep his exact face, beard, and skin tone.",
  "Do not change face shape or features.",
  "Keep his natural skin tone and skin texture exactly; do not lighten, whiten or smooth the skin.",
  "Modern, natural styling. No heavy ritual stock imagery.",
].join(" ");

/** Wedding hair, beard shaping, and grooming. No clothes are invented. */
export function buildGroomPrompt(hair: GroomChoice | null, beard: GroomChoice | null, grooming: GroomChoice | null) {
  const chosen = [hair?.prompt, beard?.prompt, grooming?.prompt].filter(Boolean);
  const beardLine = beard
    ? "Change the beard only as that shaping says. Keep his beard colour."
    : "Do not reshape or remove his beard.";
  return [
    "Image 1 is the groom's selfie. Keep this exact person.",
    chosen.length ? `Apply this wedding grooming: ${chosen.join(" ")}` : "Do not change his hair, beard, or skin.",
    IDENTITY,
    beardLine,
    "Do not add a sherwani, kurta, turban, mala, watch, flowers, or garland.",
    "A portrait, photorealistic, with natural light. No text, logos, watermarks, or extra people.",
    "This is a salon trial preview, not a guarantee of the finished grooming.",
  ].join(" ");
}

/** His own clothes. Face, beard, and skin tone stay as photographed. */
export function buildGroomOwnPrompt(slots: { noun: string }[]) {
  const clothing = slots.map((slot, index) => {
    const number = index + 2;
    return `Image ${number} is his ${slot.noun}. Copy that ${slot.noun} exactly onto him. Do not invent a different ${slot.noun}.`;
  });
  const items = slots.length
    ? "Dress him in those exact photographed items and no other clothes or jewellery."
    : "He did not add item photos. Do not invent a sherwani, kurta, turban, mala, or watch.";
  return [
    "Image 1 is the groom's own selfie. Keep this exact person. Do not copy a face from any later image.",
    ...clothing,
    items,
    "Make one photo of him wearing that look.",
    IDENTITY,
    "Do not reshape or remove his beard.",
    "No flowers, garlands, or ceremonial props he did not photograph.",
    "A portrait, photorealistic, with natural light. No text, logos, watermarks, or extra people.",
    "This is a salon trial preview, not a guarantee of the finished look.",
  ].join(" ");
}

export function planGroom(args: {
  hairId?: string;
  beardId?: string;
  groomingId?: string;
  slotIds: string[];
  size?: OwnLookSize;
}) {
  const size = args.size || "1024x1536";
  const hair = args.hairId ? groomChoice(GROOM_HAIR, args.hairId) : null;
  const beard = args.beardId ? groomChoice(GROOM_BEARDS, args.beardId) : null;
  const grooming = args.groomingId ? groomChoice(GROOM_GROOMING, args.groomingId) : null;
  if (args.hairId && !hair) return { ok: false as const, message: "That hairstyle is not on the list." };
  if (args.beardId && !beard) return { ok: false as const, message: "That beard look is not on the list." };
  if (args.groomingId && !grooming) return { ok: false as const, message: "That grooming look is not on the list." };
  if (args.slotIds.length > GROOM_OWN_SLOTS.length) {
    return { ok: false as const, message: "Too many item photos. Remove one and try again." };
  }
  const chosen: { id: GroomSlotId; noun: string }[] = [];
  for (const id of args.slotIds) {
    const slot = groomSlot(id);
    if (!slot) return { ok: false as const, message: "That item is not on the list." };
    if (chosen.some((item) => item.id === slot.id)) return { ok: false as const, message: "Each item can be added once." };
    chosen.push(slot);
  }
  const ordered = GROOM_OWN_SLOTS.filter((slot) => chosen.some((item) => item.id === slot.id));
  const own = ordered.length > 0;
  if (!own && !hair && !beard && !grooming) {
    return { ok: false as const, message: "Choose a hairstyle, a beard look, or a grooming finish." };
  }
  const prompt = own
    ? buildGroomOwnPrompt(ordered.map((slot) => ({ noun: slot.noun })))
    : buildGroomPrompt(hair, beard, grooming);
  const imageOrder = ["selfie.jpg", ...ordered.map((slot) => `${slot.id}.jpg`)];
  if (imageOrder.length > GROOM_MAX_IMAGES) return { ok: false as const, message: "Too many photos for one preview." };
  const planned = planImageEdit({
    model: GROOM_MODEL,
    prompt,
    quality: GROOM_QUALITY,
    size: catalogueSize(size),
    outputFormat: "jpeg",
    inputFidelity: null,
    imageOrder,
    mask: false,
  });
  if (!planned.ok) return planned;
  if (GROOM_MODEL !== OWN_LOOK_MODEL || GROOM_QUALITY !== OWN_LOOK_QUALITY) {
    return { ok: false as const, message: "The groom preview uses the same model as a bridal own look." };
  }
  const plan: OwnLookPlan = { ...planned.plan, size };
  const styleId = own ? ordered.map((slot) => slot.id).join("+") : [hair?.id, beard?.id, grooming?.id].filter(Boolean).join("+");
  return { ok: true as const, own, ordered, prompt, plan, styleId, hair, beard, grooming };
}

export function groomForm(plan: OwnLookPlan, images: { name: string; jpeg: Buffer }[]) {
  return ownLookForm(plan, images);
}

export function quoteGroom(args: { prompt: string; size: OwnLookSize; imageCount: number }): { ok: true; quote: GroomQuote } | { ok: false; message: string } {
  if (args.imageCount > GROOM_MAX_IMAGES) return { ok: false, message: "Too many photos for one preview." };
  const [width, height] = args.size.split("x").map((part) => Number(part));
  const imageInputTokens = sunburstImageInputTokens(width, height);
  const outputTokens = ownLookOutputTokens(args.size);
  const textInputTokens = Math.max(TEXT_TOKEN_FLOOR, Math.ceil(args.prompt.length / 4));
  const estimateUsd = usdFromTokenCounts(GROOM_MODEL, { textIn: textInputTokens, imageIn: imageInputTokens, output: outputTokens });
  if (estimateUsd == null) return { ok: false, message: `No token rates for ${GROOM_MODEL}. The request was not sent.` };
  const estimateInr = bufferedInr(estimateUsd);
  const capInr = groomCapInr();
  if (estimateInr > capInr) {
    return { ok: false, message: `This look is about ₹${estimateInr.toFixed(2)}, above the ₹${capInr.toFixed(0)} cap. It was not sent.` };
  }
  return {
    ok: true,
    quote: { model: GROOM_MODEL, quality: GROOM_QUALITY, size: args.size, imageCount: args.imageCount, estimateUsd, estimateInr },
  };
}

export function logGroomEstimate(quote: GroomQuote, salonId: string) {
  console.info(
    `[groom] cost estimate $${quote.estimateUsd.toFixed(4)} (~₹${quote.estimateInr.toFixed(2)}) ${quote.model} quality ${quote.quality} size ${quote.size} count ${quote.imageCount}. Not an invoice.`,
  );
  return { provider: "openai", model: quote.model, quality: quote.quality, size: quote.size, count: quote.imageCount, estimateUsd: quote.estimateUsd, estimateInr: quote.estimateInr, salonId };
}

export type PreparedGroom = {
  selfie: Buffer;
  transform: FrameTransform;
  items: { id: GroomSlotId; jpeg: Buffer }[];
  prompt: string;
  plan: OwnLookPlan;
  quote: GroomQuote;
  styleId: string;
  own: boolean;
};

export async function prepareGroom(args: {
  selfie: Buffer;
  items: { id: string; bytes: Buffer }[];
  hairId?: string;
  beardId?: string;
  groomingId?: string;
}) {
  const selfie = await frameOwnLookSelfie(args.selfie);
  const planned = planGroom({
    hairId: args.hairId,
    beardId: args.beardId,
    groomingId: args.groomingId,
    slotIds: args.items.map((item) => item.id),
    size: selfie.size,
  });
  if (!planned.ok) throw new GroomError(planned.message.startsWith("Choose") || planned.message.includes("not on the list") ? "LOOK" : "ITEM", planned.message);
  const items = [];
  for (const slot of planned.ordered) {
    const source = args.items.find((item) => item.id === slot.id);
    if (!source) throw new GroomError("ITEM", "That item photo was missing.");
    const shrunk = await shrinkOwnLookJpeg(source.bytes, groomItemEdge(slot.id));
    items.push({ id: slot.id, jpeg: shrunk.jpeg });
  }
  const quoted = quoteGroom({ prompt: planned.prompt, size: selfie.size, imageCount: 1 + items.length });
  if (!quoted.ok) {
    console.info(`[groom] cost estimate refused. ${quoted.message}`);
    throw new GroomError(quoted.message.includes("cap") ? "CAP" : "QUOTE", quoted.message);
  }
  return {
    selfie: selfie.jpeg,
    transform: selfie.transform,
    items,
    prompt: planned.prompt,
    plan: planned.plan,
    quote: quoted.quote,
    styleId: planned.styleId,
    own: planned.own,
  } satisfies PreparedGroom;
}

export function groomItemKey(tenantId: string, requestId: string, slotId: string) {
  const tenant = tenantId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
  const request = requestId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  return `groom-own/${tenant || "salon"}/${request || "look"}/${slotId}.jpg`;
}

/** Store each item photo on a private key, run one edit, then delete those keys. */
export async function generateGroom(args: {
  selfie: Buffer;
  items: { id: string; bytes: Buffer }[];
  hairId?: string;
  beardId?: string;
  groomingId?: string;
  tenantId: string;
  requestId: string;
  put: (key: string, body: Buffer) => Promise<void>;
  remove: (key: string) => Promise<void>;
  beforeEdit?: (quote: GroomQuote) => Promise<void>;
  edit: (form: FormData) => Promise<Buffer>;
}): Promise<{ image: Buffer; quote: GroomQuote; keys: string[]; styleId: string; own: boolean }> {
  const prepared = await prepareGroom(args);
  logGroomEstimate(prepared.quote, args.tenantId);
  const keys: string[] = [];
  try {
    for (const item of prepared.items) {
      const key = groomItemKey(args.tenantId, args.requestId, item.id);
      if (isPublicMediaKey(key)) throw new GroomError("ITEM", "Item photos are not stored on a public path.");
      await args.put(key, item.jpeg);
      keys.push(key);
    }
    if (args.beforeEdit) await args.beforeEdit(prepared.quote);
    const form = groomForm(prepared.plan, [
      { name: "selfie.jpg", jpeg: prepared.selfie },
      ...prepared.items.map((item) => ({ name: `${item.id}.jpg`, jpeg: item.jpeg })),
    ]);
    const image = await args.edit(form);
    const restored = await restoreFrame(image, prepared.transform);
    return { image: restored, quote: prepared.quote, keys, styleId: prepared.styleId, own: prepared.own };
  } finally {
    await Promise.all(keys.map((key) => args.remove(key).catch(() => undefined)));
  }
}

/** The posted size for a 3:4 frame is 1024x1360, not the catalogue stand-in. */
export function groomRequestSize(plan: OwnLookPlan) {
  const fields = editFormFields({ ...plan, size: catalogueSize(plan.size) });
  return plan.size || fields.size;
}
