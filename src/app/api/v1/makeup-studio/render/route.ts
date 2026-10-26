import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { claimGenerationJob, failGenerationJob, jobFingerprint } from "@/lib/ai/dedupe";
import { demoGuestPreview, runGuestLookIfReady } from "@/lib/ai/guest-hairstyle";
import { usingDemoProvider } from "@/lib/env";
import { ImageError, sanitizeSelfie } from "@/lib/images";
import { buildMakeupPrompt, clampLook, LIP_SHADES, MAKEUP_STUDIO_KIND, MAKEUP_STUDIO_TOOL, matchingPreset } from "@/lib/makeup-studio/core";
import { LOOK_PRESETS } from "@/lib/makeup-studio/core/presets";
import { ensurePhotoConsent } from "@/lib/photo-consent";
import { AI_PREVIEW_KINDS, actorKeyFor, capForTier, hashIp, readGuestToken, verifySalonToken, type PreviewTier } from "@/lib/preview-access";
import { prisma } from "@/lib/prisma";
import { requestClientIp } from "@/lib/ratelimit";
import { kolkataDayStart } from "@/lib/queue/day";
import { blockedGuestMessage, isBlockedStatus } from "@/lib/salon-status";
import { consumePreviewRateShared, guestLimitMessage, type PreviewTool } from "@/lib/tools";
import { refuseMonthlyTries } from "@/lib/try-allowance";
import { isPhotoId, loadVisitPhoto, rememberVisitPhoto, refuseVisit, stampVisit } from "@/lib/visit-allowance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TOOL = MAKEUP_STUDIO_TOOL as PreviewTool;

async function staffUser(tenantId: string) {
  try {
    const session = await auth();
    const user = session?.user;
    if (!user?.id) return null;
    if (user.isSuperAdmin) return user.id;
    const owner = await prisma.membership.findFirst({
      where: { userId: user.id, tenantId, role: "OWNER" },
      select: { userId: true },
    });
    return owner?.userId ?? null;
  } catch {
    return null;
  }
}

