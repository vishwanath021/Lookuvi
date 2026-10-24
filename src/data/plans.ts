export type PlanId = "LITE" | "STARTER" | "PRO";

export type PlanDef = {
  id: PlanId;
  name: string;
  /** Monthly price in rupees. GST is added only when GST_ENABLED is on. */
  monthlyExGst: number;
  setupExGst: number;
  credits: number;
  styleLimit: number | null;
  customDomain: boolean;
  leadExport: boolean;
  removeBranding: boolean;
  embed: boolean;
  outlets: number;
  languages: number | null;
};

/**
 * Stored ids stay LITE / STARTER / PRO so existing salon rows keep working.
 * Owners see Basic, Standard, and Pro.
 * Annual = 10× monthly (two months free).
 */
export const PLANS: Record<PlanId, PlanDef> = {
  LITE: {
    id: "LITE",
    name: "Basic",
    monthlyExGst: 799,
    setupExGst: 0,
    credits: 50,
    styleLimit: null,
    customDomain: false,
    leadExport: false,
    removeBranding: false,
    embed: false,
    outlets: 1,
    languages: 2,
  },
  STARTER: {
    id: "STARTER",
    name: "Standard",
    monthlyExGst: 1499,
    setupExGst: 0,
    credits: 120,
    styleLimit: null,
    customDomain: true,
    leadExport: true,
    removeBranding: false,
    embed: true,
    outlets: 1,
    languages: null,
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    monthlyExGst: 2499,
    setupExGst: 0,
    credits: 220,
    styleLimit: null,
    customDomain: true,
    leadExport: true,
    removeBranding: true,
    embed: true,
    outlets: 3,
    languages: null,
  },
};

export const CREDIT_PACKS = [
  { id: "pack25", credits: 25, priceExGst: 299 },
  { id: "pack60", credits: 60, priceExGst: 649 },
  { id: "pack150", credits: 150, priceExGst: 1499 },
] as const;

/** One try-on spends one credit. There is no HD double charge. */
export const STANDARD_CREDIT_COST = 1;
export const TRIAL_DAYS = 14;
/** A new salon receives this many try-ons, not the plan's monthly allowance. */
export const TRIAL_TRYONS = 20;
/** Super-admin filter: try-ons left at or below this number. */
export const LOW_TRYONS = 10;
export const GST_RATE = 0.18;

export function isPlanId(value: string): value is PlanId {
  if (value === "BASIC") return false;
  return value === "LITE" || value === "STARTER" || value === "PRO";
}

export function planById(id: string): PlanDef {
  if (id === "BASIC") return PLANS.LITE;
  if (id === "STANDARD") return PLANS.STARTER;
  if (isPlanId(id)) return PLANS[id];
  if (id === "CHAIN") return PLANS.PRO;
  return PLANS.LITE;
}
