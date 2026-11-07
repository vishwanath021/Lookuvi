import "@/lib/zod-jitless";
import { z } from "zod";
import { decryptSecret, encryptSecret, keyHint } from "@/lib/crypto/secret";
import { allowByoKey } from "@/lib/ai/credentials";
import { cachedSpendSummary, spendCapInr } from "@/lib/ai/spend";
import { parseTier, tierCatalog, type ImageProviderName, type ModelTier, type TierRequest } from "@/lib/ai/tiers";
import { DEFAULT_GUEST_ENGINE, DEFAULT_GUEST_MODEL, parseGuestEngine, parseGuestModel, type GuestEngine, type GuestModelId } from "@/lib/ai/guest-hairstyle";
import { prisma } from "@/lib/prisma";

const providerSchema = z.enum(["openai", "gemini"]);

export type SalonAiSettings = {
  provider: ImageProviderName;
  hasKey: boolean;
  hint: string;
  allowByo: boolean;
  tier: ModelTier;
  mediumApproved: boolean;
  highEnabled: boolean;
};

export type StoredKeyStatus = { saved: boolean; hint: string };

export type PlatformAiSettings = SalonAiSettings & {
  calibrationOk: boolean;
  choices: Record<ImageProviderName, TierRequest[]>;
  spend: { spentInr: number; capInr: number; calls: number; pending?: boolean };
  openaiKey: StoredKeyStatus;
  geminiKey: StoredKeyStatus;
  falKey: StoredKeyStatus & { enabled: boolean };
  falBillingKey: StoredKeyStatus;
  openRouterKey: StoredKeyStatus & { enabled: boolean };
  guestEngine: GuestEngine;
  guestModel: GuestModelId;
};

/** @deprecated Salon pages use SalonAiSettings. Super pages use PlatformAiSettings. */
export type AiSettingsView = PlatformAiSettings;

async function setting(key: string) {
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  return row?.value ?? "";
}

async function putSetting(key: string, value: string) {
  await prisma.platformSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

export async function tierGate() {
  return {
    highEnabled: (await setting("platform_ai_high_enabled")) === "true",
    mediumApproved: (await setting("platform_ai_medium_approved")) === "true",
    calibrationOk: (await setting("platform_ai_calibration_ok")) === "true",
    platformTier: parseTier(await setting("platform_ai_tier")),
  };
}

export async function readTierFlags(tenantId: string) {
  const gate = await tierGate();
  let stored = gate.platformTier;
  if (tenantId && tenantId !== "platform" && tenantId !== "calibration" && tenantId !== "ai-smoke") {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { aiTier: true } });
    if (tenant?.aiTier) stored = parseTier(tenant.aiTier);
  }
  return { stored, highEnabled: gate.highEnabled, mediumApproved: gate.mediumApproved };
}

/** The old single slot, classified so an OpenAI key is not shown as a Gemini key. */
async function legacyKeyStatus(): Promise<{ kind: "openai" | "gemini" | ""; hint: string }> {
  const cipher = await setting("platform_ai_key_cipher");
  if (!cipher) return { kind: "", hint: "" };
  const hint = await setting("platform_ai_key_hint");
  try {
    const plain = decryptSecret(cipher);
    if (plain.startsWith("sk-")) return { kind: "openai", hint };
    if (plain.startsWith("AIza")) return { kind: "gemini", hint };
  } catch {
    return { kind: "", hint };
  }
  const provider = await setting("platform_ai_provider");
  if (provider === "openai" || provider === "gemini") return { kind: provider, hint };
  return { kind: "", hint };
}

const PLATFORM_VIEW_KEYS = [
  "platform_ai_provider",
  "platform_ai_key_cipher",
  "platform_ai_key_hint",
  "platform_ai_high_enabled",
  "platform_ai_medium_approved",
  "platform_ai_calibration_ok",
  "platform_ai_tier",
  "platform_fal_key_cipher",
  "platform_fal_key_hint",
  "platform_fal_enabled",
  "platform_openai_key_cipher",
  "platform_openai_key_hint",
  "platform_gemini_key_cipher",
  "platform_gemini_key_hint",
  "platform_fal_billing_key_cipher",
  "platform_fal_billing_key_hint",
  "platform_openrouter_key_cipher",
  "platform_openrouter_key_hint",
  "platform_openrouter_enabled",
  "guest_hairstyle_engine",
  "guest_hairstyle_model",
  "allow_byo_key",
] as const;

async function platformMap() {
  const rows = await prisma.platformSetting.findMany({ where: { key: { in: [...PLATFORM_VIEW_KEYS] } } });
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return (key: string) => map.get(key) ?? "";
}

function statusFrom(read: (key: string) => string, cipherKey: string, hintKey: string): StoredKeyStatus {
  const cipher = read(cipherKey);
  return { saved: Boolean(cipher), hint: cipher ? read(hintKey) : "" };
}

