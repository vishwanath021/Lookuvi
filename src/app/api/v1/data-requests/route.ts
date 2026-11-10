import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteGuestLeads, possessesWithdrawSession } from "@/lib/data-request";
import { readGuestToken } from "@/lib/preview-access";
import { prisma } from "@/lib/prisma";
import { isSharedProxyAddress, requestClientIp, sharedRateLimit } from "@/lib/ratelimit";

const HOUR_MS = 60 * 60 * 1000;

function contactKey(slug: string, contact: string) {
  return createHash("sha256").update(`${slug}:${contact.trim().toLowerCase()}`).digest("hex").slice(0, 32);
}

const bodySchema = z.object({
  slug: z.string().min(1),
  kind: z.enum(["withdraw", "delete", "access", "correct", "grievance"]),
  contact: z.string().min(3).max(120),
  sessionId: z.string().max(80).optional().nullable(),
  ref: z.string().max(80).optional().nullable(),
});

export async function POST(req: Request) {
  const ip = requestClientIp(req);
  if (!isSharedProxyAddress(ip)) {
    const byIp = await sharedRateLimit(`data-request:ip:${ip}`, 40, HOUR_MS);
    if (!byIp.ok) {
      return NextResponse.json(
        { error: "RATE", message: "Too many requests from this connection. Wait a few minutes and try again." },
        { status: 429 },
      );
    }
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID" }, { status: 400 });
  const tenant = await prisma.tenant.findUnique({ where: { slug: parsed.data.slug } });
  if (!tenant) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "We could not find that salon. Check the name from your Lookuvi link." },
      { status: 404 },
    );
  }
  const byContact = await sharedRateLimit(`data-request:who:${contactKey(tenant.slug, parsed.data.contact)}`, 8, HOUR_MS);
  if (!byContact.ok) {
    return NextResponse.json(
      { error: "RATE", message: "That phone or email already sent a few requests this hour. Wait and try again, or email support." },
      { status: 429 },
    );
  }
  let withdrew = false;
  let deleted = 0;
  const guest = readGuestToken((await cookies()).get("helix_guest")?.value);
  if (parsed.data.kind === "delete") {
    const result = await deleteGuestLeads({
      tenantId: tenant.id,
      sessionId: parsed.data.sessionId,
      guest,
    });
    deleted = result.deleted;
  }
  if (parsed.data.kind === "withdraw" && parsed.data.sessionId) {
    const allowed = await possessesWithdrawSession({
      tenantId: tenant.id,
      sessionId: parsed.data.sessionId,
      guest,
      ref: parsed.data.ref,
    });
    const consent = allowed
      ? await prisma.consentLog.findFirst({
        where: { tenantId: tenant.id, sessionId: parsed.data.sessionId, accepted: true },
      })
      : null;
    if (consent) {
      await prisma.lead.deleteMany({ where: { tenantId: tenant.id, sessionId: parsed.data.sessionId } });
      withdrew = true;
    }
  }
  const row = await prisma.dataRequest.create({
    data: {
      tenantId: tenant.id,
      kind: parsed.data.kind,
      contact: parsed.data.contact,
      sessionId: parsed.data.sessionId || null,
      status: withdrew || deleted > 0 ? "DONE" : "OPEN",
      note: withdrew
        ? "Session leads removed. Preview files follow the retention schedule."
        : deleted > 0
          ? `Guest deleted ${deleted} lead${deleted === 1 ? "" : "s"} for this salon.`
          : "Awaiting operator.",
    },
  });
  const message = deleted > 0
    ? deleted === 1
      ? "Your booking request for this salon was deleted."
      : `${deleted} booking requests for this salon were deleted.`
    : parsed.data.kind === "delete"
      ? "We could not match a booking request from this browser. The request was recorded and the salon can remove it from Leads."
      : "Request recorded. Generated previews are deleted on the retention schedule. Open requests are handled within 30 days.";
  return NextResponse.json({
    id: row.id,
    status: row.status,
    deleted,
    message,
  });
}
