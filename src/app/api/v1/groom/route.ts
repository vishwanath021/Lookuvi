import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { GROOM_MAX_BYTES, GROOM_MODEL, GROOM_OWN_SLOTS, GROOM_QUALITY } from "@/data/groom";
import { generateGroom, GroomError, type GroomQuote } from "@/lib/groom";
import { resolveOpenAIKey } from "@/lib/ai/credentials";
import { BilledProviderError, UnbilledProviderError, UncertainBillingError, UnknownModelError } from "@/lib/ai/errors";
import { postImageEdit } from "@/lib/ai/openai";
import { beginPaidCall, finalizePaidCall, releasePaidCall } from "@/lib/ai/spend";
import { costUsdFromUsage, type UsageNumbers } from "@/lib/ai/tiers";
import { guestPreviewHeaders } from "@/lib/ai/guest-response";
import { CreditError, reserveCredits, settleCredits } from "@/lib/credits";
import { ImageError, sanitizeSelfie } from "@/lib/images";
import { logProviderCall } from "@/lib/logger";
import { ensurePhotoConsent } from "@/lib/photo-consent";
import { AI_PREVIEW_KINDS, actorKeyFor, capForTier, hashIp, readGuestToken, verifySalonToken, type PreviewTier } from "@/lib/preview-access";
import { prisma } from "@/lib/prisma";
import { requestClientIp } from "@/lib/ratelimit";
import { deleteObject, putObject } from "@/lib/storage";
import { auth } from "@/auth";
import { consumePreviewRateShared, guestLimitMessage } from "@/lib/tools";
import { kolkataDayStart } from "@/lib/queue/day";
import { refuseMonthlyTries } from "@/lib/try-allowance";
import { isPhotoId, loadVisitPhoto, rememberVisitPhoto, refuseVisit, stampVisit } from "@/lib/visit-allowance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function signedInOwnerOrSuper(tenantId: string) {
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

function usageFrom(payload: {
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    input_tokens_details?: { text_tokens?: number; image_tokens?: number };
  };
}): UsageNumbers | undefined {
  const usage = payload.usage;
  if (!usage) return undefined;
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    totalTokens: usage.total_tokens,
    textTokens: usage.input_tokens_details?.text_tokens,
    imageTokens: usage.input_tokens_details?.image_tokens,
  };
}

function failStatus(error: unknown) {
  if (error instanceof ImageError) return error.code === "SIZE" ? 413 : 400;
  if (error instanceof GroomError) return 400;
  if (error instanceof CreditError) return 402;
  if (error instanceof UnknownModelError) return 400;
  if (error instanceof UnbilledProviderError) return 502;
  if (error instanceof UncertainBillingError || error instanceof BilledProviderError) return 502;
  return 500;
}

