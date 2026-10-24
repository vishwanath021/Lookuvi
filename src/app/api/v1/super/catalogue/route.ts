import { NextResponse } from "next/server";
import { z } from "zod";
import { STYLES, toPublicStyle } from "@/data/styles";
import { readCatalogOverrides, saveCatalogOverride } from "@/lib/catalog-tags";
import { applySuitability } from "@/lib/hair-suitability";
import { requireSuper } from "@/lib/session";

const tags = z.object({
  styleId: z.string(),
  density: z.array(z.enum(["thin", "medium", "thick"])).min(1).max(2),
  texture: z.array(z.enum(["straight", "wavy", "curly"])).min(1).max(2),
  faceShapes: z.array(z.enum(["oval", "round", "square", "heart", "oblong", "diamond"])).max(6).optional(),
});

export async function GET() {
  const access = await requireSuper();
  if ("error" in access && access.error) return access.error;
  const overrides = await readCatalogOverrides();
  const styles = STYLES.map((style) => {
    const raw = overrides[style.id] ? JSON.stringify(overrides[style.id]) : "";
    const pub = applySuitability(toPublicStyle(style), raw);
    return { id: pub.id, name: pub.name, gender: pub.gender, density: pub.density, texture: pub.texture, faceShapes: pub.faceShapes };
  });
  return NextResponse.json({ styles });
}

export async function PUT(req: Request) {
  const access = await requireSuper();
  if ("error" in access && access.error) return access.error;
  const parsed = tags.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID" }, { status: 400 });
  try {
    await saveCatalogOverride(parsed.data.styleId, {
      density: parsed.data.density,
      texture: parsed.data.texture,
      faceShapes: parsed.data.faceShapes,
    });
  } catch {
    return NextResponse.json({ error: "STYLE" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
