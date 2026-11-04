/** Guest try-on models the super-admin can select. Sunburst stays first and is the default. */

export const GUEST_OPENAI_MODEL = "gpt-image-2.5-sunburst";
export const GUEST_FAL_MODEL = "blackforestlabs/flux-3/edit-image";

export const GUEST_MODEL_OPTIONS = [
  { id: GUEST_OPENAI_MODEL, label: "OpenAI gpt-image-2.5-sunburst (default)" },
  { id: GUEST_FAL_MODEL, label: "fal FLUX.3 edit" },
  { id: "meta/muse-image/edit", label: "Meta Muse Image" },
  { id: "fal-ai/qwen-image-edit-2511", label: "Qwen Image Edit 2511" },
  { id: "fal-ai/flux-2/edit", label: "FLUX.2 edit" },
  { id: "fal-ai/flux-2/klein/4b/edit", label: "FLUX.2 Klein 4B edit" },
  { id: "bytedance/seedream/v5/lite/edit", label: "Seedream v5 lite edit" },
] as const;

export type GuestModelId = (typeof GUEST_MODEL_OPTIONS)[number]["id"];

export const DEFAULT_GUEST_MODEL: GuestModelId = GUEST_OPENAI_MODEL;

export function parseGuestModel(value: string): GuestModelId | null {
  const match = GUEST_MODEL_OPTIONS.find((row) => row.id === value);
  return match ? match.id : null;
}

export function guestModelProvider(model: GuestModelId): "openai" | "fal" {
  return model === GUEST_OPENAI_MODEL ? "openai" : "fal";
}