function failMessage(error: unknown) {
  if (error instanceof GroomError || error instanceof ImageError) {
    if (error instanceof ImageError) {
      return error.code === "SIZE" ? "Please use a photo under 2 MB." : "Use a JPEG, PNG, or WebP photo under 2 MB.";
    }
    return error.message;
  }
  if (error instanceof CreditError) return guestLimitMessage("credits");
  if (error instanceof UncertainBillingError || error instanceof BilledProviderError) {
    return "The preview may have been billed. It was not started again.";
  }
  return "The preview did not finish. It was not started again.";
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "INVALID", message: "Send your selfie." }, { status: 400 });
  const slug = String(form.get("slug") || "");
  const sessionId = String(form.get("sessionId") || "");
  const consentId = String(form.get("consentId") || "");
  const photo = form.get("photo");
  const photoIdIn = String(form.get("photoId") || "");
  const reusePhoto = isPhotoId(photoIdIn);
  if (!slug || sessionId.length < 8 || (!reusePhoto && !(photo instanceof File))) {
    return NextResponse.json({ error: "INVALID", message: "Your selfie and session are required." }, { status: 400 });
  }
  if (photo instanceof File && photo.size > GROOM_MAX_BYTES) {
    return NextResponse.json({ error: "SIZE", message: "Please use a photo under 2 MB." }, { status: 413 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) return NextResponse.json({ error: "TENANT", message: "Salon not found." }, { status: 404 });
  if (tenant.status === "SUSPENDED") {
    return NextResponse.json({ error: "SUSPENDED", message: "This salon's try-on is paused." }, { status: 403 });
  }
  if (!tenant.productGroom) {
    return NextResponse.json({ error: "PRODUCT", message: "Groom is turned off for this salon." }, { status: 404 });
  }

  await ensurePhotoConsent({
    tenantId: tenant.id,
    sessionId,
    consentId,
    userAgent: req.headers.get("user-agent") || "",
  });

  let selfie: Buffer;
  let servedPhotoId = photoIdIn;
  if (reusePhoto) {
    const stored = await loadVisitPhoto(tenant.id, sessionId, photoIdIn);
    if (!stored) return NextResponse.json({ error: "PHOTO", message: "Add the photo again." }, { status: 400 });
    selfie = stored;
  } else {
    try {
      selfie = await sanitizeSelfie(Buffer.from(await (photo as File).arrayBuffer()));
    } catch (error) {
      const code = error instanceof ImageError ? error.code : "DECODE";
      return NextResponse.json({ error: code, message: "Use a JPEG, PNG, or WebP selfie under 2 MB." }, { status: 400 });
    }
    servedPhotoId = await rememberVisitPhoto(tenant.id, sessionId, selfie);
  }
  const blocked = await refuseVisit(tenant.id, sessionId, tenant.visitTryLimit);
  if (blocked) return NextResponse.json(blocked, { status: 429 });

  const items: { id: string; bytes: Buffer }[] = [];
  for (const slot of GROOM_OWN_SLOTS) {
    const file = form.get(slot.id);
    if (!(file instanceof File) || file.size === 0) continue;
    if (file.size > GROOM_MAX_BYTES) {
      return NextResponse.json({ error: "SIZE", message: "Please use a photo under 2 MB." }, { status: 413 });
    }
    items.push({ id: slot.id, bytes: Buffer.from(await file.arrayBuffer()) });
  }

  const ip = requestClientIp(req);
  const staffId = await signedInOwnerOrSuper(tenant.id);
  const usedToday = await prisma.tryOn.count({
    where: { tenantId: tenant.id, kind: { in: [...AI_PREVIEW_KINDS] }, status: "SUCCEEDED", createdAt: { gte: kolkataDayStart() } },
  });
  if (usedToday >= tenant.dailyCap) {
    return NextResponse.json({ error: "DAILY_CAP", message: guestLimitMessage("daily") }, { status: 429 });
  }
  const monthly = await refuseMonthlyTries(tenant.id, tenant.monthlyTryAllowance);
  if (monthly) return NextResponse.json(monthly, { status: 429 });

  const salonToken = String(form.get("salonToken") || "");
  const salonOk = verifySalonToken(salonToken, tenant.id, tenant.salonNonce);
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

  const limited = await consumePreviewRateShared({ tool: "groom", staff: Boolean(staffId), bucket: staffId ? `staff:${staffId}` : ip, tenantId: tenant.id });
  if (!limited.ok) return NextResponse.json({ error: "RATE", message: limited.message }, { status: 429 });

  const apiKey = await resolveOpenAIKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "KEY", message: "Add an OpenAI key on AI settings. This look does not use another model." },
      { status: 503 },
    );
  }

  const requestId = String(form.get("requestId") || crypto.randomUUID());
  const creditRef = `groom:${tenant.id}:${requestId}`;
  let callId = "";
  let reserved = false;
  let quote: GroomQuote | null = null;
  let usage: UsageNumbers | undefined;
  const started = Date.now();
  const hairId = String(form.get("hair") || "");
  const beardId = String(form.get("beard") || "");
  const groomingId = String(form.get("grooming") || "");

  try {
    const result = await generateGroom({
      selfie,
      items,
      hairId,
      beardId,
      groomingId,
      tenantId: tenant.id,
      requestId,
      put: (key, body) => putObject(key, body, "image/jpeg"),
      remove: (key) => deleteObject(key),
      beforeEdit: async (next) => {
        quote = next;
        const gate = await beginPaidCall({
          provider: "openai",
          quality: GROOM_QUALITY,
          model: GROOM_MODEL,
          tenantId: tenant.id,
          tool: items.length ? "groom-own" : "groom",
          imageSize: next.size,
          estimateInr: next.estimateInr,
          estimateUsd: next.estimateUsd,
        });
        if (!gate.ok) throw new GroomError("CAP", "This salon's preview budget is used up.");
        callId = gate.id;
        await reserveCredits(tenant.id, 1, creditRef);
        reserved = true;
      },
      edit: async (body) => {
        const response = await postImageEdit(apiKey, body);
        const payload = (await response.json()) as {
          data?: { b64_json?: string }[];
          usage?: {
            input_tokens?: number;
            output_tokens?: number;
            total_tokens?: number;
            input_tokens_details?: { text_tokens?: number; image_tokens?: number };
          };
        };
        usage = usageFrom(payload);
        const b64 = payload.data?.[0]?.b64_json;
        if (!b64) throw new BilledProviderError(quote?.estimateUsd || 0, usage);
        return Buffer.from(b64, "base64");
      },
    });
    const jpeg = await sharp(result.image, { failOn: "none" }).rotate().jpeg({ quality: 90 }).toBuffer();
    const latencyMs = Date.now() - started;
    const actual = costUsdFromUsage(GROOM_MODEL, usage);
    await finalizePaidCall(callId, {
      model: GROOM_MODEL,
      billed: true,
      charged: true,
      costUsd: actual ?? result.quote.estimateUsd,
      estimateInr: result.quote.estimateInr,
      usage,
      latencyMs,
      imageSize: result.quote.size,
      costSource: actual != null ? "usage" : "estimate",
    });
    logProviderCall({
      provider: "openai",
      model: GROOM_MODEL,
      salonId: tenant.id,
      status: "ok",
      latencyMs,
      costUsd: actual ?? result.quote.estimateUsd,
      requestId,
    });
    const tryOn = await prisma.tryOn.create({
      data: {
        tenantId: tenant.id,
        sessionId,
        styleId: result.styleId || "groom",
        kind: result.own ? "GROOM_OWN" : "GROOM",
        tier,
        actorKey,
        quality: GROOM_QUALITY,
        provider: `openai:${GROOM_MODEL}`,
        status: "SUCCEEDED",
        latencyMs,
        credits: 1,
      },
    });
    await settleCredits(tenant.id, creditRef, "COMMIT");
    const balance = await prisma.tenant.findUnique({ where: { id: tenant.id }, select: { creditBalance: true } });
    const response = new NextResponse(new Uint8Array(jpeg), {
      status: 200,
      headers: guestPreviewHeaders({ tryOnId: tryOn.id, creditsLeft: balance?.creditBalance ?? 0 }),
    });
    await stampVisit(response, tenant.id, sessionId, tenant.visitTryLimit, servedPhotoId);
    return response;
  } catch (error) {
    if (reserved) await settleCredits(tenant.id, creditRef, "REFUND").catch(() => undefined);
    if (callId) {
      const uncertain = error instanceof UncertainBillingError || error instanceof BilledProviderError;
      await releasePaidCall(callId, uncertain ? "UNCERTAIN" : "REFUNDED").catch(() => undefined);
    }
    logProviderCall({
      provider: "openai",
      model: GROOM_MODEL,
      salonId: tenant.id,
      status: "error",
      latencyMs: Date.now() - started,
      costUsd: 0,
      requestId,
    });
    return NextResponse.json({ error: "PREVIEW", message: failMessage(error) }, { status: failStatus(error) });
  }
}
