"use server";

import { cookies } from "next/headers";
import { updateTag } from "next/cache";
import { AuthError, createSessionValue, matchAccount, readAdminEnvOrThrow, sessionCookieOptions } from "@/lib/auth";
import { SESSION_TTL_SECONDS } from "@/lib/admin-env";
import { errorCategory, logAdminMutation } from "@/lib/admin-log";
import { shouldExpireCaches, tagsToExpire } from "@/lib/cache-tags";
import {
  getCloudName,
  getResource,
  listGalleryPhotos,
  persistPhoto,
  readSettings,
  readStudioLockRaw,
  uploadImageBuffer,
  writeSettingsWithBackup,
  writeStudioLockRaw,
} from "@/lib/cloudinary";
import {
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
  type CmsPhoto,
  type StudioLayoutPlan,
} from "@/lib/gallery-invariants";
import { persistPlannedPhotos } from "@/lib/persist-photo-plan";
import { requestIsHttps, requireAdmin } from "@/lib/require-admin";
import {
  DEFAULT_SETTINGS,
  LOGO_PUBLIC_ID,
  nextSettings,
  validateSettings,
} from "@/lib/site-settings";
import { newGalleryPublicId, validateImageUpload } from "@/lib/upload-policy";
import { logoUrl } from "@/lib/cloudinary-url";
import { logoWriteVerified, logoutCookiePatches } from "@/lib/write-verify";
import {
  STUDIO_STALE_ERROR,
  acquireStudioLock,
  expireAfterSuccess,
  galleryFingerprint,
  prepareSettingsSave,
  prepareUploadOnLiveList,
  releaseStudioLock,
} from "@/lib/studio-lock";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const GENERIC_LOGIN_ERROR = "Those details don't match.";

function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

function expire(kind: "gallery" | "settings" | "both") {
  for (const tag of tagsToExpire(kind)) {
    updateTag(tag);
  }
}

async function readLivePhotos() {
  return listGalleryPhotos();
}

const studioLockStore = {
  read: readStudioLockRaw,
  write: writeStudioLockRaw,
};

async function withStudioLock<T>(work: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  const token = crypto.randomUUID();
  const locked = await acquireStudioLock(token, studioLockStore);
  if (!locked.ok) return locked;
  try {
    return await work();
  } finally {
    await releaseStudioLock(token, studioLockStore).catch(() => undefined);
  }
}

export async function loginAction(formData: FormData): Promise<ActionResult> {
  try {
    const env = readAdminEnvOrThrow();
    const username = String(formData.get("username") ?? "");
    const password = String(formData.get("password") ?? "");
    const account = matchAccount(username, password, env);
    if (!account) {
      return fail(GENERIC_LOGIN_ERROR);
    }

    const isHttps = await requestIsHttps();
    const options = sessionCookieOptions(isHttps);
    const jar = await cookies();
    jar.set({
      name: options.name,
      value: createSessionValue(env, Date.now(), SESSION_TTL_SECONDS, account.username),
      httpOnly: options.httpOnly,
      secure: options.secure,
      sameSite: options.sameSite,
      path: options.path,
      maxAge: options.maxAge,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError || (error && typeof error === "object" && "name" in error && error.name === "AdminConfigError")) {
      return fail(GENERIC_LOGIN_ERROR);
    }
    return fail(GENERIC_LOGIN_ERROR);
  }
}

export async function logoutAction(): Promise<ActionResult> {
  const jar = await cookies();
  for (const patch of logoutCookiePatches()) {
    jar.set(patch);
  }
  return { ok: true };
}

export async function uploadPhotoAction(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) return fail("Choose a photo to upload.");

  const policy = validateImageUpload({ type: file.type, size: file.size, name: file.name });
  if (!policy.ok) return fail(policy.error);

  return withStudioLock(async () => {
    try {
      const photos = await readLivePhotos();
      const slot = prepareUploadOnLiveList(photos);
      if (!slot.ok) return fail(slot.error);

      const maxOrder = photos.reduce((max, photo) => Math.max(max, photo.order), -1);
      const publicId = newGalleryPublicId();
      const buffer = Buffer.from(await file.arrayBuffer());
      await uploadImageBuffer({
        buffer,
        publicId,
        context: { alt: "", order: String(maxOrder + 1) },
      });

      const verified = await getResource(publicId);
      if (!verified) {
        logAdminMutation({ type: "upload", publicId, ok: false, errorCategory: "verify" });
        return fail("The photo uploaded but could not be confirmed. Try again.");
      }

      if (shouldExpireCaches(true, true)) expireAfterSuccess(() => expire("gallery"));
      logAdminMutation({ type: "upload", publicId, ok: true });
      return { ok: true };
    } catch (error) {
      logAdminMutation({ type: "upload", ok: false, errorCategory: errorCategory(error) });
      return fail("The photo could not be added. Try again.");
    }
  });
}

