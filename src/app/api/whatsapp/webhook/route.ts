import { NextResponse } from "next/server";
import { applyStop, salonForInboundStop } from "@/lib/customers/service";
import { tooMany } from "@/lib/http/guard";
import { signatureMatches, stopEventsFromPayload } from "@/lib/whatsapp/inbound";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") || "";
  const expected = process.env.WHATSAPP_VERIFY_TOKEN || "";
  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
}

export async function POST(req: Request) {
  const limited = await tooMany(req, "wa-webhook", 60, 60 * 1000);
  if (limited) return limited;
  const secret = process.env.WHATSAPP_APP_SECRET || "";
  const raw = await req.text();
  if (!signatureMatches(raw, req.headers.get("x-hub-signature-256") || "", secret)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  let body: unknown = {};
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true, stopped: 0 });
  }
  let stopped = 0;
  for (const event of stopEventsFromPayload(body)) {
    if (event.scope === "global") {
      stopped += await applyStop(event.phone, { global: true });
      continue;
    }
    const tenantId = await salonForInboundStop(event.phone);
    if (tenantId) stopped += await applyStop(event.phone, { tenantId });
  }
  return NextResponse.json({ ok: true, stopped });
}
