import { NextResponse } from "next/server";
import { z } from "zod";
import { storedFalKey, storedKey, testFalKey, testProviderKey } from "@/lib/ai/settings-store";
import { requireSuper } from "@/lib/session";

const schema = z.object({
  provider: z.enum(["openai", "gemini", "fal"]),
  apiKey: z.string().max(400).optional().default(""),
});

export async function POST(req: Request) {
  const access = await requireSuper();
  if ("error" in access && access.error) return access.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID" }, { status: 400 });
  const pasted = parsed.data.apiKey.trim();
  let apiKey = pasted.startsWith("•") || pasted === "" ? "" : pasted;
  if (!apiKey) {
    try {
      if (parsed.data.provider === "fal") apiKey = await storedFalKey();
      else {
        const saved = await storedKey("platform");
        if (saved && saved.provider === parsed.data.provider) apiKey = saved.apiKey;
      }
    } catch {
      apiKey = "";
    }
  }
  if (!apiKey) return NextResponse.json({ ok: false, message: "Paste a key first." }, { status: 400 });
  const result = parsed.data.provider === "fal"
    ? await testFalKey(apiKey)
    : await testProviderKey(parsed.data.provider, apiKey);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
