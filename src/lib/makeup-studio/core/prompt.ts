import { EYE_LOOKS, FINISH_LOOKS, LIP_SHADES } from "@/lib/makeup-studio/core/palette";
import { clampLook } from "@/lib/makeup-studio/core/params";
import type { LookParams } from "@/lib/makeup-studio/core/types";

/**
 * Prompt for the salon image edit. Built only from clamped look fields.
 * Wording is Lookuvi's. It does not reuse another product's prompt.
 */
export function buildMakeupPrompt(input: LookParams): string {
  const look = clampLook(input);
  const lip = LIP_SHADES[look.lip];
  const eye = EYE_LOOKS[look.eyes];
  const finish = FINISH_LOOKS[look.finish];
  const gloss = look.gloss
    ? "Add a thin clear gloss on the centre of the lower lip only."
    : "Keep the lip colour soft, without a mirror shine.";
  return [
    "Image 1 is the customer's own portrait. Image 2 is a flat lip-colour chip and not a person.",
    "Do not copy a face, body, clothing, or background from image 2.",
    "Paint makeup onto the person in image 1 and leave the rest of the photograph as it is.",
    "Keep this same person: face shape, age, skin tone, pores, hair, clothes, jewellery, pose, crop, and background.",
    "Do not slim, lift, or replace the face.",
    `Foundation strength ${look.foundation} out of 100. Even the complexion a little and keep the pores visible.`,
    `Blush strength ${look.blush} out of 100. Place a soft rose blush on the apples of the cheeks.`,
    `Overall makeup strength ${look.intensity} out of 100.`,
    `Lip colour: ${lip.phrase}. Hex ${lip.hex}. ${gloss}`,
    `Eyes: ${eye.phrase}.`,
    `Skin finish: ${finish.phrase}.`,
    "A photorealistic portrait in natural light. No text, logos, watermarks, frames, or extra people.",
    "This is a salon trial preview and not a promise of the finished makeup.",
  ].join(" ");
}
