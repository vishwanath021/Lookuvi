import { NextResponse } from "next/server";
import { z } from "zod";
import { planById } from "@/data/plans";
import { isLocale, LOCALES } from "@/data/i18n";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";
import { isAllowedLogoUrl } from "@/lib/logo-url";
import { hoursWrite } from "@/lib/queue/schedule";
import { LoyaltyError, replaceRewards } from "@/lib/loyalty";
import { toolEnabled, type ToolId } from "@/lib/tools";
import { cleanReminderTemplate, MAX_REMINDER_DAYS, MIN_REMINDER_DAYS } from "@/lib/visit-reminders";

const schema = z.object({
  name: z.string().min(2).max(80).optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  whatsapp: z.string().max(20).optional(),
  address: z.string().max(200).optional(),
  mapsUrl: z.string().max(300).optional(),
  city: z.string().max(80).optional(),
  languages: z.array(z.string()).optional(),
  defaultLang: z.string().optional(),
  logoUrl: z
    .string()
    .max(200_000)
    .nullable()
    .optional()
    .refine((value) => value === undefined || isAllowedLogoUrl(value), { error: "LOGO_URL" }),
  removeBranding: z.boolean().optional(),
  onboardingDone: z.boolean().optional(),
  showMen: z.boolean().optional(),
  showWomen: z.boolean().optional(),
  showKids: z.boolean().optional(),
  toolColour: z.boolean().optional(),
  toolStyle: z.boolean().optional(),
  toolBrows: z.boolean().optional(),
  toolBeard: z.boolean().optional(),
  toolNails: z.boolean().optional(),
  hairPickerOn: z.boolean().optional(),
  hairSuggestOn: z.boolean().optional(),
  hairSuggestUsesCredits: z.boolean().optional(),
  requireLoginToBook: z.boolean().optional(),
  tryOnsAtSalon: z.boolean().optional(),
  whatsappAlmostOn: z.boolean().optional(),
  whatsappWalkInJoined: z.boolean().optional(),
  gstin: z.string().max(20).optional().nullable(),
  openTime: z.string().max(8).optional(),
  closeTime: z.string().max(8).optional(),
  weeklyHours: z.string().max(4000).optional(),
  loyaltyOn: z.boolean().optional(),
  loyaltyPointsPerVisit: z.number().int().min(0).max(50).optional(),
  rewards: z.array(z.object({ name: z.string().max(60), cost: z.number().int().min(1).max(9999) })).max(5).optional(),
  reminderDays: z.number().int().optional(),
  reminderTemplate: z.string().max(2000).optional(),
  reminderMethod: z.enum(["MANUAL", "AUTO"]).optional(),
});

export async function GET() {
  const access = await requireOwner();
  if ("error" in access && access.error) return access.error;
  if (!("tenant" in access)) return NextResponse.json({ error: "OWNER_ONLY" }, { status: 403 });
  const { aiKeyCipher: storedCipher, ...tenant } = access.tenant;
  void storedCipher;
  return NextResponse.json({ tenant, role: access.membership.role });
}

export async function PUT(req: Request) {
  const access = await requireOwner();
  if ("error" in access && access.error) return access.error;
  if (!("tenant" in access)) return NextResponse.json({ error: "OWNER_ONLY" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID" }, { status: 400 });
  const plan = planById(access.tenant.plan);
  const data = parsed.data;
  if (data.removeBranding && !plan.removeBranding) {
    return NextResponse.json({ error: "PLAN", message: "Removing the Lookuvi mark needs Pro or Chain." }, { status: 403 });
  }
  const languages = data.languages?.filter(isLocale);
  const { defaultLang, logoUrl, rewards, reminderDays, reminderTemplate, reminderMethod, ...rest } = data;
  if (reminderMethod === "AUTO") {
    return NextResponse.json({ error: "REMINDER", message: "Automatic sending is not available yet." }, { status: 400 });
  }
  const reminderPatch: { reminderDays?: number; reminderTemplate?: string; reminderMethod?: "MANUAL" } = {};
  if (reminderMethod === "MANUAL") reminderPatch.reminderMethod = "MANUAL";
  if (reminderDays !== undefined) {
    if (!Number.isInteger(reminderDays) || reminderDays < MIN_REMINDER_DAYS || reminderDays > MAX_REMINDER_DAYS) {
      return NextResponse.json({ error: "REMINDER", message: "Use a whole number of days from 28 to 42." }, { status: 400 });
    }
    reminderPatch.reminderDays = reminderDays;
  }
  if (reminderTemplate !== undefined) {
    const cleaned = cleanReminderTemplate(reminderTemplate);
    if (!cleaned.ok) return NextResponse.json({ error: "REMINDER", message: cleaned.message }, { status: 400 });
    reminderPatch.reminderTemplate = cleaned.text;
  }
  delete rest.languages;
  const gated: Record<string, ToolId> = {
    toolStyle: "hairstyle",
    toolColour: "colour",
    toolBrows: "brows",
    toolBeard: "beard",
    toolNails: "nails",
  };
  for (const [field, id] of Object.entries(gated)) {
    if (!toolEnabled(id)) delete rest[field as keyof typeof rest];
  }
  if (!access.tenant.productTryOn) {
    for (const field of ["toolColour", "toolStyle", "toolBrows", "toolBeard", "toolNails", "hairPickerOn", "hairSuggestOn", "hairSuggestUsesCredits", "requireLoginToBook"] as const) {
      delete rest[field];
    }
  }
  let hoursPatch: { openTime: string; closeTime: string; weeklyHours: string; hoursOverride?: string; hoursOverrideUntil?: null } | undefined;
  if (data.weeklyHours !== undefined || data.openTime !== undefined || data.closeTime !== undefined) {
    const written = hoursWrite({ weeklyHours: data.weeklyHours, openTime: data.openTime, closeTime: data.closeTime });
    if (!written.ok) return NextResponse.json({ error: "HOURS", message: written.message }, { status: 400 });
    const changed = written.weeklyHours !== access.tenant.weeklyHours || written.openTime !== access.tenant.openTime || written.closeTime !== access.tenant.closeTime;
    hoursPatch = {
      openTime: written.openTime,
      closeTime: written.closeTime,
      weeklyHours: written.weeklyHours,
      ...(changed ? { hoursOverride: "", hoursOverrideUntil: null } : {}),
    };
    delete rest.openTime;
    delete rest.closeTime;
    delete rest.weeklyHours;
  }
  if (rewards) {
    try {
      await replaceRewards(access.tenant.id, rewards);
    } catch (error) {
      if (error instanceof LoyaltyError) return NextResponse.json({ error: "LOYALTY", message: error.message }, { status: 400 });
      throw error;
    }
  }
  const tenant = await prisma.tenant.update({
    where: { id: access.tenant.id },
    data: {
      ...rest,
      ...hoursPatch,
      ...reminderPatch,
      languages: languages ? JSON.stringify(languages) : undefined,
      defaultLang: defaultLang && isLocale(defaultLang) ? defaultLang : undefined,
      logoUrl,
    },
  });
  return NextResponse.json({ ok: true, slug: tenant.slug, languages: LOCALES });
}

export async function DELETE() {
  const access = await requireOwner();
  if ("error" in access && access.error) return access.error;
  return NextResponse.json({ error: "NO_DELETE", message: "Ask support to close a salon." }, { status: 405 });
}
