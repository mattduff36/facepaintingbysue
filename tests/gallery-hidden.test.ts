import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ARCHIVED_TAG,
  FEATURED_TAG,
  HERO_TAG,
  HIDDEN_TAG,
  KEEP_VISIBLE_ERROR,
  SHARE_UNPIN_ERROR,
  SHOW_FIRST_ERROR,
  applyAlt,
  applyArchive,
  applyArchiveMany,
  applyReorder,
  applySetFeatured,
  applySetFeaturedMany,
  applySetHidden,
  applySetHiddenMany,
  applySetHero,
  applyStudioLayout,
  normalizePublished,
  photoFromRecord,
  samePhotoState,
  tagsFor,
  type CmsPhoto,
} from "../lib/gallery-invariants";
import { featuredForMosaic, publicImagesWhenSourceFails, toAdminGalleryImages, toGalleryImages } from "../lib/gallery";
import { persistPlannedPhotos } from "../lib/persist-photo-plan";
import { proposeGroupMove, proposeStudioDrop, studioMutationAllowed } from "../lib/studio-layout";

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

function image(partial: Partial<CmsPhoto> & { publicId: string }) {
  const item = photo(partial);
  return {
    publicId: item.publicId,
    src: `/${item.publicId}.jpg`,
    lightboxSrc: `/${item.publicId}.jpg`,
    featured: item.featured,
    hero: item.hero,
    hidden: item.hidden,
    index: item.order,
    alt: item.alt,
    order: item.order,
  };
}

describe("T-HIDDEN-ROUNDTRIP", () => {
  it("missing tag is visible; hidden tags parse, persist, and verify correctly", () => {
    const visible = photoFromRecord({ publicId: "a", alt: "", order: 0, tags: [FEATURED_TAG, HERO_TAG] });
    assert.equal(visible.hidden, false);
    assert.equal(visible.hero, true);

    const hidden = photoFromRecord({ publicId: "b", alt: "", order: 1, tags: [HIDDEN_TAG] });
    assert.equal(hidden.hidden, true);
    assert.deepEqual(tagsFor(hidden), [HIDDEN_TAG]);
    assert.equal(samePhotoState(hidden, { ...hidden }), true);
    assert.equal(samePhotoState(hidden, { ...hidden, hidden: false }), false);
    assert.ok(!tagsFor(visible).includes(ARCHIVED_TAG));
    assert.ok(!tagsFor(visible).includes(HIDDEN_TAG));
  });
});

describe("T-PROJECTION-SPLIT", () => {
  it("public excludes hidden and archived; admin includes hidden but excludes archived", () => {
    const photos = [
      photo({ publicId: "live", featured: true, hero: true, order: 0 }),
      photo({ publicId: "held", hidden: true, order: 1 }),
      photo({ publicId: "gone", archived: true, order: 2 }),
    ];
    const publicImages = toGalleryImages(photos, "demo");
    assert.deepEqual(publicImages.map((item) => item.publicId), ["live"]);
    assert.equal(normalizePublished(photos).some((item) => item.hidden || item.archived), false);

    const adminImages = toAdminGalleryImages(photos, "demo");
    assert.deepEqual(adminImages.map((item) => item.publicId), ["live", "held"]);
    assert.equal(adminImages.find((item) => item.publicId === "held")?.hidden, true);
  });
});

describe("T-VISIBLE-SAFETY", () => {
  it("hide and archive cannot remove the last visible photo", () => {
    const photos = [
      photo({ publicId: "only", featured: true, hero: true, order: 0 }),
      photo({ publicId: "held", hidden: true, order: 1 }),
    ];
    assert.equal(applySetHidden(photos, "only", true).ok, false);
    assert.equal(applyArchive(photos, "only").ok, false);
    const hide = applySetHidden(photos, "only", true);
    if (!hide.ok) assert.equal(hide.error, KEEP_VISIBLE_ERROR);

    const lastTile = proposeStudioDrop(
      [image({ publicId: "only", featured: true, hero: true, order: 0 })],
      { from: "featured", index: 0 },
      { to: "tray" },
    );
    assert.equal(lastTile.ok, false);
    if (!lastTile.ok) assert.equal(lastTile.error, KEEP_VISIBLE_ERROR);
  });
});

