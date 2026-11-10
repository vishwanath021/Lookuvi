import { expect, test } from "@playwright/test";

const NAMES = [
  "Soft Arch",
  "High Arch",
  "Straight",
  "Rounded",
  "S-Shape",
  "Feathered",
  "Bold Natural",
  "Angled",
  "Flat Thick",
  "Natural Groomed",
  "Thin Defined",
  "Tapered",
  "Clean-up",
];

test("brow cards are distinct diagrams and chips do not generate", async ({ page }) => {
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/v1/tryon/generate")) posts.push(request.url());
  });
  await page.goto("/s/demo");
  await page.getByRole("tab", { name: "Brows" }).click();
  const region = page.getByRole("region", { name: "Brows" });
  const more = region.getByRole("button", { name: "Show more" });
  if (await more.count()) await more.click();
  const photos = await region.locator("[data-brow-card='photo']").count();
  expect(photos === 0 || photos === NAMES.length).toBe(true);
  const paths = new Set<string>();
  for (const name of NAMES) {
    const card = region.getByRole("button", { name });
    await expect(card).toBeVisible();
    if (photos === NAMES.length) {
      await expect(card.locator("svg")).toHaveCount(0);
      await expect(card.locator("img")).toBeVisible();
    } else {
      const d = await card.locator("path").first().getAttribute("d");
      expect(d, name).toBeTruthy();
      paths.add(d || "");
    }
    const box = await card.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  if (photos !== NAMES.length) expect(paths.size).toBe(NAMES.length);

  await page.setViewportSize({ width: 320, height: 700 });
  const narrow = await region.getByRole("button", { name: "Soft Arch" }).boundingBox();
  expect(narrow?.width ?? 0).toBeGreaterThanOrEqual(44);

  await expect(page.getByRole("group", { name: "Brow thickness" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Brow colour" })).toHaveCount(0);
  await region.getByRole("button", { name: "Soft Arch" }).click();
  expect(posts).toEqual([]);
  await expect(page.getByRole("button", { name: "Try this look" })).toBeVisible();
  await page.getByRole("button", { name: "Try this look" }).click();
  expect(posts).toEqual([]);
  await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(0);
});
