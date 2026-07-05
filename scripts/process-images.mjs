// Processes Sue's source photos into public/gallery.
// - SueNewImages/*  -> high-res "featured" tiles (ordered first)
// - SueFacebookImages/* -> deduped (by Facebook media id + byte hash), then appended
// Outputs sequentially named files (sue-01.jpg ...) and a manifest at lib/gallery-data.json.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const NEW_DIR = path.join(root, "SueNewImages");
const FB_DIR = path.join(root, "SueFacebookImages");
const OUT_DIR = path.join(root, "public", "gallery");
const MANIFEST = path.join(root, "lib", "gallery-data.json");

const IMG_EXT = /\.(jpe?g|png|webp)$/i;

function listImages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => IMG_EXT.test(f))
    .map((f) => path.join(dir, f));
}

function md5(file) {
  return createHash("md5").update(fs.readFileSync(file)).digest("hex");
}

// Facebook filenames look like: imgi_12_485140304_1157728402811829_..._n.jpg
// The first long number group after the index is the stable media id.
function fbMediaId(filePath) {
  const name = path.basename(filePath);
  const m = name.match(/^imgi_\d+_(\d+)_/);
  return m ? m[1] : name;
}

function dedupeFacebook(files) {
  // 1) group by media id, keep the largest file per id
  const byId = new Map();
  for (const file of files) {
    const id = fbMediaId(file);
    const size = fs.statSync(file).size;
    const current = byId.get(id);
    if (!current || size > current.size) byId.set(id, { file, size });
  }
  // 2) drop any remaining byte-identical duplicates
  const seenHashes = new Set();
  const kept = [];
  for (const { file } of byId.values()) {
    const hash = md5(file);
    if (seenHashes.has(hash)) continue;
    seenHashes.add(hash);
    kept.push(file);
  }
  return { kept, seenHashes };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });

  // Clean previously generated gallery files so the run is idempotent.
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (/^sue-\d+\.(jpe?g|png|webp)$/i.test(f)) fs.rmSync(path.join(OUT_DIR, f));
  }

  const featuredSrc = listImages(NEW_DIR).sort();
  const fbSrc = listImages(FB_DIR).sort();

  const { kept: fbKept, seenHashes } = dedupeFacebook(fbSrc);

  // Avoid featured/FB overlap by hash too.
  const featuredHashes = new Set(featuredSrc.map(md5));
  const fbFinal = fbKept.filter((f) => !featuredHashes.has(md5(f)));

  const ordered = [
    ...featuredSrc.map((file) => ({ file, featured: true })),
    ...fbFinal.map((file) => ({ file, featured: false })),
  ];

  const manifest = [];
  ordered.forEach(({ file, featured }, i) => {
    const ext = path.extname(file).toLowerCase();
    const outName = `sue-${pad(i + 1)}${ext}`;
    fs.copyFileSync(file, path.join(OUT_DIR, outName));
    manifest.push({ src: `/gallery/${outName}`, featured });
  });

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

  const featuredCount = manifest.filter((m) => m.featured).length;
  console.log(
    `Processed: ${featuredSrc.length} featured + ${fbSrc.length} Facebook source files.\n` +
      `Kept ${manifest.length} unique photos (${featuredCount} featured, ${
        manifest.length - featuredCount
      } gallery).\n` +
      `Deduped ${fbSrc.length - fbFinal.length} Facebook duplicates.\n` +
      `Manifest -> ${path.relative(root, MANIFEST)}`,
  );
}

main();
