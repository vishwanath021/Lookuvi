import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { browById, type BrowVariation } from "@/data/brows";
import { buildBrowPrompt } from "@/lib/prompts";
import type { StyleDef } from "@/data/styles";

/** fal Qwen Image Edit 2511. It follows "image 1" / "image 2" and edits the first URL. */
export const QWEN_EDIT_ID = "fal-ai/qwen-image-edit-2511";

export function isQwenEdit(modelId: string) {
  return modelId === QWEN_EDIT_ID;
}

const ROLES =
  "image 1 is the customer photo to edit. image 2 is the reference only. Edit image 1. Do not copy the face, skin, clothes, pose, or background from image 2.";

function sentence(prompt: string, start: string) {
  return prompt.split(/(?<=\.)\s/).find((part) => part.startsWith(start)) ?? "";
}

/** Hair. The fringe, fade, and length come from image 2, not from a guessed bowl cut. */
export function qwenHairPrompt(style: Pick<StyleDef, "name" | "prompt">) {
  return [
    ROLES,
    "Change only the hair of the person in image 1. Match the length, fringe, fade, sides, parting, and texture shown in image 2.",
    "Do not invent a bowl fringe, a blunt straight fringe, or a different cut when image 2 does not show one.",
    "Keep the face, identity, clothes, and background in image 1 unchanged.",
    `The style is ${style.name}. ${style.prompt}`,
  ].join(" ");
}

/** Brows. image 2 is the brow photo or diagram. Thickness and colour stay in the prompt. */
export function qwenBrowPrompt(name: string, shape: string, variationPrompt: string) {
  return [
    ROLES,
    "image 2 shows the eyebrow shape to copy. It is not a face to copy.",
    "Change only the eyebrows of the person in image 1 so the arch, peak, tail, and thickness match image 2.",
    "Keep separate brow hairs and a soft edge. Do not paint a solid dark block and do not make the brows thicker than image 2.",
    "Do not change the hair, eyes, skin, clothes, or background.",
    `The brow is ${name}. ${shape}`,
    sentence(variationPrompt, "Stroke weight:"),
    sentence(variationPrompt, "Brow pigment:"),
  ].filter(Boolean).join(" ");
}

export function qwenZonePrompt(tool: string, detail: string) {
  const zone =
    tool === "beard"
      ? "Change only the beard, moustache, and stubble of the person in image 1 to match image 2."
      : tool === "colour"
        ? "Change only the hair colour of the person in image 1 to the colour in image 2. Keep the haircut and the face."
        : tool === "nails"
          ? "Change only the polish or art on the fingernails in image 1 to match image 2."
          : "Change only the area named below. Leave the rest of image 1 unchanged.";
  return [ROLES, zone, detail].join(" ");
}

/** Card photo the guest sees. The line diagram is the fallback when no photo exists. */
export function readBrowCardReference(id: string) {
  if (!/^[a-z0-9-]{1,80}$/.test(id)) return null;
  const file = path.join(process.cwd(), "public", "brows", "cards", `${id}.webp`);
  if (!existsSync(file)) return null;
  return { bytes: readFileSync(file), fileName: `${id}.webp` };
}

export function qwenBrowReferencePrompt(id: string, variation?: BrowVariation) {
  const brow = browById(id);
  if (!brow) return "";
  return qwenBrowPrompt(brow.name, brow.prompt, buildBrowPrompt(brow, variation));
}

/** Qwen gets a short image-1 / image-2 prompt. Brows use the card photo the guest sees. */
export function tuneQwenGuest(args: {
  tool: string;
  styleId: string;
  prompt: string;
  reference: Buffer;
  referenceFile: string;
}) {
  if (args.tool === "brows") {
    const card = readBrowCardReference(args.styleId);
    const brow = browById(args.styleId);
    return {
      prompt: brow ? qwenBrowPrompt(brow.name, brow.prompt, args.prompt) : qwenZonePrompt("brows", args.prompt),
      reference: card?.bytes ?? args.reference,
      referenceFile: card?.fileName ?? args.referenceFile,
    };
  }
  if (args.tool === "beard" || args.tool === "colour" || args.tool === "nails") {
    return { prompt: qwenZonePrompt(args.tool, args.prompt), reference: args.reference, referenceFile: args.referenceFile };
  }
  return { prompt: args.prompt, reference: args.reference, referenceFile: args.referenceFile };
}
