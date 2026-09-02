import "server-only";

import { v2 as cloudinary, type ResourceApiResponse, type UploadApiResponse } from "cloudinary";
import {
  GALLERY_HARD_CAP,
  photoFromRecord,
  type CmsPhoto,
  tagsFor,
} from "./gallery-invariants";
import { GALLERY_PREFIX } from "./cloudinary-url";
import {
  SETTINGS_BACKUP_PUBLIC_ID,
  SETTINGS_PUBLIC_ID,
  parseSettingsJson,
  type SiteSettings,
} from "./site-settings";
import { STUDIO_LOCK_PUBLIC_ID } from "./studio-lock";
import { writeSettingsPipeline } from "./write-verify";

export class CloudinaryConfigError extends Error {
  constructor() {
    super("Cloudinary is not configured");
    this.name = "CloudinaryConfigError";
  }
}

function cloudinaryHttpCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const direct = "http_code" in error ? error.http_code : undefined;
  if (typeof direct === "number") return direct;
  const nested = "error" in error ? (error as { error?: { http_code?: unknown } }).error?.http_code : undefined;
  return typeof nested === "number" ? nested : undefined;
}

export class GalleryOverflowError extends Error {
  constructor() {
    super("Gallery listing exceeded the 500-image cap");
    this.name = "GalleryOverflowError";
  }
}

function cloudinaryEnv() {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) {
    throw new CloudinaryConfigError();
  }
  return { cloud_name, api_key, api_secret };
}

export function getCloudName(): string {
  return cloudinaryEnv().cloud_name;
}

function configured() {
  cloudinary.config({
    ...cloudinaryEnv(),
    secure: true,
  });
  return cloudinary;
}

interface CloudinaryResource {
  public_id: string;
  version?: number;
  tags?: string[];
  context?: { custom?: Record<string, string> } & Record<string, string | undefined>;
  next_cursor?: string;
}

function contextValue(resource: CloudinaryResource, key: string): string {
  const custom = resource.context?.custom;
  if (custom && typeof custom[key] === "string") return custom[key];
  const direct = resource.context?.[key];
  return typeof direct === "string" ? direct : "";
}

export function resourceToPhoto(resource: CloudinaryResource): CmsPhoto {
  const orderRaw = contextValue(resource, "order");
  const order = Number.parseInt(orderRaw, 10);
  return photoFromRecord({
    publicId: resource.public_id,
    alt: contextValue(resource, "alt"),
    order: Number.isFinite(order) ? order : 0,
    tags: resource.tags ?? [],
    version: resource.version,
  });
}

export async function listGalleryPhotos(): Promise<CmsPhoto[]> {
  const cld = configured();
  const photos: CmsPhoto[] = [];
  let nextCursor: string | undefined;

  do {
    const result = (await cld.api.resources({
      type: "upload",
      resource_type: "image",
      prefix: `${GALLERY_PREFIX}/`,
      max_results: 500,
      context: true,
      tags: true,
      next_cursor: nextCursor,
    })) as ResourceApiResponse & { resources: CloudinaryResource[]; next_cursor?: string };

    for (const resource of result.resources ?? []) {
      photos.push(resourceToPhoto(resource));
      if (photos.length > GALLERY_HARD_CAP) {
        console.warn(JSON.stringify({ evt: "admin.mutation", type: "list", ok: false, errorCategory: "overflow" }));
        throw new GalleryOverflowError();
      }
    }

    nextCursor = result.next_cursor;
    if (nextCursor && photos.length >= GALLERY_HARD_CAP) {
      console.warn(JSON.stringify({ evt: "admin.mutation", type: "list", ok: false, errorCategory: "overflow" }));
      throw new GalleryOverflowError();
    }
  } while (nextCursor);

  return photos;
}

export async function getResource(publicId: string): Promise<CmsPhoto | null> {
  const cld = configured();
  try {
    const resource = (await cld.api.resource(publicId, {
      context: true,
      tags: true,
    })) as CloudinaryResource;
    return resourceToPhoto(resource);
  } catch (error) {
    if (cloudinaryHttpCode(error) === 404) {
      return null;
    }
    throw error;
  }
}

export async function persistPhoto(photo: CmsPhoto): Promise<CmsPhoto> {
  const cld = configured();
  await cld.api.update(photo.publicId, {
    tags: tagsFor(photo),
    context: { alt: escapeContext(photo.alt), order: String(photo.order) },
    invalidate: true,
  });
  const verified = await getResource(photo.publicId);
  if (!verified) throw new Error("Cloudinary update could not be verified");
  return verified;
}

function escapeContext(value: string): string {
  return value.replace(/[|=]/g, " ");
}

export async function uploadImageBuffer(options: {
  buffer: Buffer;
  publicId: string;
  overwrite?: boolean;
  tags?: string[];
  context?: Record<string, string>;
}): Promise<UploadApiResponse> {
  const cld = configured();
  return new Promise((resolve, reject) => {
    const stream = cld.uploader.upload_stream(
      {
        public_id: options.publicId,
        resource_type: "image",
        overwrite: options.overwrite ?? false,
        invalidate: true,
        tags: options.tags,
        context: options.context,
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error("Cloudinary upload returned no response"));
        resolve(result);
      },
    );
    stream.end(options.buffer);
  });
}

export async function uploadRawJson(publicId: string, json: string, overwrite = true): Promise<void> {
  const cld = configured();
  const dataUri = `data:application/json;base64,${Buffer.from(json, "utf8").toString("base64")}`;
  await cld.uploader.upload(dataUri, {
    public_id: publicId,
    resource_type: "raw",
    overwrite,
    invalidate: true,
  });
}

export async function readStudioLockRaw(): Promise<string | null> {
  return downloadRaw(STUDIO_LOCK_PUBLIC_ID);
}

export async function writeStudioLockRaw(json: string): Promise<void> {
  await uploadRawJson(STUDIO_LOCK_PUBLIC_ID, json, true);
}

async function downloadRaw(publicId: string): Promise<string | null> {
  const cld = configured();
  try {
    const resource = await cld.api.resource(publicId, { resource_type: "raw" });
    const url = typeof resource.secure_url === "string" ? resource.secure_url : null;
    if (!url) return null;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    return await response.text();
  } catch (error) {
    if (cloudinaryHttpCode(error) === 404) {
      return null;
    }
    throw error;
  }
}

export async function readSettings(): Promise<SiteSettings | null> {
  const raw = await downloadRaw(SETTINGS_PUBLIC_ID);
  if (!raw) return null;
  const parsed = parseSettingsJson(raw);
  return parsed.ok ? parsed.value : null;
}

export async function writeSettingsWithBackup(next: SiteSettings, previous: SiteSettings | null): Promise<void> {
  try {
    await writeSettingsPipeline({
      next,
      previous,
      writeBackup: (settings) => uploadRawJson(SETTINGS_BACKUP_PUBLIC_ID, JSON.stringify(settings), true),
      readBackup: async () => {
        const raw = await downloadRaw(SETTINGS_BACKUP_PUBLIC_ID);
        if (!raw) return null;
        const parsed = parseSettingsJson(raw);
        return parsed.ok ? parsed.value : null;
      },
      writeMain: (settings) => uploadRawJson(SETTINGS_PUBLIC_ID, JSON.stringify(settings), true),
      readMain: readSettings,
    });
  } catch (error) {
    if (previous) {
      await uploadRawJson(SETTINGS_PUBLIC_ID, JSON.stringify(previous), true).catch(() => undefined);
    }
    throw error;
  }
}

export function resourceExistsError(error: unknown): boolean {
  return cloudinaryHttpCode(error) === 409;
}
