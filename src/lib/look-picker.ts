/** How many looks to show before "Show more". */
export const LOOK_PAGE = 12;

const TRENDING = new Set([
  "wolf-cut",
  "butterfly-layers",
  "curtain-bangs",
  "soft-bob",
  "beach-waves",
  "mid-fade",
  "french-bob",
  "korean-two-block",
  "textured-crop",
  "soft-waves",
]);

export const LOOK_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "short", label: "Short" },
  { id: "medium", label: "Medium" },
  { id: "long", label: "Long" },
  { id: "curly", label: "Curly" },
  { id: "trending", label: "Trending" },
  { id: "saved", label: "Saved" },
] as const;

export function lookTagsForStyle(
  style: { id: string; name: string; lengthCategory?: string; texture?: string[]; referenceTexture?: string },
  saved: boolean,
) {
  const tags = new Set<string>();
  if (style.lengthCategory) tags.add(style.lengthCategory);
  if (style.texture?.includes("curly") || style.referenceTexture === "curly" || /curl/i.test(style.name)) tags.add("curly");
  if (TRENDING.has(style.id)) tags.add("trending");
  if (saved) tags.add("saved");
  return [...tags];
}

export function filterLooks<T extends { name: string; tags: string[] }>(items: T[], category: string, query: string) {
  const needle = query.trim().toLowerCase();
  return items.filter((item) => {
    if (category !== "all" && !item.tags.includes(category)) return false;
    if (needle && !item.name.toLowerCase().includes(needle)) return false;
    return true;
  });
}