/**
 * Settings for the AI screen. One settings read, then the month spend.
 * `spend: "skip"` lets the page paint before the spend aggregate. The form loads that next.
 * Provider key tests stay on the Test button. This function does not call OpenAI or fal.
 */
export async function platformAiView(options?: { spend?: "cached" | "skip" }): Promise<PlatformAiSettings> {
  const read = await platformMap();
  const provider = providerSchema.safeParse(read("platform_ai_provider"));
  const active = provider.success ? provider.data : "openai";
  const legacyCipher = read("platform_ai_key_cipher");
  let legacyKind: "openai" | "gemini" | "" = "";
  let legacyHint = "";
  if (legacyCipher) {
    legacyHint = read("platform_ai_key_hint");
    try {
      const plain = decryptSecret(legacyCipher);
      if (plain.startsWith("sk-")) legacyKind = "openai";
      else if (plain.startsWith("AIza")) legacyKind = "gemini";
    } catch {
      legacyKind = "";
    }
    if (!legacyKind && (read("platform_ai_provider") === "openai" || read("platform_ai_provider") === "gemini")) {
      legacyKind = read("platform_ai_provider") as "openai" | "gemini";
    }
  }
  const openaiDedicated = statusFrom(read, "platform_openai_key_cipher", "platform_openai_key_hint");
  const geminiDedicated = statusFrom(read, "platform_gemini_key_cipher", "platform_gemini_key_hint");
  const openaiKey = openaiDedicated.saved ? openaiDedicated : legacyKind === "openai" ? { saved: true, hint: legacyHint } : openaiDedicated;
  const geminiKey = geminiDedicated.saved ? geminiDedicated : legacyKind === "gemini" ? { saved: true, hint: legacyHint } : geminiDedicated;
  const activeStatus = active === "openai" ? openaiKey : geminiKey;
  const fal = statusFrom(read, "platform_fal_key_cipher", "platform_fal_key_hint");
  const openRouter = statusFrom(read, "platform_openrouter_key_cipher", "platform_openrouter_key_hint");
  const guestEngineSetting = read("guest_hairstyle_engine");
  const spend = options?.spend === "skip"
    ? { spentInr: 0, capInr: spendCapInr(), calls: 0, pending: true as const }
    : { ...(await cachedSpendSummary()), pending: false as const };
  return {
    provider: active,
    hasKey: activeStatus.saved || Boolean(legacyCipher),
    hint: activeStatus.hint || read("platform_ai_key_hint"),
    allowByo: read("allow_byo_key") !== "false",
    tier: parseTier(read("platform_ai_tier")),
    mediumApproved: read("platform_ai_medium_approved") === "true",
    highEnabled: read("platform_ai_high_enabled") === "true",
    calibrationOk: read("platform_ai_calibration_ok") === "true",
    choices: { openai: tierCatalog("openai"), gemini: tierCatalog("gemini") },
    spend,
    openaiKey,
    geminiKey,
    falKey: { ...fal, enabled: fal.saved && read("platform_fal_enabled") === "true" },
    falBillingKey: statusFrom(read, "platform_fal_billing_key_cipher", "platform_fal_billing_key_hint"),
    openRouterKey: {
      ...openRouter,
      enabled: Boolean(read("platform_openrouter_key_cipher")) && read("platform_openrouter_enabled") === "true",
    },
    guestEngine: parseGuestEngine(guestEngineSetting) || DEFAULT_GUEST_ENGINE,
    guestModel: parseGuestModel(read("guest_hairstyle_model"))
      || (guestEngineSetting === "fal" ? "blackforestlabs/flux-3/edit-image" : DEFAULT_GUEST_MODEL),
  };
}

export async function salonAiView(tenantId: string): Promise<SalonAiSettings> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { aiProvider: true, aiKeyCipher: true, aiKeyHint: true, aiTier: true },
  });
  const provider = providerSchema.safeParse(tenant?.aiProvider);
  const gate = await tierGate();
  return {
    provider: provider.success ? provider.data : "openai",
    hasKey: Boolean(tenant?.aiKeyCipher),
    hint: tenant?.aiKeyHint || "",
    allowByo: await allowByoKey(),
    tier: tenant?.aiTier ? parseTier(tenant.aiTier) : "test",
    mediumApproved: gate.mediumApproved,
    highEnabled: gate.highEnabled,
  };
}

function freshKey(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("•")) return null;
  if (!/^[A-Za-z0-9_\-.]{12,300}$/.test(trimmed)) {
    throw new Error("INVALID_KEY");
  }
  return trimmed;
}

function freshFalKey(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("•")) return null;
  if (!/^[A-Za-z0-9_\-.:]{12,400}$/.test(trimmed)) throw new Error("INVALID_KEY");
  return trimmed;
}