export async function archivePhotoAction(publicId: string): Promise<ActionResult> {
  await requireAdmin();
  return applyPhotoPlan("archive", publicId, (photos) => applyArchive(photos, publicId));
}

export async function setFeaturedAction(publicId: string, featured: boolean): Promise<ActionResult> {
  await requireAdmin();
  return applyPhotoPlan("featured", publicId, (photos) => applySetFeatured(photos, publicId, featured));
}

export async function setHeroAction(publicId: string): Promise<ActionResult> {
  await requireAdmin();
  return applyPhotoPlan("hero", publicId, (photos) => applySetHero(photos, publicId));
}

export async function setAltAction(publicId: string, alt: string): Promise<ActionResult> {
  await requireAdmin();
  return applyPhotoPlan("alt", publicId, (photos) => applyAlt(photos, publicId, alt));
}

export async function reorderPhotosAction(
  orderedIds: string[],
  expectedFingerprint?: string,
): Promise<ActionResult> {
  await requireAdmin();
  return applyPhotoPlan("reorder", undefined, (photos) => applyReorder(photos, orderedIds), expectedFingerprint);
}

function asIdList(ids: unknown): string[] | null {
  if (!Array.isArray(ids) || ids.length === 0) return null;
  if (ids.some((id) => typeof id !== "string" || !id)) return null;
  return ids;
}

export async function setFeaturedManyAction(publicIds: string[], featured: boolean): Promise<ActionResult> {
  await requireAdmin();
  const ids = asIdList(publicIds);
  if (!ids) return fail("Choose photos first.");
  return applyPhotoPlan("featured-bulk", undefined, (photos) => applySetFeaturedMany(photos, ids, featured));
}

export async function archivePhotosAction(publicIds: string[]): Promise<ActionResult> {
  await requireAdmin();
  const ids = asIdList(publicIds);
  if (!ids) return fail("Choose photos first.");
  return applyPhotoPlan("archive-bulk", undefined, (photos) => applyArchiveMany(photos, ids));
}

export async function setHiddenAction(publicId: string, hidden: boolean): Promise<ActionResult> {
  await requireAdmin();
  return applyPhotoPlan("hidden", publicId, (photos) => applySetHidden(photos, publicId, hidden));
}

export async function setHiddenManyAction(publicIds: string[], hidden: boolean): Promise<ActionResult> {
  await requireAdmin();
  const ids = asIdList(publicIds);
  if (!ids) return fail("Choose photos first.");
  return applyPhotoPlan("hidden-bulk", undefined, (photos) => applySetHiddenMany(photos, ids, hidden));
}

export async function applyStudioLayoutAction(
  plan: StudioLayoutPlan,
  expectedFingerprint?: string,
): Promise<ActionResult> {
  await requireAdmin();
  if (!Array.isArray(plan?.orderedIds) || !Array.isArray(plan?.hiddenIds) || !Array.isArray(plan?.featuredIds)) {
    return fail("Photo order does not match the live gallery.");
  }
  return applyPhotoPlan("studio-layout", undefined, (photos) => applyStudioLayout(photos, plan), expectedFingerprint);
}