async function lipChip(hex: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${hex}"/></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}

function requestToken() {
  return `mk${randomBytes(12).toString("hex")}`;
}

/**
 * Photoreal still. Reuses the guest image edit: gpt-image, fal fallback,
 * credit reserve and refund, the shared visit budget, and the cost log.
 * AI_PROVIDER=mock, and a missing key, return a labelled sample and do not call a provider.
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "INVALID", message: "Send a photo and a look." }, { status: 400 });
  const slug = String(form.get("slug") || "");
  const sessionId = String(form.get("sessionId") || "");
  const photo = form.get("photo");
  const photoIdIn = String(form.get("photoId") || "");
  const reusePhoto = isPhotoId(photoIdIn);
  let lookRaw: unknown;
  try {
    lookRaw = JSON.parse(String(form.get("look") || ""));
  } catch {
    lookRaw = null;
  }
  if (!slug || sessionId.length < 8 || !lookRaw || typeof lookRaw !== "object") {
    return NextResponse.json({ error: "INVALID", message: "Photo, look, and session are required." }, { status: 400 });
  }
  if (!reusePhoto && !(photo instanceof File)) {
    return NextResponse.json({ error: "INVALID", message: "Photo, look, and session are required." }, { status: 400 });
  }
  if (photo instanceof File && photo.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "SIZE", message: "Please use a photo under 2 MB." }, { status: 413 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) return NextResponse.json({ error: "TENANT", message: "Salon not found." }, { status: 404 });
  if (isBlockedStatus(tenant.status)) {
    return NextResponse.json({ error: "SUSPENDED", message: blockedGuestMessage(tenant.status) }, { status: 403 });
  }
  if (!tenant.productMakeupStudio) {
    return NextResponse.json({ error: "PRODUCT", message: "Makeup studio is turned off for this salon." }, { status: 404 });
  }

  const params = clampLook(lookRaw);
  const presetId = matchingPreset(params);
  const styleId = presetId || "custom";
  const styleName = presetId ? LOOK_PRESETS[presetId].name : "Custom look";

  await ensurePhotoConsent({
    tenantId: tenant.id,
    sessionId,
    consentId: String(form.get("consentId") || ""),
    userAgent: req.headers.get("user-agent") || "",
  });

  const ip = requestClientIp(req);
  const staffId = await staffUser(tenant.id);
  const bucket = staffId ? `staff:${staffId}` : ip;
  const usedToday = await prisma.tryOn.count({
    where: { tenantId: tenant.id, kind: { in: [...AI_PREVIEW_KINDS] }, status: "SUCCEEDED", createdAt: { gte: kolkataDayStart() } },
  });
  if (usedToday >= tenant.dailyCap) {
    return NextResponse.json({ error: "DAILY_CAP", message: guestLimitMessage("daily") }, { status: 429 });
  }
  const monthly = await refuseMonthlyTries(tenant.id, tenant.monthlyTryAllowance);
  if (monthly) return NextResponse.json(monthly, { status: 429 });

  const salonOk = verifySalonToken(String(form.get("salonToken") || ""), tenant.id, tenant.salonNonce);
  const jar = await cookies();
  const guest = readGuestToken(jar.get("helix_guest")?.value);
  const member = guest && guest.tenantId === tenant.id ? guest : null;
  const tier: PreviewTier = salonOk ? "salon" : member ? "member" : "anon";
  const actorKey = actorKeyFor(tier, hashIp(ip), member?.customerId);
  const limit = staffId ? null : capForTier(tier, tenant.anonDailyCap, tenant.memberDailyCap);
  if (limit !== null) {
    const personal = await prisma.tryOn.count({
      where: { tenantId: tenant.id, actorKey, status: "SUCCEEDED", kind: { in: [...AI_PREVIEW_KINDS] }, createdAt: { gte: kolkataDayStart() } },
    });
    if (personal >= limit) {
      return NextResponse.json({ error: "CAP", tier, message: guestLimitMessage(tier === "member" ? "member" : "anon") }, { status: 429 });
    }
  }

  let jpeg: Buffer;
  let servedPhotoId = photoIdIn;
  if (reusePhoto) {
    const stored = await loadVisitPhoto(tenant.id, sessionId, photoIdIn);
    if (!stored) return NextResponse.json({ error: "PHOTO", message: "Add the photo again." }, { status: 400 });
    jpeg = stored;
  } else {
    try {
      jpeg = await sanitizeSelfie(Buffer.from(await (photo as File).arrayBuffer()));
    } catch (error) {
      const code = error instanceof ImageError ? error.code : "DECODE";
      return NextResponse.json({ error: code, message: "Use a JPEG, PNG, or WebP selfie under 2 MB." }, { status: 400 });
    }
    servedPhotoId = await rememberVisitPhoto(tenant.id, sessionId, jpeg);
  }

  const blocked = await refuseVisit(tenant.id, sessionId, tenant.visitTryLimit);
  if (blocked) return NextResponse.json(blocked, { status: 429 });

  const given = String(form.get("requestId") || "");
  const requestId = /^[A-Za-z0-9_-]{8,80}$/.test(given) ? given : requestToken();
  const claim = await claimGenerationJob({
    tenantId: tenant.id,
    requestId,
    fingerprint: jobFingerprint({
      photo: jpeg,
      styleId,
      tool: MAKEUP_STUDIO_TOOL,
      shadeId: [params.lip, params.eyes, params.finish, params.foundation, params.blush, params.intensity, params.gloss ? "1" : "0"].join(":"),
      mode: MAKEUP_STUDIO_TOOL,
    }),
  });
  if (claim.kind === "conflict") return NextResponse.json({ error: "CONFLICT", message: claim.message }, { status: 409 });
  if (claim.kind === "inflight") return NextResponse.json({ error: "IN_FLIGHT", message: claim.message }, { status: 409 });
  if (claim.kind === "repeat") return NextResponse.json({ error: "REPEAT", message: claim.message }, { status: claim.status });
  if (claim.kind === "replay") {
    const replay = new NextResponse(new Uint8Array(claim.image), {
      status: 200,
      headers: { "content-type": "image/jpeg", "cache-control": "no-store", "x-demo-reason": claim.demoReason },
    });
    await stampVisit(replay, tenant.id, sessionId, tenant.visitTryLimit, servedPhotoId);
    return replay;
  }

  const limited = await consumePreviewRateShared({ tool: TOOL, staff: Boolean(staffId), bucket, tenantId: tenant.id });
  if (!limited.ok) {
    await failGenerationJob(claim.id, { outcome: "rate", message: limited.message });
    return NextResponse.json({ error: "RATE", message: limited.message }, { status: 429 });
  }

  const shared = {
    jpeg,
    original: jpeg,
    styleId,
    styleName,
    tenantId: tenant.id,
    sessionId,
    tier,
    actorKey,
    jobId: claim.id,
    requestId,
    tool: MAKEUP_STUDIO_TOOL,
    kind: MAKEUP_STUDIO_KIND,
  };
  let response: NextResponse | null = null;
  if (!usingDemoProvider()) {
    const prompt = buildMakeupPrompt(params);
    const reference = await lipChip(LIP_SHADES[params.lip].hex);
    response = await runGuestLookIfReady({
      ...shared,
      prompt,
      reference,
      referenceFile: "lip-chip.jpg",
    });
  }
  if (!response) response = await demoGuestPreview(shared);
  if (response.status === 200) await stampVisit(response, tenant.id, sessionId, tenant.visitTryLimit, servedPhotoId);
  return response;
}
