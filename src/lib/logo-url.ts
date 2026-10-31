/** Salon logos shown on guest pages. Keep schemes that cannot run script. */
const BRAND_PATH = /^\/brand\/[a-z0-9._-]+$/i;
const DATA_IMAGE = /^data:image\/(jpeg|jpg|png|webp);base64,[a-z0-9+/=\s]+$/i;

export function isAllowedLogoUrl(value: string | null | undefined) {
  if (value == null || value === "") return true;
  if (value.length > 200_000) return false;
  if (BRAND_PATH.test(value)) return true;
  if (DATA_IMAGE.test(value)) return true;
  return false;
}
