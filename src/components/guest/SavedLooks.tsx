"use client";

import { useEffect, useState } from "react";
import { SavedMarks } from "@/components/tryon/SavedMarks";
import { StyleCard } from "@/components/tryon/StyleCard";
import { BrowCard } from "@/components/tryon/BrowCard";
import { SHADES } from "@/data/shades";
import { t } from "@/data/i18n";
import { addSavedPick, readSavedPicks, savedPicksKey, type SavedPick } from "@/lib/at-salon-browse";

type BridalSaved = {
  id: string;
  name: string;
  after: string;
  lookId?: string;
  kind?: string;
};

function bridalKey(slug: string) {
  return `lookuvi-bridal-${slug}`;
}

function readBridal(slug: string): BridalSaved[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(bridalKey(slug)) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as BridalSaved;
      if (!row.id || !row.name || !row.after) return [];
      return [{ id: String(row.id), name: String(row.name), after: String(row.after), lookId: row.lookId, kind: row.kind }];
    });
  } catch {
    return [];
  }
}

function writeBridal(slug: string, looks: BridalSaved[]) {
  const raw = localStorage.getItem(bridalKey(slug));
  let parsed: unknown[] = [];
  try {
    const value = raw ? JSON.parse(raw) as unknown : [];
    parsed = Array.isArray(value) ? value : [];
  } catch {
    parsed = [];
  }
  const keep = new Set(looks.map((item) => item.id));
  const next = parsed.filter((item) => item && typeof item === "object" && keep.has(String((item as BridalSaved).id)));
  localStorage.setItem(bridalKey(slug), JSON.stringify(next));
}

function PickPhoto({ pick }: { pick: SavedPick }) {
  if (pick.tool === "colour") {
    const shade = SHADES.find((item) => item.id === pick.id);
    return <span className="block aspect-square w-full" style={{ background: shade?.hex || "#ccc" }} />;
  }
  if (pick.tool === "brows") return <BrowCard id={pick.id} name={pick.name} />;
  const folder = pick.tool === "beard" ? "beards" : pick.tool === "nails" ? "nails" : "styles";
  return <StyleCard id={pick.id} name={pick.name} folder={folder} />;
}

export function SavedLooks({ slug, lang }: { slug: string; lang: string }) {
  const [picks, setPicks] = useState<SavedPick[]>([]);
  const [bridal, setBridal] = useState<BridalSaved[]>([]);
  const [droppedPicks, setDroppedPicks] = useState<SavedPick[]>([]);
  const [droppedBridal, setDroppedBridal] = useState<BridalSaved[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPicks(readSavedPicks(localStorage.getItem(savedPicksKey(slug))));
    setBridal(readBridal(slug));
    setReady(true);
  }, [slug]);

  function storePicks(next: SavedPick[]) {
    setPicks(next);
    localStorage.setItem(savedPicksKey(slug), JSON.stringify(next));
  }

  function dropPick(pick: SavedPick) {
    setDroppedPicks((current) => [pick, ...current.filter((item) => !(item.tool === pick.tool && item.id === pick.id))]);
    storePicks(picks.filter((item) => !(item.tool === pick.tool && item.id === pick.id)));
  }

  function keepPick(pick: SavedPick) {
    setDroppedPicks((current) => current.filter((item) => !(item.tool === pick.tool && item.id === pick.id)));
    storePicks(addSavedPick(picks, pick));
  }

  function dropBridal(look: BridalSaved) {
    const next = bridal.filter((item) => item.id !== look.id);
    setBridal(next);
    writeBridal(slug, next);
    setDroppedBridal((current) => [look, ...current.filter((item) => item.id !== look.id)]);
  }

  function keepBridal(look: BridalSaved) {
    const raw = localStorage.getItem(bridalKey(slug));
    let parsed: unknown[] = [];
    try {
      const value = raw ? JSON.parse(raw) as unknown : [];
      parsed = Array.isArray(value) ? value : [];
    } catch {
      parsed = [];
    }
    if (!parsed.some((item) => item && typeof item === "object" && String((item as BridalSaved).id) === look.id)) {
      parsed = [look, ...parsed];
      localStorage.setItem(bridalKey(slug), JSON.stringify(parsed));
    }
    setBridal(readBridal(slug));
    setDroppedBridal((current) => current.filter((item) => item.id !== look.id));
  }

  const cards = [
    ...picks.map((pick) => ({ key: `pick:${pick.tool}:${pick.id}`, name: pick.name, removed: false, photo: <PickPhoto pick={pick} />, onKeep: () => keepPick(pick), onDrop: () => dropPick(pick) })),
    ...droppedPicks.filter((pick) => !picks.some((item) => item.tool === pick.tool && item.id === pick.id)).map((pick) => ({
      key: `drop:${pick.tool}:${pick.id}`,
      name: pick.name,
      removed: true,
      photo: <PickPhoto pick={pick} />,
      onKeep: () => keepPick(pick),
      onDrop: () => dropPick(pick),
    })),
    ...bridal.map((look) => ({ key: `bridal:${look.id}`, name: look.name, removed: false, photo: <img src={look.after} alt="" className="aspect-[3/4] w-full object-cover" />, onKeep: () => keepBridal(look), onDrop: () => dropBridal(look) })),
    ...droppedBridal.filter((look) => !bridal.some((item) => item.id === look.id)).map((look) => ({
      key: `bridal-drop:${look.id}`,
      name: look.name,
      removed: true,
      photo: <img src={look.after} alt="" className="aspect-[3/4] w-full object-cover" />,
      onKeep: () => keepBridal(look),
      onDrop: () => dropBridal(look),
    })),
  ];

  return (
    <div data-ready={ready ? "yes" : "no"} data-saved-page="yes">
      <h1 className="page-title">{t(lang, "navSaved")}</h1>
      {cards.length === 0 ? <p className="mt-3 text-sm text-muted">{t(lang, "savedEmpty")}</p> : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((card) => (
            <li key={card.key} className={`relative overflow-hidden rounded-[14px] border border-line bg-white ${card.removed ? "is-removed" : ""}`}>
              {card.photo}
              <SavedMarks removed={card.removed} keepLabel={t(lang, "saveThisLook")} dropLabel={t(lang, "removeLook")} onKeep={card.onKeep} onDrop={card.onDrop} />
              <p className="px-2 py-2 text-center text-sm font-medium leading-tight">{card.name}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
