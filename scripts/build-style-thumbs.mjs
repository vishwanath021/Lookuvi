import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const jobs = [
  ["public/styles", "public/styles/thumbs", 384],
  ["public/beards", "public/beards/thumbs", 384],
  ["public/nails", "public/nails/thumbs", 384],
  ["public/brows", "public/brows/thumbs", 384],
  ["public/brows/cards", "public/brows/cards/thumbs", 640],
];

let written = 0;
for (const [from, to, width] of jobs) {
  await mkdir(to, { recursive: true });
  const names = await readdir(from);
  for (const name of names) {
    if (!/\.(jpe?g|png|webp)$/i.test(name)) continue;
    const id = name.replace(/\.(jpe?g|png|webp)$/i, "");
    const out = path.join(to, `${id}.webp`);
    await sharp(path.join(from, name))
      .rotate()
      .resize({ width, height: width, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 72 })
      .toFile(out);
    written += 1;
  }
}
console.log(`wrote ${written} webp thumbnails`);
