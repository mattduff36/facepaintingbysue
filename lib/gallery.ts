import type { CmsPhoto } from "./gallery-invariants";
import { FEATURED_CAP, normalizePublished, publishedPhotos, sortPhotos } from "./gallery-invariants";
import { lightboxUrl, tileUrl } from "./cloudinary-url";

export interface GalleryImage {
  publicId: string;
  src: string;
  lightboxSrc: string;
  featured: boolean;
  hero: boolean;
  hidden: boolean;
  index: number;
  alt: string;
  storedAlt?: string;
  order: number;
  version?: number;
}

const DESIGN_LABELS = [
  "Colourful face-painting design by Sue",
  "Face-painting artwork by Facepainting by Sue",
  "Fun face paint design by Sue",
  "Face-painting at a Burton upon Trent event",
];

export function altFor(index: number, stored?: string): string {
  if (stored && stored.trim()) return stored.trim();
  return DESIGN_LABELS[index % DESIGN_LABELS.length];
}

function toMappedImage(photo: CmsPhoto, index: number, cloudName: string): GalleryImage {
  return {
    publicId: photo.publicId,
    src: tileUrl(cloudName, photo.publicId, photo.version),
    lightboxSrc: lightboxUrl(cloudName, photo.publicId, photo.version),
    featured: photo.featured,
    hero: photo.hero,
    hidden: photo.hidden,
    index,
    alt: altFor(index, photo.alt),
    storedAlt: photo.alt ?? "",
    order: photo.order,
    version: photo.version,
  };
}

/** Public homepage and lightbox: visible photos only. */
export function toGalleryImages(photos: CmsPhoto[], cloudName: string): GalleryImage[] {
  const normalized = normalizePublished(photos);
  return normalized.map((photo, index) => toMappedImage({ ...photo, hidden: false }, index, cloudName));
}

/** Admin studio: every non-archived photo, including hidden ones. */
export function toAdminGalleryImages(photos: CmsPhoto[], cloudName: string): GalleryImage[] {
  return sortPhotos(publishedPhotos(photos)).map((photo, index) => toMappedImage(photo, index, cloudName));
}

export function featuredForMosaic(images: GalleryImage[]): GalleryImage[] {
  const visible = images.filter((image) => !image.hidden);
  const featured = [...visible.filter((image) => image.featured)].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.publicId.localeCompare(b.publicId);
  });
  if (featured.length >= FEATURED_CAP) return featured.slice(0, FEATURED_CAP);

  const used = new Set(featured.map((image) => image.publicId));
  const padded = [...featured];
  for (const image of visible) {
    if (padded.length >= FEATURED_CAP) break;
    if (used.has(image.publicId)) continue;
    padded.push(image);
    used.add(image.publicId);
  }
  return padded;
}

export function rotatingImages(images: GalleryImage[], featured: GalleryImage[]): GalleryImage[] {
  const featuredIds = new Set(featured.map((image) => image.publicId));
  return images.filter((image) => !image.hidden && !featuredIds.has(image.publicId));
}

export function heroImage(images: GalleryImage[]): GalleryImage | undefined {
  return images.find((image) => image.hero && !image.hidden) ?? images.find((image) => !image.hidden);
}

export function cmsPhotosFromImages(images: GalleryImage[]): CmsPhoto[] {
  return images.map((image) => ({
    publicId: image.publicId,
    alt: image.alt,
    order: image.order,
    featured: image.featured,
    hero: image.hero,
    archived: false,
    hidden: image.hidden,
  }));
}

/** When Cloudinary is configured, never substitute the local seed gallery (it cannot honour hidden). */
export function publicImagesWhenSourceFails<T>(cloudinaryConfigured: boolean, localImages: T[]): T[] {
  return cloudinaryConfigured ? [] : localImages;
}

export function mergePlannedImages(images: GalleryImage[], planned: CmsPhoto[]): GalleryImage[] {
  const previous = new Map(images.map((image) => [image.publicId, image]));
  return sortPhotos(publishedPhotos(planned)).map((photo, index) => {
    const current = previous.get(photo.publicId);
    return {
      publicId: photo.publicId,
      src: current?.src ?? "",
      lightboxSrc: current?.lightboxSrc ?? "",
      featured: photo.featured,
      hero: photo.hero,
      hidden: photo.hidden,
      index,
      alt: photo.alt || current?.alt || "",
      order: photo.order,
    };
  });
}

export { sortPhotos };
