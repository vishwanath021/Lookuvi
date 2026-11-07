import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { possessesWithdrawSession } from "@/lib/data-request";
import { tooMany } from "@/lib/http/guard";
import { readGuestToken } from "@/lib/preview-access";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  slug: z.string().min(1),
  kind: z.enum(["withdraw", "delete", "access", "correct", "grievance"]),
  contact: z.string().min(3).max(120),
  sessionId: z.string().max(80).optional().nullable(),
  ref: z.string().max(80).optional().nullable(),
});

export async function POST(req: Request) {
  const limited = await tooMany(req, "data-request", 10, 60 * 60 * 1000);
  if (limited) return limited;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID" }, { status: 400 });
  const tenant = await prisma.tenant.findUnique({ where: { slug: parsed.data.slug } });
  if (!tenant) return NextResponse.json({ error: "TENANT" }, { status: 404 });
  let withdrew = false;
  if (parsed.data.kind === "withdraw" && parsed.data.sessionId) {
    const guest = readGuestToken((await cookies()).get("helix_guest")?.value);
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
      status: withdrew ? "DONE" : "OPEN",
      note: withdrew ? "Session leads removed. Preview files follow the retention schedule." : "Awaiting operator.",
    },
  });
  return NextResponse.json({
    id: row.id,
    status: row.status,
    message: "Request recorded. Generated previews are deleted on the retention schedule. Open lead requests are handled within 30 days.",
  });
}
