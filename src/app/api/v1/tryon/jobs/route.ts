import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Guest poll for one preview. The request id is the secret. The body is the guest-safe sentence already stored on the job. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || "";
  const requestId = url.searchParams.get("requestId") || "";
  if (!slug || !/^[A-Za-z0-9_-]{8,80}$/.test(requestId)) {
    return NextResponse.json({ error: "INVALID" }, { status: 400 });
  }
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return NextResponse.json({ error: "TENANT" }, { status: 404 });
  const job = await prisma.generationJob.findUnique({
    where: { tenantId_requestId: { tenantId: tenant.id, requestId } },
    select: { status: true, outcome: true, message: true },
  });
  if (!job) return NextResponse.json({ status: "MISSING" }, { status: 404 });
  const reveal = job.status === "FAILED" || job.status === "UNCERTAIN";
  return NextResponse.json({
    status: job.status,
    outcome: reveal ? job.outcome : "",
    message: reveal ? job.message : "",
  });
}
