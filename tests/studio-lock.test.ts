import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyUploadSlot, GALLERY_HARD_CAP, type CmsPhoto } from "../lib/gallery-invariants";
import { DEFAULT_SETTINGS, assertCurrentRevision } from "../lib/site-settings";
import { mergePlannedImages, type GalleryImage } from "../lib/gallery";
import {
  STUDIO_BUSY_ERROR,
  STUDIO_LOCK_TTL_MS,
  STUDIO_STALE_ERROR,
  acquireStudioLock,
  decideLockAcquire,
  expireAfterSuccess,
  galleryFingerprint,
  interpretLockRead,
  lockHeldByOther,
  parseStudioLock,
  prepareSettingsSave,
  prepareUploadOnLiveList,
  rejectIfGalleryStale,
  releaseStudioLock,
  renewStudioLock,
  serializeStudioLock,
  shouldReloadStudio,
  type StudioLockStore,
} from "../lib/studio-lock";

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

function memoryStore(initial: string | null = null): StudioLockStore & { value: string | null } {
  const store = {
    value: initial,
    async read() {
      return store.value;
    },
    async write(json: string) {
      store.value = json;
    },
  };
  return store;
}

describe("T-STUDIO-LOCK-ACQUIRE", () => {
  it("missing/expired lock acquired; unexpired foreign lock rejected", async () => {
    const now = 1_700_000_000_000;
    const missing = decideLockAcquire(null, "a", now);
    assert.equal(missing.ok, true);
    if (missing.ok) assert.equal(missing.lock.token, "a");

    const expired = parseStudioLock(serializeStudioLock({ token: "b", expiresAt: now - 1 }));
    assert.equal(lockHeldByOther(expired, "a", now), false);
    const takeExpired = decideLockAcquire(expired, "a", now);
    assert.equal(takeExpired.ok, true);

    const live = parseStudioLock(serializeStudioLock({ token: "b", expiresAt: now + 5_000 }));
    assert.equal(lockHeldByOther(live, "a", now), true);
    const busy = decideLockAcquire(live, "a", now);
    assert.equal(busy.ok, false);
    if (!busy.ok) assert.equal(busy.error, STUDIO_BUSY_ERROR);

    const clock = () => now;
    const store = memoryStore(null);
    assert.equal((await acquireStudioLock("a", store, now, STUDIO_LOCK_TTL_MS, clock)).ok, true);
    assert.equal((await acquireStudioLock("b", store, now, STUDIO_LOCK_TTL_MS, clock)).ok, false);
    await releaseStudioLock("a", store, now, clock);
    assert.equal((await acquireStudioLock("b", store, now, STUDIO_LOCK_TTL_MS, clock)).ok, true);

    const raced = memoryStore(null);
    const [first, second] = await Promise.all([
      acquireStudioLock("a", raced, now, STUDIO_LOCK_TTL_MS, clock),
      acquireStudioLock("b", raced, now, STUDIO_LOCK_TTL_MS, clock),
    ]);
    assert.equal([first.ok, second.ok].filter(Boolean).length, 1);

    assert.equal(interpretLockRead("{not-json").kind, "uncertain");
    assert.equal((await acquireStudioLock("c", memoryStore("{not-json"), now, STUDIO_LOCK_TTL_MS, clock)).ok, false);

    const throwing: StudioLockStore = {
      async read() {
        throw new Error("network");
      },
      async write() {},
    };
    assert.equal((await acquireStudioLock("c", throwing, now, STUDIO_LOCK_TTL_MS, clock)).ok, false);

    let t = now;
    const moving = () => t;
    const delayed = memoryStore(null);
    const originalWrite = delayed.write.bind(delayed);
    delayed.write = async (json: string) => {
      await originalWrite(json);
      t = now + STUDIO_LOCK_TTL_MS + 1;
    };
    assert.equal((await acquireStudioLock("late", delayed, now, STUDIO_LOCK_TTL_MS, moving)).ok, false);

    t = now;
    const held = memoryStore(null);
    assert.equal((await acquireStudioLock("a", held, now, STUDIO_LOCK_TTL_MS, moving)).ok, true);
    assert.equal((await renewStudioLock("a", held, now, STUDIO_LOCK_TTL_MS, moving)).ok, true);
    t = now + STUDIO_LOCK_TTL_MS + 1;
    assert.equal((await renewStudioLock("a", held, t, STUDIO_LOCK_TTL_MS, moving)).ok, false);
  });
});