async function applyPhotoPlan(
  type: string,
  publicId: string | undefined,
  plan: (photos: CmsPhoto[]) => ReturnType<typeof applySetHero>,
  expectedFingerprint?: string,
): Promise<ActionResult> {
  return withStudioLock(async () => {
    try {
      const photos = await readLivePhotos();
      if (expectedFingerprint && galleryFingerprint(photos) !== expectedFingerprint) {
        return fail(STUDIO_STALE_ERROR);
      }

      const planned = plan(photos);
      if (!planned.ok) return fail(planned.error);

      const before = new Map(photos.map((photo) => [photo.publicId, photo]));
      const persisted = await persistPlannedPhotos({
        before,
        planned: planned.value,
        persist: persistPhoto,
      });
      if (!persisted.ok) {
        if (persisted.incompleteRollback && shouldExpireCaches(true, true)) {
          expireAfterSuccess(() => expire("gallery"));
        }
        logAdminMutation({
          type,
          publicId,
          ok: false,
          errorCategory: persisted.incompleteRollback ? "rollback" : "verify",
        });
        return fail("That change could not be saved. Try again.");
      }

      if (shouldExpireCaches(true, true)) expireAfterSuccess(() => expire("gallery"));
      logAdminMutation({ type, publicId, ok: true });
      return { ok: true };
    } catch (error) {
      if (error instanceof AuthError) throw error;
      logAdminMutation({ type, publicId, ok: false, errorCategory: errorCategory(error) });
      return fail("That change could not be saved. Try again.");
    }
  });
}

export async function saveSettingsAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = validateSettings(input);
  if (!parsed.ok) return fail(parsed.error);

  return withStudioLock(async () => {
    try {
      const current = (await readSettings()) ?? DEFAULT_SETTINGS;
      const revision = prepareSettingsSave(parsed.value, current);
      if (!revision.ok) return fail(revision.error);

      const { revision: _ignored, ...fields } = parsed.value;
      const next = nextSettings(current, fields);
      await writeSettingsWithBackup(next, current);
      if (shouldExpireCaches(true, true)) expireAfterSuccess(() => expire("settings"));
      logAdminMutation({ type: "settings", ok: true });
      return { ok: true };
    } catch (error) {
      if (error instanceof AuthError) throw error;
      logAdminMutation({ type: "settings", ok: false, errorCategory: errorCategory(error) });
      return fail("Those details could not be saved. Try again.");
    }
  });
}

export async function replaceLogoAction(formData: FormData): Promise<ActionResult<{ logoSrc: string }>> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) return fail("Choose a logo image.");
  const policy = validateImageUpload({ type: file.type, size: file.size, name: file.name });
  if (!policy.ok) return fail(policy.error);

  return withStudioLock(async (): Promise<ActionResult<{ logoSrc: string }>> => {
    try {
      const before = await getResource(LOGO_PUBLIC_ID);
      const buffer = Buffer.from(await file.arrayBuffer());
      await uploadImageBuffer({
        buffer,
        publicId: LOGO_PUBLIC_ID,
        overwrite: true,
      });
      const verified = await getResource(LOGO_PUBLIC_ID);
      if (!verified || !logoWriteVerified(before, verified)) {
        return fail("The logo uploaded but could not be confirmed. Try again.");
      }
      if (shouldExpireCaches(true, true)) expireAfterSuccess(() => expire("settings"));
      logAdminMutation({ type: "logo", publicId: LOGO_PUBLIC_ID, ok: true });
      return { ok: true, data: { logoSrc: logoUrl(getCloudName(), LOGO_PUBLIC_ID, verified.version) } };
    } catch (error) {
      logAdminMutation({ type: "logo", publicId: LOGO_PUBLIC_ID, ok: false, errorCategory: errorCategory(error) });
      return fail("The logo could not be replaced. Try again.");
    }
  });
}

