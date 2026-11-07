import { describe, expect, it } from "vitest";
import { filterLooks, lookTagsForStyle } from "@/lib/look-picker";

describe("look picker", () => {
  it("tags length, curls, trending, and saved styles", () => {
    expect(lookTagsForStyle({ id: "soft-bob", name: "Soft Bob", lengthCategory: "medium", texture: ["straight"] }, false)).toEqual(["medium", "trending"]);
    expect(lookTagsForStyle({ id: "shag", name: "Shag", lengthCategory: "medium", texture: ["curly"] }, true)).toEqual(["medium", "curly", "saved"]);
  });

  it("filters by category and search, and keeps the first page small", () => {
    const items = [
      { name: "Soft Bob", tags: ["medium", "trending"] },
      { name: "Wolf Cut", tags: ["long", "trending"] },
      { name: "Pixie", tags: ["short"] },
    ];
    expect(filterLooks(items, "short", "").map((item) => item.name)).toEqual(["Pixie"]);
    expect(filterLooks(items, "all", "wolf").map((item) => item.name)).toEqual(["Wolf Cut"]);
    expect(filterLooks(items, "trending", "").map((item) => item.name)).toEqual(["Soft Bob", "Wolf Cut"]);
  });
});
