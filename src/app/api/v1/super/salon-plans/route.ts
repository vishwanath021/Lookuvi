import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuper } from "@/lib/session";

export async function GET() {
  const access = await requireSuper();
  if ("error" in access && access.error) return access.error;
  const plans = await prisma.salonBillingPlan.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ plans });
}

const upsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(80),
  pricePaise: z.number().int().positive(),
  intervalMonths: z.number().int().min(1).max(36),
  active: z.boolean(),
});

export async function POST(req: Request) {
  const access = await requireSuper();
  if ("error" in access && access.error) return access.error;
  const parsed = upsertSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID" }, { status: 400 });
  if (parsed.data.id) {
    const plan = await prisma.salonBillingPlan.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        pricePaise: parsed.data.pricePaise,
        intervalMonths: parsed.data.intervalMonths,
        active: parsed.data.active,
      },
    });
    return NextResponse.json({ plan });
  }
  const plan = await prisma.salonBillingPlan.create({ data: parsed.data });
  return NextResponse.json({ plan });
}