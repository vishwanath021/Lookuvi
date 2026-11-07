import { NextResponse } from "next/server";
import { z } from "zod";
import { askMoreTries, atSalonView } from "@/lib/at-salon";
import { deskUserId } from "@/lib/at-salon-gate";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const postSchema = z.object({
  action: z.literal("ask"),
  slug: z.string().min(1).max(80),
  sessionId: z.string().min(8).max(80),
  deviceId: z.string().max(80).optional(),
});

async function tenantBySlug(slug: string) {
  return prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, tryOnsAtSalon: true, visitTryLimit: true, deletedAt: true },
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || "";
  const sessionId = url.searchParams.get("sessionId") || "";
  const deviceId = url.searchParams.get("deviceId") || "";
  if (!slug || sessionId.length < 8) return NextResponse.json({ error: "INVALID" }, { status: 400 });
  const tenant = await tenantBySlug(slug);
  if (!tenant || tenant.deletedAt) return NextResponse.json({ error: "TENANT" }, { status: 404 });
  const bypass = Boolean(await deskUserId(tenant.id));
  const view = await atSalonView({ tenant, sessionId, deviceId, bypass });
  return NextResponse.json(view);
}

export async function POST(req: Request) {
  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID", message: "That update was not understood." }, { status: 400 });
  const body = parsed.data;
  const tenant = await tenantBySlug(body.slug);
  if (!tenant || tenant.deletedAt) return NextResponse.json({ error: "TENANT", message: "Salon not found." }, { status: 404 });
  const result = await askMoreTries(tenant.id, body.sessionId, body.deviceId || "");
  if (!result.ok) return NextResponse.json({ error: result.error, message: result.message }, { status: result.status });
  const bypass = Boolean(await deskUserId(tenant.id));
  const view = await atSalonView({ tenant, sessionId: body.sessionId, deviceId: body.deviceId, bypass });
  return NextResponse.json(view);
}
