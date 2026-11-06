import { NextResponse } from "next/server";
import { verifyShareToken } from "@/lib/share-link";
import { getObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Opens a shared look. The link carries a signature and an expiry, not the storage path. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const key = verifyShareToken(token);
  if (!key) {
    return new NextResponse("This look link has expired. Ask for a new one from the salon.", { status: 410, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const body = await getObject(key);
  if (!body) return new NextResponse("This look is no longer available.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  return new NextResponse(new Uint8Array(body), { headers: { "content-type": "image/jpeg", "cache-control": "private, no-store" } });
}
