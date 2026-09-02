import type { GalleryImage } from "./gallery";
import { cmsPhotosFromImages, featuredForMosaic, mergePlannedImages, rotatingImages } from "./gallery";
import {
  FEATURED_CAP,
  SHARE_UNPIN_ERROR,
  applyStudioLayout,
  type MutationResult,
  type StudioLayoutPlan,
} from "./gallery-invariants";
import { FEATURED_CELLS, ROTATING_CELLS } from "./mosaic-layout";

export type MosaicKind = "featured" | "rotating";

export interface MosaicSnapshot {
  featuredSlots: (GalleryImage | null)[];
  rotatingSlots: (GalleryImage | null)[];
  leftover: GalleryImage[];
  hidden: GalleryImage[];
}

export type DropSource =
  | { from: MosaicKind; index: number }
  | { from: "tray"; publicId: string };

export type DropDest =
  | { to: MosaicKind; index: number }
  | { to: "tray" };

export function studioMutationAllowed(pending: boolean): boolean {
  return !pending;
}

function padSlots(images: GalleryImage[], length: number): (GalleryImage | null)[] {
  return Array.from({ length }, (_, index) => images[index] ?? null);
}

export function mosaicSnapshot(images: GalleryImage[]): MosaicSnapshot {
  const hidden = images.filter((image) => image.hidden);
  const visible = images.filter((image) => !image.hidden);
  const featured = featuredForMosaic(visible);
  const rotating = rotatingImages(visible, featured);
  return {
    featuredSlots: padSlots(featured, FEATURED_CELLS.length),
    rotatingSlots: padSlots(rotating.slice(0, ROTATING_CELLS.length), ROTATING_CELLS.length),
    leftover: rotating.slice(ROTATING_CELLS.length),
    hidden,
  };
}

export function planFromSnapshot(snapshot: MosaicSnapshot): StudioLayoutPlan {
  const featuredIds = snapshot.featuredSlots
    .filter((image): image is GalleryImage => Boolean(image))
    .map((image) => image.publicId);
  const rotatingIds = snapshot.rotatingSlots
    .filter((image): image is GalleryImage => Boolean(image))
    .map((image) => image.publicId);
  const leftoverIds = snapshot.leftover.map((image) => image.publicId);
  const hiddenIds = snapshot.hidden.map((image) => image.publicId);
  return {
    orderedIds: [...featuredIds, ...rotatingIds, ...leftoverIds, ...hiddenIds],
    hiddenIds,
    featuredIds,
  };
}

function slotOf(snapshot: MosaicSnapshot, kind: MosaicKind): (GalleryImage | null)[] {
  return kind === "featured" ? snapshot.featuredSlots : snapshot.rotatingSlots;
}

function takeSource(snapshot: MosaicSnapshot, source: DropSource): GalleryImage | null {
  if (source.from === "tray") {
    return snapshot.hidden.find((image) => image.publicId === source.publicId) ?? null;
  }
  return slotOf(snapshot, source.from)[source.index] ?? null;
}

export function proposeStudioDrop(
  images: GalleryImage[],
  source: DropSource,
  dest: DropDest,
): MutationResult<{ plan: StudioLayoutPlan; images: GalleryImage[] }> {
  const snapshot = mosaicSnapshot(images);
  const moving = takeSource(snapshot, source);
  if (!moving) return { ok: false, error: "That photo is not in the live gallery." };

  if (dest.to === "tray") {
    if (source.from === "tray") {
      return applyDropPlan(images, planFromSnapshot(snapshot));
    }
    slotOf(snapshot, source.from)[source.index] = null;
    snapshot.hidden = [moving, ...snapshot.hidden.filter((image) => image.publicId !== moving.publicId)];
    return applyDropPlan(images, planFromSnapshot(snapshot));
  }

  if (moving.hero && dest.to === "rotating") {
    return { ok: false, error: SHARE_UNPIN_ERROR };
  }

  const destSlots = slotOf(snapshot, dest.to);
  const occupant = destSlots[dest.index] ?? null;
  if (occupant?.publicId === moving.publicId) {
    return applyDropPlan(images, planFromSnapshot(snapshot));
  }

  if (source.from === "tray") {
    snapshot.hidden = snapshot.hidden.filter((image) => image.publicId !== moving.publicId);
    destSlots[dest.index] = moving;
    if (occupant) {
      if (dest.to === "featured" && featuredOccupantCount(snapshot) > FEATURED_CAP) {
        snapshot.leftover = [occupant, ...snapshot.leftover];
      } else {
        snapshot.leftover = [occupant, ...snapshot.leftover];
      }
    }
    return applyDropPlan(images, planFromSnapshot(snapshot));
  }

  const sourceSlots = slotOf(snapshot, source.from);
  if (occupant) {
    sourceSlots[source.index] = occupant;
    destSlots[dest.index] = moving;
  } else {
    sourceSlots[source.index] = null;
    destSlots[dest.index] = moving;
  }

  return applyDropPlan(images, planFromSnapshot(snapshot));
}

function featuredOccupantCount(snapshot: MosaicSnapshot): number {
  return snapshot.featuredSlots.filter(Boolean).length;
}

export function applyDropPlan(
  images: GalleryImage[],
  plan: StudioLayoutPlan,
): MutationResult<{ plan: StudioLayoutPlan; images: GalleryImage[] }> {
  const planned = applyStudioLayout(cmsPhotosFromImages(images), plan);
  if (!planned.ok) return planned;
  return { ok: true, value: { plan, images: mergePlannedImages(images, planned.value) } };
}

export function proposeGroupMove(
  images: GalleryImage[],
  publicId: string,
  dest: "shown" | "hidden",
  beforeId?: string | null,
): MutationResult<{ plan: StudioLayoutPlan; images: GalleryImage[] }> {
  const moving = images.find((image) => image.publicId === publicId);
  if (!moving) return { ok: false, error: "That photo is not in the live gallery." };
  const photo = moving;

  const shown = images.filter((image) => !image.hidden && image.publicId !== publicId);
  const hidden = images.filter((image) => image.hidden && image.publicId !== publicId);

  function insert(list: GalleryImage[]): GalleryImage[] {
    if (!beforeId) return [...list, photo];
    const index = list.findIndex((image) => image.publicId === beforeId);
    if (index < 0) return [...list, photo];
    return [...list.slice(0, index), photo, ...list.slice(index)];
  }

  const nextShown = dest === "shown" ? insert(shown) : shown;
  const nextHidden = dest === "hidden" ? insert(hidden) : hidden;
  const featuredIds = nextShown.filter((image) => image.featured).map((image) => image.publicId);

  return applyDropPlan(images, {
    orderedIds: [...nextShown, ...nextHidden].map((image) => image.publicId),
    hiddenIds: nextHidden.map((image) => image.publicId),
    featuredIds,
  });
}