function freshOpenRouterKey(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("•")) return null;
  if (!/^[A-Za-z0-9_\-.]{12,400}$/.test(trimmed)) throw new Error("INVALID_KEY");
  return trimmed;
}

async function migrateLegacySlot() {
  const legacy = await legacyKeyStatus();
  if (!legacy.kind) return;
  const cipherKey = legacy.kind === "openai" ? "platform_openai_key_cipher" : "platform_gemini_key_cipher";
  const hintKey = legacy.kind === "openai" ? "platform_openai_key_hint" : "platform_gemini_key_hint";
  if (await setting(cipherKey)) return;
  const cipher = await setting("platform_ai_key_cipher");
  if (!cipher) return;
  await putSetting(cipherKey, cipher);
  await putSetting(hintKey, legacy.hint);
}

export async function saveFalKey(
  input: { apiKey: string; enabled: boolean; remove: boolean },
  actorId: string,
) {
  if (input.remove) {
    await putSetting("platform_fal_key_cipher", "");
    await putSetting("platform_fal_key_hint", "");
    await putSetting("platform_fal_enabled", "false");
  } else {
    const next = freshFalKey(input.apiKey);
    if (next) {
      await putSetting("platform_fal_key_cipher", encryptSecret(next));
      await putSetting("platform_fal_key_hint", keyHint(next));
    } else if (!(await setting("platform_fal_key_cipher")) && input.apiKey.trim()) {
      throw new Error("INVALID_KEY");
    }
    const saved = Boolean(await setting("platform_fal_key_cipher"));
    await putSetting("platform_fal_enabled", saved && input.enabled ? "true" : "false");
  }
  await prisma.auditLog.create({
    data: {
      actorId,
      action: "AI_KEY_UPDATE",
      target: "platform",
      meta: JSON.stringify({ provider: "fal", rotated: Boolean(input.apiKey.trim()), removed: input.remove, enabled: input.enabled }),
    },
  });
}

export async function saveFalBillingKey(input: { apiKey: string; remove: boolean }, actorId: string) {
  if (input.remove) {
    await putSetting("platform_fal_billing_key_cipher", "");
    await putSetting("platform_fal_billing_key_hint", "");
  } else {
    const next = freshFalKey(input.apiKey);
    if (next) {
      await putSetting("platform_fal_billing_key_cipher", encryptSecret(next));
      await putSetting("platform_fal_billing_key_hint", keyHint(next));
    } else if (!(await setting("platform_fal_billing_key_cipher")) && input.apiKey.trim()) {
      throw new Error("INVALID_KEY");
    }
  }
  await prisma.auditLog.create({
    data: {
      actorId,
      action: "AI_KEY_UPDATE",
      target: "platform",
      meta: JSON.stringify({ provider: "fal-billing", rotated: Boolean(input.apiKey.trim()), removed: input.remove }),
    },
  });
}

export async function saveOpenRouterKey(
  input: { apiKey: string; enabled: boolean; remove: boolean },
  actorId: string,
) {
  if (input.remove) {
    await putSetting("platform_openrouter_key_cipher", "");
    await putSetting("platform_openrouter_key_hint", "");
    await putSetting("platform_openrouter_enabled", "false");
  } else {
    const next = freshOpenRouterKey(input.apiKey);
    if (next) {
      await putSetting("platform_openrouter_key_cipher", encryptSecret(next));
      await putSetting("platform_openrouter_key_hint", keyHint(next));
    } else if (!(await setting("platform_openrouter_key_cipher")) && input.apiKey.trim()) {
      throw new Error("INVALID_KEY");
    }
    const saved = Boolean(await setting("platform_openrouter_key_cipher"));
    await putSetting("platform_openrouter_enabled", saved && input.enabled ? "true" : "false");
  }
  await prisma.auditLog.create({
    data: {
      actorId,
      action: "AI_KEY_UPDATE",
      target: "platform",
      meta: JSON.stringify({ provider: "openrouter", rotated: Boolean(input.apiKey.trim()), removed: input.remove, enabled: input.enabled }),
    },
  });
}

