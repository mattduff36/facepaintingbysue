import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { v2 as cloudinary } from "cloudinary";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const MANIFEST_JSON = path.join(root, "lib", "gallery-data.json");
const RUN_FILE = path.join(__dirname, ".migrate-run.json");
const GALLERY_FOLDER = "facepaintingbysue/gallery";
const LOGO_PUBLIC_ID = "facepaintingbysue/brand/logo";
const SETTINGS_PUBLIC_ID = "facepaintingbysue/site-settings";
const EXPECTED = 87;

function loadEnvLocal() {
  const file = path.join(root, ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function requireCloudinary() {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) {
    throw new Error("Cloudinary env vars are missing");
  }
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
}

function galleryPublicId(filename) {
  const stem = filename.replace(/\.(jpe?g|png|webp)$/i, "").toLowerCase();
  return `${GALLERY_FOLDER}/${stem}`;
}

function cloudinaryHttpCode(error) {
  return error?.http_code ?? error?.error?.http_code;
}

async function resourceExists(publicId, resourceType = "image") {
  try {
    await cloudinary.api.resource(publicId, { resource_type: resourceType });
    return true;
  } catch (error) {
    if (cloudinaryHttpCode(error) === 404) return false;
    throw new Error(error?.error?.message ?? error?.message ?? "Cloudinary request failed");
  }
}

function defaultSettings() {
  return {
    revision: 1,
    name: "Facepainting by Sue",
    tagline: "Bringing colourful smiles to Burton upon Trent",
    area: "Burton upon Trent & surrounding areas",
    email: "suesfaces@gmail.com",
    phoneDisplay: "07588 486495",
    phoneHref: "tel:+447588486495",
    facebook: "https://www.facebook.com/suespaintedfaces",
    bookingSubject: "Face painting enquiry",
    bookingBody:
      "Hi Sue,\n\nI'd love to book you for an event. Here are the details:\n\n- Date:\n- Location:\n- Type of event:\n- Approx. number of faces:\n\nThanks!",
    seoTitle: "Facepainting by Sue | Colourful face painting in Burton upon Trent",
    seoDescription:
      "Fun, colourful and professional face painting by Sue for birthdays, fairs, parties and events across Burton upon Trent and beyond.",
    availability: "",
    logoPublicId: LOGO_PUBLIC_ID,
  };
}

function plan() {
  const entries = JSON.parse(fs.readFileSync(MANIFEST_JSON, "utf8"));
  const gallery = entries.map((entry, index) => {
    const filename = entry.src.replace("/gallery/", "");
    const publicId = galleryPublicId(filename);
    const hero = filename.toLowerCase().startsWith("sue-01.");
    return {
      kind: "gallery",
      publicId,
      localPath: path.join(root, "public", "gallery", filename),
      tags: [...(entry.featured || hero ? ["featured"] : []), ...(hero ? ["hero"] : [])],
      context: { alt: "", order: String(index) },
    };
  });
  return [
    ...gallery,
    {
      kind: "logo",
      publicId: LOGO_PUBLIC_ID,
      localPath: path.join(root, "public", "images", "logo-trans-bg.png"),
      tags: [],
      context: {},
    },
    {
      kind: "settings",
      publicId: SETTINGS_PUBLIC_ID,
      localPath: null,
      tags: [],
      context: {},
    },
  ];
}

async function uploadAsset(asset) {
  if (asset.kind === "settings") {
    const dataUri = `data:application/json;base64,${Buffer.from(JSON.stringify(defaultSettings()), "utf8").toString("base64")}`;
    await cloudinary.uploader.upload(dataUri, {
      public_id: asset.publicId,
      resource_type: "raw",
      overwrite: false,
    });
    return;
  }
  await cloudinary.uploader.upload(asset.localPath, {
    public_id: asset.publicId,
    resource_type: "image",
    overwrite: false,
    invalidate: true,
    tags: asset.tags,
    context: asset.context,
  });
}

async function verify() {
  const listed = await cloudinary.api.resources({
    type: "upload",
    resource_type: "image",
    prefix: `${GALLERY_FOLDER}/`,
    max_results: 500,
    tags: true,
  });
  if (listed.next_cursor) throw new Error("Gallery listing overflow during verify");
  const gallery = listed.resources ?? [];
  if (gallery.length !== EXPECTED) {
    throw new Error(`Expected ${EXPECTED} gallery photos, found ${gallery.length}`);
  }
  const featured = gallery.filter((item) => (item.tags ?? []).includes("featured") || (item.tags ?? []).includes("hero"));
  const heroes = gallery.filter((item) => (item.tags ?? []).includes("hero"));
  if (featured.length > 4) throw new Error("Featured cap exceeded after migration");
  if (heroes.length !== 1) throw new Error(`Expected one hero, found ${heroes.length}`);
  if (!(await resourceExists(LOGO_PUBLIC_ID))) throw new Error("Logo is missing");
  if (!(await resourceExists(SETTINGS_PUBLIC_ID, "raw"))) throw new Error("Settings are missing");
}

async function rollback(created) {
  for (const item of created) {
    try {
      await cloudinary.uploader.destroy(item.publicId, {
        resource_type: item.kind === "settings" ? "raw" : "image",
        invalidate: true,
      });
    } catch (error) {
      console.warn(`Could not roll back ${item.publicId}: ${error?.message ?? error}`);
    }
  }
}

async function main() {
  loadEnvLocal();
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const doRollback = args.has("--rollback");
  requireCloudinary();

  if (doRollback) {
    if (!fs.existsSync(RUN_FILE)) throw new Error("No migration run file to roll back");
    const run = JSON.parse(fs.readFileSync(RUN_FILE, "utf8"));
    await rollback(run.created ?? []);
    console.log(`Rolled back ${run.created?.length ?? 0} assets from this run.`);
    return;
  }

  const planned = plan();
  const created = [];
  for (const asset of planned) {
    const exists = await resourceExists(asset.publicId, asset.kind === "settings" ? "raw" : "image");
    if (exists) {
      console.log(`skip ${asset.publicId}`);
      continue;
    }
    if (dryRun) {
      console.log(`dry-run create ${asset.publicId}`);
      continue;
    }
    await uploadAsset(asset);
    created.push({ publicId: asset.publicId, kind: asset.kind });
    console.log(`created ${asset.publicId}`);
  }

  if (!dryRun) {
    const run = {
      createdAt: new Date().toISOString(),
      created,
      checksum: createHash("sha256").update(JSON.stringify(created)).digest("hex"),
    };
    fs.writeFileSync(RUN_FILE, JSON.stringify(run, null, 2));
    await verify();
    console.log("Migration verified.");
  } else {
    console.log("Dry run complete. No assets were uploaded.");
  }
}

main().catch((error) => {
  console.error(typeof error?.message === "string" ? error.message : "Migration failed");
  process.exit(1);
});
