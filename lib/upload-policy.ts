export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export type PolicyError = { ok: false; error: string };
export type PolicyOk = { ok: true };

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

export function validateImageUpload(input: {
  type: string;
  size: number;
  name: string;
}): PolicyOk | PolicyError {
  if (input.size <= 0) {
    return { ok: false, error: "Choose a photo to upload." };
  }
  if (input.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Photos need to be 8 MB or smaller." };
  }
  if (!ALLOWED_IMAGE_TYPES.has(input.type) && !ALLOWED_EXTENSIONS.has(extensionOf(input.name))) {
    return { ok: false, error: "Use a JPG, PNG, or WebP photo." };
  }
  if (input.type && !ALLOWED_IMAGE_TYPES.has(input.type) && input.type !== "application/octet-stream") {
    return { ok: false, error: "Use a JPG, PNG, or WebP photo." };
  }
  return { ok: true };
}

export function newGalleryPublicId(): string {
  return `facepaintingbysue/gallery/${crypto.randomUUID()}`;
}
