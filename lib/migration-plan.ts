import { FEATURED_CAP, HERO_TAG, type CmsPhoto } from "./gallery-invariants";
import { DEFAULT_SETTINGS, LOGO_PUBLIC_ID, SETTINGS_PUBLIC_ID } from "./site-settings";

export const GALLERY_FOLDER = "facepaintingbysue/gallery";
export const EXPECTED_GALLERY_COUNT = 87;

export function galleryPublicIdFromFilename(filename: string): string {
  const stem = filename.replace(/\.(jpe?g|png|webp)$/i, "");
  if (!/^sue-\d+$/i.test(stem)) {
    throw new Error(`Unexpected gallery filename: ${filename}`);
  }
  return `${GALLERY_FOLDER}/${stem.toLowerCase()}`;
}

export interface LocalManifestEntry {
  src: string;
  featured: boolean;
}

export interface PlannedAsset {
  kind: "gallery" | "logo" | "settings";
  publicId: string;
  localPath: string | null;
  tags: string[];
  context: Record<string, string>;
  featured: boolean;
  hero: boolean;
  order: number;
}

export function planGalleryAssets(entries: LocalManifestEntry[]): PlannedAsset[] {
  return entries.map((entry, index) => {
    const filename = entry.src.replace(/^\/gallery\//, "");
    const publicId = galleryPublicIdFromFilename(filename);
    const hero = filename.toLowerCase().startsWith("sue-01.");
    const featured = entry.featured || hero;
    const tags = [
      ...(featured ? ["featured"] : []),
      ...(hero ? [HERO_TAG] : []),
    ];
    return {
      kind: "gallery" as const,
      publicId,
      localPath: `public${entry.src}`,
      tags,
      context: { alt: "", order: String(index) },
      featured,
      hero,
      order: index,
    };
  });
}

export function planBrandAndSettings(): PlannedAsset[] {
  return [
    {
      kind: "logo",
      publicId: LOGO_PUBLIC_ID,
      localPath: "public/images/logo-trans-bg.png",
      tags: [],
      context: {},
      featured: false,
      hero: false,
      order: 0,
    },
    {
      kind: "settings",
      publicId: SETTINGS_PUBLIC_ID,
      localPath: null,
      tags: [],
      context: {},
      featured: false,
      hero: false,
      order: 0,
    },
  ];
}

export function assetsToCreate(
  planned: PlannedAsset[],
  existingIds: Set<string>,
): PlannedAsset[] {
  return planned.filter((asset) => !existingIds.has(asset.publicId));
}

export function verifyMigration(input: {
  gallery: CmsPhoto[];
  hasLogo: boolean;
  hasSettings: boolean;
}): { ok: true } | { ok: false; error: string } {
  const live = input.gallery.filter((photo) => !photo.archived);
  if (live.length !== EXPECTED_GALLERY_COUNT) {
    return { ok: false, error: `Expected ${EXPECTED_GALLERY_COUNT} gallery photos, found ${live.length}` };
  }
  const featured = live.filter((photo) => photo.featured || photo.hero);
  if (featured.length > FEATURED_CAP) {
    return { ok: false, error: "Featured cap exceeded after migration" };
  }
  const heroes = live.filter((photo) => photo.hero);
  if (heroes.length !== 1) {
    return { ok: false, error: `Expected exactly one hero, found ${heroes.length}` };
  }
  if (!input.hasLogo) return { ok: false, error: "Logo is missing" };
  if (!input.hasSettings) return { ok: false, error: "Settings are missing" };
  return { ok: true };
}

export { DEFAULT_SETTINGS };