export async function savePlatformAi(
  input: { provider: "openai" | "gemini"; apiKey: string; allowByo: boolean; tier: ModelTier; highEnabled: boolean },
  actorId: string,
) {
  await migrateLegacySlot();
  const next = freshKey(input.apiKey);
  const gate = await tierGate();
  await putSetting("platform_ai_provider", input.provider);
  await putSetting("allow_byo_key", input.allowByo ? "true" : "false");
  await putSetting("platform_ai_high_enabled", input.highEnabled ? "true" : "false");
  const cipherKey = input.provider === "openai" ? "platform_openai_key_cipher" : "platform_gemini_key_cipher";
  const hintKey = input.provider === "openai" ? "platform_openai_key_hint" : "platform_gemini_key_hint";
  if (next) {
    const cipher = encryptSecret(next);
    const hint = keyHint(next);
    await putSetting(cipherKey, cipher);
    await putSetting(hintKey, hint);
    await putSetting("platform_ai_key_cipher", cipher);
    await putSetting("platform_ai_key_hint", hint);
    await putSetting("platform_ai_tier", "test");
    await putSetting("platform_ai_medium_approved", "false");
    await putSetting("platform_ai_calibration_ok", "false");
  } else {
    let tier = input.tier;
    if (tier === "high" && !input.highEnabled) tier = "test";
    if (tier === "medium" && !gate.mediumApproved) tier = "test";
    await putSetting("platform_ai_tier", tier);
    const kept = await setting(cipherKey);
    if (kept) {
      await putSetting("platform_ai_key_cipher", kept);
      await putSetting("platform_ai_key_hint", await setting(hintKey));
    } else {
      await putSetting("platform_ai_key_cipher", "");
      await putSetting("platform_ai_key_hint", "");
    }
  }
  await prisma.auditLog.create({
    data: {
      actorId,
      action: "AI_KEY_UPDATE",
      target: "platform",
      meta: JSON.stringify({ provider: input.provider, rotated: Boolean(next), allowByo: input.allowByo }),
    },
  });
}

export async function saveSalonAi(
  tenantId: string,
  input: { provider: "openai" | "gemini"; apiKey: string; tier: ModelTier },
  actorId: string,
) {
  const gate = await tierGate();
  const next = freshKey(input.apiKey);
  const current = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { aiKeyCipher: true } });
  const byo = await allowByoKey();
  if (!byo && next) throw new Error("BYO_OFF");
  if (byo && !next && !current?.aiKeyCipher && input.apiKey.trim()) throw new Error("INVALID_KEY");
  let tier: ModelTier = next ? "test" : input.tier;
  if (tier === "high" && !gate.highEnabled) tier = "test";
  if (tier === "medium" && !gate.mediumApproved) tier = "test";
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      aiTier: tier,
      ...(byo ? { aiProvider: input.provider, ...(next ? { aiKeyCipher: encryptSecret(next), aiKeyHint: keyHint(next) } : {}) } : {}),
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId,
      action: "AI_KEY_UPDATE",
      target: tenantId,
      meta: JSON.stringify({ provider: input.provider, rotated: Boolean(next), scope: "salon" }),
    },
  });
}

export async function storedKey(scope: "platform" | { tenantId: string }) {
  if (scope === "platform") {
    const cipher = await setting("platform_ai_key_cipher");
    const provider = providerSchema.safeParse(await setting("platform_ai_provider"));
    if (!cipher || !provider.success) return null;
    return { provider: provider.data, apiKey: decryptSecret(cipher) };
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: scope.tenantId },
    select: { aiProvider: true, aiKeyCipher: true },
  });
  const provider = providerSchema.safeParse(tenant?.aiProvider);
  if (!tenant?.aiKeyCipher || !provider.success) return null;
  return { provider: provider.data, apiKey: decryptSecret(tenant.aiKeyCipher) };
}

export async function approveMediumQuality() {
  if ((await setting("platform_ai_calibration_ok")) !== "true") throw new Error("CALIBRATION_REQUIRED");
  await putSetting("platform_ai_medium_approved", "true");
}

export async function markCalibration(ok: boolean) {
  await putSetting("platform_ai_calibration_ok", ok ? "true" : "false");
}

export async function storedFalKey() {
  const cipher = await setting("platform_fal_key_cipher");
  if (!cipher) return "";
  try {
    return decryptSecret(cipher);
  } catch {
    return "";
  }
}

/** Auth check only. This does not call an image model and does not charge the spend cap. */
export async function testFalKey(apiKey: string) {
  try {
    const response = await fetch("https://api.fal.ai/v1/models?limit=1", {
      headers: { authorization: `Key ${apiKey}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return { ok: false as const, message: "fal rejected that key." };
    return { ok: true as const, message: "Connected." };
  } catch {
    return { ok: false as const, message: "Could not reach fal." };
  }
}

/** Auth check only. This does not call an image model and does not charge the spend cap. */
export async function testProviderKey(provider: "openai" | "gemini", apiKey: string) {
  try {
    const response = provider === "openai"
      ? await fetch("https://api.openai.com/v1/models", {
          headers: { authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(12_000),
        })
      : await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", {
          headers: { "x-goog-api-key": apiKey },
          signal: AbortSignal.timeout(12_000),
        });
    if (!response.ok) return { ok: false as const, message: "The provider rejected that key." };
    return { ok: true as const, message: "Connected." };
  } catch {
    return { ok: false as const, message: "Could not reach the provider." };
  }
}
