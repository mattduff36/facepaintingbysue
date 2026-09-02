import type { GalleryImage } from "@/lib/gallery";

export type StudioRun = (
  label: string,
  work: () => Promise<{ ok: boolean; error?: string }>,
  next?: GalleryImage[],
) => void;