describe("T-HIDE-HERO", () => {
  it("hiding the hero clears its flags and promotes a visible replacement", () => {
    const photos = [
      photo({ publicId: "a", featured: true, hero: true, order: 0 }),
      photo({ publicId: "b", featured: true, order: 1 }),
      photo({ publicId: "c", order: 2 }),
    ];
    const hidden = applySetHidden(photos, "a", true);
    assert.equal(hidden.ok, true);
    if (hidden.ok) {
      const a = hidden.value.find((item) => item.publicId === "a");
      assert.equal(a?.hidden, true);
      assert.equal(a?.featured, false);
      assert.equal(a?.hero, false);
      assert.equal(hidden.value.find((item) => item.hero)?.publicId, "b");
    }
  });
});

describe("T-hidden-public", () => {
  it("hidden photos are absent from toGalleryImages and normalizePublished", () => {
    const photos = [
      photo({ publicId: "a", featured: true, hero: true, order: 0 }),
      photo({ publicId: "b", hidden: true, order: 1 }),
    ];
    assert.equal(toGalleryImages(photos, "demo").length, 1);
    assert.equal(normalizePublished(photos).length, 1);
  });
});

describe("T-hidden-admin", () => {
  it("admin mapper includes hidden and excludes archived", () => {
    const photos = [
      photo({ publicId: "a", order: 0 }),
      photo({ publicId: "b", hidden: true, order: 1 }),
      photo({ publicId: "c", archived: true, order: 2 }),
    ];
    const admin = toAdminGalleryImages(photos, "demo");
    assert.deepEqual(admin.map((item) => item.publicId), ["a", "b"]);
    assert.equal(admin[1].hidden, true);
  });
});

describe("T-hide-last", () => {
  it("hide last visible fails", () => {
    const last = applySetHidden([photo({ publicId: "only", featured: true, hero: true })], "only", true);
    assert.equal(last.ok, false);
  });
});

describe("T-show", () => {
  it("show clears hidden only and does not reorder or feature (Homepage Show path)", () => {
    const photos = [
      photo({ publicId: "a", featured: true, hero: true, order: 0 }),
      photo({ publicId: "b", hidden: true, featured: false, hero: false, order: 1 }),
    ];
    const shown = applySetHidden(photos, "b", false);
    assert.equal(shown.ok, true);
    if (shown.ok) {
      const a = shown.value.find((item) => item.publicId === "a");
      const b = shown.value.find((item) => item.publicId === "b");
      assert.equal(b?.hidden, false);
      assert.equal(b?.featured, false);
      assert.equal(b?.hero, false);
      assert.equal(b?.order, 1);
      assert.equal(a?.featured, true);
      assert.equal(a?.hero, true);
      assert.equal(a?.order, 0);
    }
  });
});

describe("T-hide-bulk", () => {
  it("bulk hide respects last-visible and hero promotion", () => {
    const photos = [
      photo({ publicId: "a", featured: true, hero: true, order: 0 }),
      photo({ publicId: "b", featured: true, order: 1 }),
      photo({ publicId: "c", order: 2 }),
    ];
    const hid = applySetHiddenMany(photos, ["a", "c"], true);
    assert.equal(hid.ok, true);
    if (hid.ok) {
      assert.equal(hid.value.find((item) => item.publicId === "a")?.hidden, true);
      assert.equal(hid.value.find((item) => item.hero)?.publicId, "b");
    }
    assert.equal(applySetHiddenMany(photos, ["a", "b", "c"], true).ok, false);
  });
});

