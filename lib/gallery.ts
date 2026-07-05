import manifest from "./gallery-data.json";

export interface GalleryImage {
  src: string;
  featured: boolean;
  index: number;
  alt: string;
}

const DESIGN_LABELS = [
  "Colourful face-painting design by Sue",
  "Face-painting artwork by Facepainting by Sue",
  "Fun face paint design by Sue",
  "Face-painting at a Burton upon Trent event",
];

function altFor(i: number): string {
  return DESIGN_LABELS[i % DESIGN_LABELS.length];
}

/** Full, deduped set of Sue's photos (featured high-res first). Used by the lightbox. */
export const galleryImages: GalleryImage[] = manifest.map((m, index) => ({
  src: m.src,
  featured: m.featured,
  index,
  alt: altFor(index),
}));

/** Number of photo tiles surrounding the central contact block on desktop (6x6 grid minus the 4x2 centre). */
export const DESKTOP_TILE_COUNT = 28;

/**
 * Returns exactly `count` tile images, cycling through the available photos if there
 * are fewer than requested so the grid always fills completely. Featured photos come
 * first so Sue's best work is shown prominently.
 */
export function getTileImages(count: number = DESKTOP_TILE_COUNT): GalleryImage[] {
  if (galleryImages.length === 0) return [];
  return Array.from({ length: count }, (_, i) => galleryImages[i % galleryImages.length]);
}
