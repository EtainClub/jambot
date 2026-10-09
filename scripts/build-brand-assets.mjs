import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const sharp = require(require.resolve("sharp", { paths: [require.resolve("next")] }));
const [logoSource, iconSource, shareSource] = process.argv.slice(2);
if (!logoSource || !iconSource) {
  throw new Error("Usage: node scripts/build-brand-assets.mjs <logo.png> <icon.png>");
}

await mkdir("assets/brand", { recursive: true });
await mkdir("public/brand", { recursive: true });
for (const [source, target] of [
  [logoSource, "assets/brand/jamtong-report-logo-master.png"],
  [iconSource, "assets/brand/jamtong-report-icon-master.png"],
]) {
  if (resolve(source) !== resolve(target)) await copyFile(source, target);
}

// Package the approved artwork for the header and OS-specific icon sizes.
await sharp(logoSource).trim().resize({ width: 1000 }).png().toFile("public/brand/jamtong-report-logo.png");
for (const [file, size] of [
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["public/icons/icon-maskable-512.png", 512],
  ["src/app/icon.png", 48],
  ["src/app/apple-icon.png", 180],
]) {
  await sharp(iconSource).resize(size, size).removeAlpha().png().toFile(file);
  const metadata = await sharp(file).metadata();
  console.log(`${file}: ${metadata.width}x${metadata.height}`);
}
const logo = await sharp("public/brand/jamtong-report-logo.png").metadata();
console.log(`public/brand/jamtong-report-logo.png: ${logo.width}x${logo.height}, alpha=${logo.hasAlpha}`);

// ICO directory followed by three PNG payloads for standard browser sizes.
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map((size) => sharp(iconSource).resize(size, size).ensureAlpha().png().toBuffer()));
const directory = Buffer.alloc(6 + images.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(images.length, 4);
let offset = directory.length;
images.forEach((image, index) => {
  const entry = 6 + index * 16;
  directory[entry] = sizes[index];
  directory[entry + 1] = sizes[index];
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(image.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
await writeFile("src/app/favicon.ico", Buffer.concat([directory, ...images]));
console.log("src/app/favicon.ico: 16x16, 32x32, 48x48");

if (shareSource) {
  const master = "assets/brand/jamtong-report-share-master.png";
  if (resolve(shareSource) !== resolve(master)) await copyFile(shareSource, master);
  await sharp(shareSource).resize(1200, 630, { fit: "cover" }).removeAlpha().png()
    .toFile("public/brand/jamtong-report-share.png");
  console.log("public/brand/jamtong-report-share.png: 1200x630");
}