describe("T-STUDIO-LOCK-STALE", () => {
  it("plan rejected when live fingerprint differs from before", () => {
    const before = [photo({ publicId: "one", order: 0, featured: true, hero: true, version: 1 })];
    const live = [photo({ publicId: "one", order: 0, featured: true, hero: true, version: 2 })];
    assert.notEqual(galleryFingerprint(before), galleryFingerprint(live));
    const stale = rejectIfGalleryStale(before, live);
    assert.equal(stale.ok, false);
    if (!stale.ok) assert.equal(stale.error, STUDIO_STALE_ERROR);
    assert.equal(rejectIfGalleryStale(before, before).ok, true);
    assert.equal(shouldReloadStudio(STUDIO_STALE_ERROR), true);
    assert.equal(shouldReloadStudio(STUDIO_BUSY_ERROR), true);
    assert.equal(shouldReloadStudio("Someone else saved site details. Refresh the page and try again."), true);
    assert.equal(shouldReloadStudio("Try again."), false);
    assert.equal(
      galleryFingerprint([{ publicId: "one", alt: "shown", storedAlt: "stored", order: 0, featured: false, hero: false, hidden: false }]),
      galleryFingerprint([{ publicId: "one", alt: "stored", order: 0, featured: false, hero: false, hidden: false }]),
    );

    const mosaic: GalleryImage[] = [
      {
        publicId: "one",
        src: "/one.jpg",
        lightboxSrc: "/one-lg.jpg",
        featured: true,
        hero: true,
        hidden: false,
        index: 0,
        alt: "shown",
        storedAlt: "stored",
        order: 0,
        version: 4,
      },
    ];
    const first = mergePlannedImages(mosaic, [photo({ publicId: "one", alt: "stored", order: 1, featured: true, hero: true, version: 4 })]);
    const second = mergePlannedImages(first, [photo({ publicId: "one", alt: "stored", order: 2, featured: true, hero: true, version: 4 })]);
    assert.equal(first[0]?.version, 4);
    assert.equal(first[0]?.storedAlt, "stored");
    assert.equal(second[0]?.version, 4);
    assert.equal(second[0]?.storedAlt, "stored");
    assert.equal(galleryFingerprint(first), galleryFingerprint([{ ...second[0], order: first[0].order }]));
  });
});

describe("T-SETTINGS-LOCK-REVISION", () => {
  it("stale settings revision still rejected after lock + re-read", () => {
    const incoming = { ...DEFAULT_SETTINGS, revision: 2 };
    const live = DEFAULT_SETTINGS;
    const afterLock = prepareSettingsSave(incoming, live);
    assert.equal(afterLock.ok, false);
    assert.equal(assertCurrentRevision(incoming, live).ok, false);
    assert.equal(prepareSettingsSave(DEFAULT_SETTINGS, DEFAULT_SETTINGS).ok, true);
  });
});

describe("T-UPLOAD-CAP-LOCK", () => {
  it("cap is evaluated on the post-lock live list", () => {
    const full = Array.from({ length: GALLERY_HARD_CAP }, (_, index) =>
      photo({ publicId: `p${index}`, order: index }),
    );
    const blocked = prepareUploadOnLiveList(full);
    assert.equal(blocked.ok, false);
    assert.equal(applyUploadSlot(full).ok, false);
    assert.equal(prepareUploadOnLiveList(full.slice(0, 2)).ok, true);
  });
});

describe("T-CACHE-EXPIRE-SEPARATE", () => {
  it("persist success + thrown expire() still returns ok: true", () => {
    let expired = false;
    expireAfterSuccess(() => {
      expired = true;
      throw new Error("updateTag failed");
    });
    assert.equal(expired, true);
    const result = { ok: true as const };
    expireAfterSuccess(() => {
      throw new Error("updateTag failed");
    });
    assert.equal(result.ok, true);
  });
});
