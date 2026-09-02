import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GALLERY_HARD_CAP,
  applyArchive,
  applyArchiveMany,
  applySetFeatured,
  applySetFeaturedMany,
  applySetHero,
  applyUploadSlot,
  normalizePublished,
  type CmsPhoto,
} from "../lib/gallery-invariants";
import { featuredForMosaic, toGalleryImages } from "../lib/gallery";

function photo(partial: Partial<CmsPhoto> & { publicId: string }): CmsPhoto {
  return {
    alt: "",
    order: 0,
    featured: false,
    hero: false,
    archived: false,
    hidden: false,
    ...partial,
  };
}

describe("T-featured-cap", () => {
  it("rejects a ninth featured asset and counts the hero toward the cap", () => {
    const photos = [
      photo({ publicId: "a", featured: true, hero: true, order: 0 }),
      photo({ publicId: "b", featured: true, order: 1 }),
      photo({ publicId: "c", featured: true, order: 2 }),
      photo({ publicId: "d", featured: true, order: 3 }),
      photo({ publicId: "e", featured: true, order: 4 }),
      photo({ publicId: "f", featured: true, order: 5 }),
      photo({ publicId: "g", featured: true, order: 6 }),
      photo({ publicId: "h", featured: true, order: 7 }),
      photo({ publicId: "i", order: 8 }),
    ];
    const ninth = applySetFeatured(photos, "i", true);
    assert.equal(ninth.ok, false);

    const publicImages = toGalleryImages(photos, "demo");
    assert.equal(publicImages.filter((image) => image.featured).length, 8);
    assert.equal(featuredForMosaic(publicImages).length, 8);

    const full = Array.from({ length: GALLERY_HARD_CAP }, (_, index) =>
      photo({ publicId: `p${index}`, archived: index > 0, featured: index === 0, hero: index === 0 }),
    );
    assert.equal(applyUploadSlot(full).ok, false);
  });

  it("public normalization never exposes more than eight featured photos", () => {
    const messy = [
      photo({ publicId: "a", featured: true, hero: true, order: 0 }),
      photo({ publicId: "b", featured: true, hero: true, order: 1 }),
      photo({ publicId: "c", featured: true, order: 2 }),
      photo({ publicId: "d", featured: true, order: 3 }),
      photo({ publicId: "e", featured: true, order: 4 }),
      photo({ publicId: "f", featured: true, order: 5 }),
      photo({ publicId: "g", featured: true, order: 6 }),
      photo({ publicId: "h", featured: true, order: 7 }),
      photo({ publicId: "i", featured: true, order: 8 }),
    ];
    const normalized = normalizePublished(messy);
    assert.equal(normalized.filter((photo) => photo.featured).length, 8);
    assert.equal(normalized.filter((photo) => photo.hero).length, 1);
    assert.equal(normalized.find((photo) => photo.hero)?.publicId, "a");
  });
});

describe("T-hero-one", () => {
  it("hero replacement, deletion, duplicate tags, and missing tags result in one deterministic hero", () => {
    const photos = [
      photo({ publicId: "a", featured: true, hero: true, order: 0 }),
      photo({ publicId: "b", featured: true, order: 1 }),
      photo({ publicId: "c", order: 2 }),
    ];

    const replaced = applySetHero(photos, "b");
    assert.equal(replaced.ok, true);
    if (replaced.ok) {
      assert.equal(replaced.value.filter((item) => item.hero).length, 1);
      assert.equal(replaced.value.find((item) => item.hero)?.publicId, "b");
      assert.equal(replaced.value.find((item) => item.publicId === "b")?.featured, true);
    }

    const deleted = applyArchive(photos, "a");
    assert.equal(deleted.ok, true);
    if (deleted.ok) {
      const live = deleted.value.filter((item) => !item.archived);
      assert.equal(live.filter((item) => item.hero).length, 1);
      assert.equal(live.find((item) => item.hero)?.publicId, "b");
    }

    const last = applyArchive([photo({ publicId: "only", featured: true, hero: true })], "only");
    assert.equal(last.ok, false);

    const missing = normalizePublished([
      photo({ publicId: "x", featured: true, order: 0 }),
      photo({ publicId: "y", order: 1 }),
    ]);
    assert.equal(missing.filter((item) => item.hero).length, 1);
    assert.equal(missing[0].hero, true);
  });
});

describe("T-bulk-featured", () => {
  it("features several until the cap and rejects overflow", () => {
    const photos = [
      photo({ publicId: "a", featured: true, hero: true, order: 0 }),
      photo({ publicId: "b", order: 1 }),
      photo({ publicId: "c", order: 2 }),
      photo({ publicId: "d", order: 3 }),
      photo({ publicId: "e", order: 4 }),
      photo({ publicId: "f", order: 5 }),
      photo({ publicId: "g", order: 6 }),
      photo({ publicId: "h", order: 7 }),
      photo({ publicId: "i", order: 8 }),
    ];
    const ok = applySetFeaturedMany(photos, ["b", "c", "d", "e", "f", "g", "h"], true);
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.value.filter((item) => item.featured).length, 8);
    }

    const overflow = applySetFeaturedMany(photos, ["b", "c", "d", "e", "f", "g", "h", "i"], true);
    assert.equal(overflow.ok, false);
  });

  it("unpins non-hero selected photos and refuses hero-only unpin", () => {
    const photos = [
      photo({ publicId: "a", featured: true, hero: true, order: 0 }),
      photo({ publicId: "b", featured: true, order: 1 }),
      photo({ publicId: "c", featured: true, order: 2 }),
    ];
    const unpinned = applySetFeaturedMany(photos, ["a", "b", "c"], false);
    assert.equal(unpinned.ok, true);
    if (unpinned.ok) {
      assert.equal(unpinned.value.find((item) => item.publicId === "a")?.featured, true);
      assert.equal(unpinned.value.find((item) => item.publicId === "b")?.featured, false);
      assert.equal(unpinned.value.find((item) => item.publicId === "c")?.featured, false);
    }

    const heroOnly = applySetFeaturedMany(photos, ["a"], false);
    assert.equal(heroOnly.ok, false);
  });
});

describe("T-bulk-archive", () => {
  it("archives several, keeps one live photo, and promotes a hero", () => {
    const photos = [
      photo({ publicId: "a", featured: true, hero: true, order: 0 }),
      photo({ publicId: "b", featured: true, order: 1 }),
      photo({ publicId: "c", order: 2 }),
      photo({ publicId: "d", order: 3 }),
    ];
    const removed = applyArchiveMany(photos, ["a", "c"]);
    assert.equal(removed.ok, true);
    if (removed.ok) {
      const live = removed.value.filter((item) => !item.archived);
      assert.equal(live.length, 2);
      assert.equal(live.filter((item) => item.hero).length, 1);
      assert.equal(live.find((item) => item.hero)?.publicId, "b");
    }

    const all = applyArchiveMany(photos, ["a", "b", "c", "d"]);
    assert.equal(all.ok, false);
  });
});
