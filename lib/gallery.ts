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

/** Sue's best work, always pinned to the ring around the central contact block. */
const featuredPool: GalleryImage[] = galleryImages.filter((img) => img.featured);

// The chosen hero image leads the featured strip underneath the contact card,
// with the remaining featured photos following in their original order.
const FEATURED_FIRST_SRC = "/gallery/sue-01.jpg";
export const featuredImages: GalleryImage[] = [
  ...featuredPool.filter((img) => img.src === FEATURED_FIRST_SRC),
  ...featuredPool.filter((img) => img.src !== FEATURED_FIRST_SRC),
];

/** Everything else, used to fill and rotate through the remaining desktop tiles. */
export const rotatingImages: GalleryImage[] = galleryImages.filter((img) => !img.featured);