describe("T-HIDDEN-GUARDS", () => {
  it("feature, share, alt, and archive reject hidden targets, including bulk", () => {
    const photos = [
      photo({ publicId: "a", featured: true, hero: true, order: 0 }),
      photo({ publicId: "b", hidden: true, order: 1 }),
    ];
    assert.equal(applySetFeatured(photos, "b", true).ok, false);
    assert.equal(applySetHero(photos, "b").ok, false);
    assert.equal(applyAlt(photos, "b", "Snow queen").ok, false);
    assert.equal(applyArchive(photos, "b").ok, false);
    const featuredBulk = applySetFeaturedMany(photos, ["b"], true);
    assert.equal(featuredBulk.ok, false);
    if (!featuredBulk.ok) assert.equal(featuredBulk.error, SHOW_FIRST_ERROR);
    const archiveBulk = applyArchiveMany(photos, ["b"]);
    assert.equal(archiveBulk.ok, false);
    if (!archiveBulk.ok) assert.equal(archiveBulk.error, SHOW_FIRST_ERROR);
  });
});

describe("T-DROP-PLAN", () => {
  it("one drop validates and persists reorder plus featured and hidden state together", async () => {
    const photos = [
      photo({ publicId: "a", featured: true, hero: true, order: 0 }),
      photo({ publicId: "b", featured: true, order: 1 }),
      photo({ publicId: "c", order: 2 }),
      photo({ publicId: "d", order: 3 }),
    ];
    const planned = applyStudioLayout(photos, {
      orderedIds: ["b", "c", "d", "a"],
      hiddenIds: ["a"],
      featuredIds: ["b", "c"],
    });
    assert.equal(planned.ok, true);
    if (!planned.ok) return;
    assert.equal(planned.value.find((item) => item.publicId === "a")?.hidden, true);
    assert.equal(planned.value.find((item) => item.hero)?.publicId, "b");
    assert.equal(planned.value.find((item) => item.publicId === "c")?.featured, true);
    assert.equal(planned.value.find((item) => item.publicId === "d")?.order, 2);

    const persisted: string[] = [];
    const write = await persistPlannedPhotos({
      before: new Map(photos.map((item) => [item.publicId, item])),
      planned: planned.value,
      persist: async (item) => {
        persisted.push(item.publicId);
        return item;
      },
    });
    assert.equal(write.ok, true);
    assert.deepEqual(new Set(persisted), new Set(["a", "b", "c", "d"]));
  });
});

describe("T-HERO-MOSAIC", () => {
  it("moving the hero outside featured cells is rejected without persistence", () => {
    const photos = [
      photo({ publicId: "a", featured: true, hero: true, order: 0 }),
      photo({ publicId: "b", featured: true, order: 1 }),
      photo({ publicId: "c", order: 2 }),
    ];
    const moved = applyStudioLayout(photos, {
      orderedIds: ["b", "c", "a"],
      hiddenIds: [],
      featuredIds: ["b", "c"],
    });
    assert.equal(moved.ok, false);
    if (!moved.ok) assert.equal(moved.error, SHARE_UNPIN_ERROR);
    assert.equal(photos.find((item) => item.publicId === "a")?.hero, true);
  });
});

describe("T-MOSAIC-ORDER", () => {
  it("featured mosaic follows gallery order while OG/share still uses the hero tag", () => {
    const images = [
      image({ publicId: "share", featured: true, hero: true, order: 2 }),
      image({ publicId: "first", featured: true, order: 0 }),
      image({ publicId: "second", featured: true, order: 1 }),
    ];
    const mosaic = featuredForMosaic(images);
    assert.deepEqual(mosaic.map((item) => item.publicId), ["first", "second", "share"]);
    assert.equal(mosaic.find((item) => item.hero)?.publicId, "share");
    assert.equal(mosaic.length, 3);
  });
});

describe("T-featured-mosaic-order", () => {
  it("featuredForMosaic follows order, not hero-first, and still caps at 8", () => {
    const images = [
      image({ publicId: "i", featured: true, order: 8 }),
      image({ publicId: "e", featured: true, order: 4 }),
      image({ publicId: "a", featured: true, hero: true, order: 1 }),
      image({ publicId: "b", featured: true, order: 0 }),
      image({ publicId: "c", featured: true, order: 2 }),
      image({ publicId: "d", featured: true, order: 3 }),
      image({ publicId: "f", featured: true, order: 5 }),
      image({ publicId: "g", featured: true, order: 6 }),
      image({ publicId: "h", featured: true, order: 7 }),
    ];
    const mosaic = featuredForMosaic(images);
    assert.deepEqual(mosaic.map((item) => item.publicId), ["b", "a", "c", "d", "e", "f", "g", "h"]);
  });
});

