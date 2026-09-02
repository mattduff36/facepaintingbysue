import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PUBLIC_CACHE_SECONDS, shouldExpireCaches, tagsToExpire } from "../lib/cache-tags";
import { logoWriteVerified, settingsWriteVerified, writeSettingsPipeline } from "../lib/write-verify";
import {
  DEFAULT_SETTINGS,
  SETTINGS_BACKUP_PUBLIC_ID,
  SETTINGS_PUBLIC_ID,
  assertCurrentRevision,
  nextSettings,
  phoneHrefFromDisplay,
  validateSettings,
} from "../lib/site-settings";
import { MAX_UPLOAD_BYTES, newGalleryPublicId, validateImageUpload } from "../lib/upload-policy";
import {
  EXPECTED_GALLERY_COUNT,
  assetsToCreate,
  galleryPublicIdFromFilename,
  planBrandAndSettings,
  planGalleryAssets,
  verifyMigration,
} from "../lib/migration-plan";
import type { CmsPhoto } from "../lib/gallery-invariants";

describe("T-settings-validate", () => {
  it("invalid, unknown-field, oversized, and stale-revision settings never overwrite", async () => {
    assert.equal(validateSettings(null).ok, false);
    assert.equal(validateSettings({ ...DEFAULT_SETTINGS, extra: "nope" }).ok, false);
    assert.equal(validateSettings({ ...DEFAULT_SETTINGS, tagline: "x".repeat(200) }).ok, false);
    assert.equal(validateSettings({ ...DEFAULT_SETTINGS, email: "not-an-email" }).ok, false);
    assert.equal(phoneHrefFromDisplay("07588 486495", "tel:+440000"), "tel:+447588486495");
    assert.equal(phoneHrefFromDisplay("+44 7588 486495", "tel:+440000"), "tel:+447588486495");
    assert.equal(phoneHrefFromDisplay("", "tel:+447588486495"), "tel:+447588486495");

    const stale = assertCurrentRevision({ ...DEFAULT_SETTINGS, revision: 2 }, DEFAULT_SETTINGS);
    assert.equal(stale.ok, false);

    const current = DEFAULT_SETTINGS;
    const { revision: _revision, ...fields } = current;
    const next = nextSettings(current, { ...fields, tagline: "Updated" });
    assert.equal(next.revision, current.revision + 1);
    assert.equal(SETTINGS_BACKUP_PUBLIC_ID.endsWith(".prev"), true);
    assert.ok(SETTINGS_PUBLIC_ID.startsWith("facepaintingbysue/"));

    assert.equal(
      settingsWriteVerified({
        next,
        previous: current,
        written: next,
        backup: current,
      }),
      true,
    );
    assert.equal(
      settingsWriteVerified({
        next,
        previous: current,
        written: { ...next, tagline: "wrong" },
        backup: current,
      }),
      false,
    );
    assert.equal(
      settingsWriteVerified({
        next,
        previous: current,
        written: next,
        backup: null,
      }),
      false,
    );
    assert.equal(logoWriteVerified({ version: 1 }, { version: 1 }), false);
    assert.equal(logoWriteVerified({ version: 1 }, { version: 2 }), true);
    assert.equal(logoWriteVerified({ version: 1 }, {}), false);
    assert.equal(logoWriteVerified(null, { version: 3 }), true);
    assert.equal(logoWriteVerified(null, {}), false);

    const store: { main: typeof current | null; backup: typeof current | null; order: string[] } = {
      main: current,
      backup: null,
      order: [],
    };
    await writeSettingsPipeline({
      next,
      previous: current,
      writeBackup: async (settings) => {
        store.order.push("backup");
        store.backup = settings;
      },
      readBackup: async () => store.backup,
      writeMain: async (settings) => {
        store.order.push("main");
        store.main = settings;
      },
      readMain: async () => store.main,
    });
    assert.deepEqual(store.order, ["backup", "main"]);
    assert.equal(store.main?.tagline, "Updated");

    await assert.rejects(() =>
      writeSettingsPipeline({
        next,
        previous: current,
        writeBackup: async () => {
          store.backup = { ...current, tagline: "tampered" };
        },
        readBackup: async () => store.backup,
        writeMain: async () => {
          throw new Error("main must not run");
        },
        readMain: async () => store.main,
      }),
    );
  });
});

describe("T-upload-policy", () => {
  it("oversized and unsupported files are rejected before Cloudinary; valid uploads use generated IDs", () => {
    assert.equal(validateImageUpload({ type: "image/jpeg", size: 12, name: "ok.jpg" }).ok, true);
    assert.equal(validateImageUpload({ type: "image/gif", size: 12, name: "no.gif" }).ok, false);
    assert.equal(validateImageUpload({ type: "image/jpeg", size: MAX_UPLOAD_BYTES + 1, name: "big.jpg" }).ok, false);
    const id = newGalleryPublicId();
    assert.match(id, /^facepaintingbysue\/gallery\/[0-9a-f-]{36}$/);
  });
});

describe("T-cache-revalidate", () => {
  it("public reads expire only after a verified successful mutation", () => {
    assert.equal(shouldExpireCaches(true, true), true);
    assert.equal(shouldExpireCaches(false, true), false);
    assert.equal(shouldExpireCaches(true, false), false);
    assert.deepEqual(tagsToExpire("gallery"), ["gallery"]);
    assert.deepEqual(tagsToExpire("settings"), ["site-settings"]);
    assert.deepEqual(tagsToExpire("both"), ["gallery", "site-settings"]);
    assert.equal(PUBLIC_CACHE_SECONDS, 60);
  });
});

describe("T-migration-idempotent", () => {
  it("dry-run and repeated planning preserve existing assets and verify counts", () => {
    const entries = Array.from({ length: EXPECTED_GALLERY_COUNT }, (_, index) => ({
      src: `/gallery/sue-${String(index + 1).padStart(2, "0")}.jpg`,
      featured: index < 4,
    }));
    const planned = [...planGalleryAssets(entries), ...planBrandAndSettings()];
    assert.equal(galleryPublicIdFromFilename("sue-01.jpg"), "facepaintingbysue/gallery/sue-01");
    assert.equal(planGalleryAssets(entries)[0].hero, true);

    const firstRun = assetsToCreate(planned, new Set());
    assert.equal(firstRun.length, planned.length);

    const existing = new Set(planned.map((asset) => asset.publicId));
    const secondRun = assetsToCreate(planned, existing);
    assert.equal(secondRun.length, 0);

    const gallery: CmsPhoto[] = planGalleryAssets(entries).map((asset) => ({
      publicId: asset.publicId,
      alt: "",
      order: asset.order,
      featured: asset.featured,
      hero: asset.hero,
      archived: false,
      hidden: false,
    }));
    assert.equal(verifyMigration({ gallery, hasLogo: true, hasSettings: true }).ok, true);
    assert.equal(verifyMigration({ gallery, hasLogo: false, hasSettings: true }).ok, false);
  });
});