describe("T-reorder-hidden", () => {
  it("applyReorder accepts a visible+hidden permutation and rejects missing ids", () => {
    const photos = [
      photo({ publicId: "a", featured: true, hero: true, order: 0 }),
      photo({ publicId: "b", hidden: true, order: 1 }),
      photo({ publicId: "c", order: 2 }),
    ];
    const ok = applyReorder(photos, ["c", "a", "b"]);
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.value.find((item) => item.publicId === "c")?.order, 0);
      assert.equal(ok.value.find((item) => item.publicId === "b")?.hidden, true);
    }
    assert.equal(applyReorder(photos, ["a", "c"]).ok, false);
  });
});

describe("T-PERSIST-ROLLBACK", () => {
  it("partial write failure verifies compensation and reports incomplete rollback", async () => {
    const before = new Map([
      ["a", photo({ publicId: "a", order: 0, hidden: false })],
      ["b", photo({ publicId: "b", order: 1, hidden: false })],
    ]);
    const planned = [
      photo({ publicId: "a", order: 0, hidden: true }),
      photo({ publicId: "b", order: 1, hidden: true }),
    ];
    const restored: CmsPhoto[] = [];
    let writes = 0;
    const failed = await persistPlannedPhotos({
      before,
      planned,
      persist: async (item) => {
        writes += 1;
        if (writes === 2) throw new Error("cloudinary");
        if (writes > 2) restored.push(item);
        return item;
      },
    });
    assert.equal(failed.ok, false);
    if (!failed.ok) assert.equal(failed.incompleteRollback, false);
    assert.equal(restored[0]?.hidden, false);
    assert.equal(restored[0]?.publicId, "a");

    writes = 0;
    const incomplete = await persistPlannedPhotos({
      before,
      planned,
      persist: async (item) => {
        writes += 1;
        if (writes === 2) throw new Error("cloudinary");
        if (writes > 2) throw new Error("restore");
        return item;
      },
    });
    assert.equal(incomplete.ok, false);
    if (!incomplete.ok) assert.equal(incomplete.incompleteRollback, true);
  });
});

describe("T-hidden-public-fallback", () => {
  it("does not serve the local seed gallery when Cloudinary is configured", () => {
    const seed = [image({ publicId: "seed", featured: true, hero: true, order: 0 })];
    assert.deepEqual(publicImagesWhenSourceFails(true, seed), []);
    assert.equal(publicImagesWhenSourceFails(false, seed).length, 1);
  });
});

describe("T-SHARED-ADMIN-STATE", () => {
  it("Photos and Homepage stay on one image list and block overlapping mutations", () => {
    assert.equal(studioMutationAllowed(false), true);
    assert.equal(studioMutationAllowed(true), false);

    const images = [
      image({ publicId: "a", featured: true, hero: true, order: 0 }),
      image({ publicId: "b", featured: true, order: 1 }),
      image({ publicId: "c", featured: true, order: 2 }),
      image({ publicId: "d", featured: true, order: 3 }),
      image({ publicId: "e", order: 4 }),
    ];
    const dropped = proposeStudioDrop(images, { from: "featured", index: 4 }, { to: "tray" });
    assert.equal(dropped.ok, true);
    if (dropped.ok) {
      const next = dropped.value.images;
      assert.equal(next.find((item) => item.publicId === "e")?.hidden, true);
      const shown = next.filter((item) => !item.hidden).map((item) => item.publicId);
      const held = next.filter((item) => item.hidden).map((item) => item.publicId);
      assert.deepEqual(shown, ["a", "b", "c", "d"]);
      assert.deepEqual(held, ["e"]);
    }

    const grouped = proposeGroupMove(images, "e", "hidden");
    assert.equal(grouped.ok, true);
    if (grouped.ok) {
      assert.equal(grouped.value.images.find((item) => item.publicId === "e")?.hidden, true);
    }
  });
});
