export const FEATURED_CAP = 8;
export const GALLERY_HARD_CAP = 500;
export const ARCHIVED_TAG = "archived";
export const FEATURED_TAG = "featured";
export const HERO_TAG = "hero";
export const HIDDEN_TAG = "hidden";

export const SHOW_FIRST_ERROR = "Show this photo first.";
export const KEEP_VISIBLE_ERROR = "Keep at least one photo on the site.";
export const SHARE_UNPIN_ERROR = "Choose another share photo before unpinning this one.";
export const NOT_LIVE_ERROR = "That photo is not in the live gallery.";
export const FEATURED_CAP_ERROR = "You can pin up to eight featured photos. Unpin one first.";
export const SHARE_CAP_ERROR = "The share photo must be one of the eight featured photos. Unpin another first.";
export const ORDER_MISMATCH_ERROR = "Photo order does not match the live gallery.";
export const CHOOSE_PHOTOS_ERROR = "Choose photos first.";

export interface CmsPhoto {
  publicId: string;
  alt: string;
  order: number;
  featured: boolean;
  hero: boolean;
  archived: boolean;
  hidden: boolean;
  version?: number;
}

export interface StudioLayoutPlan {
  orderedIds: string[];
  hiddenIds: string[];
  featuredIds: string[];
}

export type MutationOk<T> = { ok: true; value: T };
export type MutationErr = { ok: false; error: string };
export type MutationResult<T> = MutationOk<T> | MutationErr;

function err(error: string): MutationErr {
  return { ok: false, error };
}

export function photoFromRecord(input: {
  publicId: string;
  alt: string;
  order: number;
  tags: string[];
  version?: number;
}): CmsPhoto {
  const tags = input.tags;
  return {
    publicId: input.publicId,
    alt: input.alt,
    order: input.order,
    featured: tags.includes(FEATURED_TAG) || tags.includes(HERO_TAG),
    hero: tags.includes(HERO_TAG),
    archived: tags.includes(ARCHIVED_TAG),
    hidden: tags.includes(HIDDEN_TAG),
    version: input.version,
  };
}

export function publishedPhotos(photos: CmsPhoto[]): CmsPhoto[] {
  return photos.filter((photo) => !photo.archived);
}

export function visiblePhotos(photos: CmsPhoto[]): CmsPhoto[] {
  return publishedPhotos(photos).filter((photo) => !photo.hidden);
}

export function sortPhotos(photos: CmsPhoto[]): CmsPhoto[] {
  return [...photos].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.publicId.localeCompare(b.publicId);
  });
}

function featuredCountVisible(photos: CmsPhoto[]): number {
  return visiblePhotos(photos).filter((photo) => photo.featured || photo.hero).length;
}

function requireLiveVisible(target: CmsPhoto | undefined): MutationErr | null {
  if (!target || target.archived) return err(NOT_LIVE_ERROR);
  if (target.hidden) return err(SHOW_FIRST_ERROR);
  return null;
}

function rejectHiddenTargets(photos: CmsPhoto[], publicIds: string[]): MutationErr | null {
  const hiddenLive = publicIds.some((id) => {
    const target = photos.find((photo) => photo.publicId === id);
    return Boolean(target && !target.archived && target.hidden);
  });
  return hiddenLive ? err(SHOW_FIRST_ERROR) : null;
}

/** Public-facing normalization: at most 8 featured, exactly one hero among visible photos. */
export function normalizePublished(photos: CmsPhoto[]): CmsPhoto[] {
  const visible = sortPhotos(visiblePhotos(photos)).map((photo) => ({
    ...photo,
    featured: false,
    hero: false,
  }));
  if (visible.length === 0) return [];

  const source = new Map(visiblePhotos(photos).map((photo) => [photo.publicId, photo]));
  const featuredIds = visible
    .filter((photo) => source.get(photo.publicId)?.featured || source.get(photo.publicId)?.hero)
    .map((photo) => photo.publicId);

  const taggedHeroes = visible.filter((photo) => source.get(photo.publicId)?.hero);
  const heroId =
    taggedHeroes[0]?.publicId ??
    featuredIds[0] ??
    visible[0].publicId;

  const nextFeatured = new Set<string>([heroId]);
  for (const id of featuredIds) {
    if (nextFeatured.size >= FEATURED_CAP) break;
    nextFeatured.add(id);
  }

  return visible.map((photo) => ({
    ...photo,
    hero: photo.publicId === heroId,
    featured: nextFeatured.has(photo.publicId),
  }));
}

function promoteVisibleHero(photos: CmsPhoto[]): MutationResult<CmsPhoto[]> {
  const visible = sortPhotos(visiblePhotos(photos));
  if (visible.length === 0) return err(KEEP_VISIBLE_ERROR);
  if (visible.some((photo) => photo.hero)) return { ok: true, value: photos };
  const replacement = visible.find((photo) => photo.featured) ?? visible[0];
  return applySetHero(photos, replacement.publicId);
}

export function applySetFeatured(
  photos: CmsPhoto[],
  publicId: string,
  featured: boolean,
): MutationResult<CmsPhoto[]> {
  const target = photos.find((photo) => photo.publicId === publicId);
  const blocked = requireLiveVisible(target);
  if (blocked) return blocked;

  if (featured) {
    if (!target!.featured && !target!.hero && featuredCountVisible(photos) >= FEATURED_CAP) {
      return err(FEATURED_CAP_ERROR);
    }
    return {
      ok: true,
      value: photos.map((photo) =>
        photo.publicId === publicId ? { ...photo, featured: true } : photo,
      ),
    };
  }

  if (target!.hero) {
    return err(SHARE_UNPIN_ERROR);
  }

  return {
    ok: true,
    value: photos.map((photo) =>
      photo.publicId === publicId ? { ...photo, featured: false } : photo,
    ),
  };
}

export function applySetHero(
  photos: CmsPhoto[],
  publicId: string,
): MutationResult<CmsPhoto[]> {
  const target = photos.find((photo) => photo.publicId === publicId);
  const blocked = requireLiveVisible(target);
  if (blocked) return blocked;

  if (!target!.featured && !target!.hero && featuredCountVisible(photos) >= FEATURED_CAP) {
    return err(SHARE_CAP_ERROR);
  }

  return {
    ok: true,
    value: photos.map((photo) => {
      if (photo.publicId === publicId) {
        return { ...photo, hero: true, featured: true };
      }
      return photo.hero ? { ...photo, hero: false } : photo;
    }),
  };
}

export function applyArchive(
  photos: CmsPhoto[],
  publicId: string,
): MutationResult<CmsPhoto[]> {
  const target = photos.find((photo) => photo.publicId === publicId);
  const blocked = requireLiveVisible(target);
  if (blocked) return blocked;

  if (visiblePhotos(photos).length <= 1) {
    return err(KEEP_VISIBLE_ERROR);
  }

  let next = photos.map((photo) =>
    photo.publicId === publicId
      ? { ...photo, archived: true, featured: false, hero: false, hidden: false }
      : photo,
  );

  if (target!.hero) {
    const promoted = promoteVisibleHero(next);
    if (!promoted.ok) return promoted;
    next = promoted.value;
  }

  return { ok: true, value: next };
}

export function applyReorder(
  photos: CmsPhoto[],
  orderedIds: string[],
): MutationResult<CmsPhoto[]> {
  const live = publishedPhotos(photos);
  const liveIds = new Set(live.map((photo) => photo.publicId));
  if (orderedIds.length !== live.length || orderedIds.some((id) => !liveIds.has(id))) {
    return err(ORDER_MISMATCH_ERROR);
  }
  if (new Set(orderedIds).size !== orderedIds.length) {
    return err(ORDER_MISMATCH_ERROR);
  }

  const orderById = new Map(orderedIds.map((id, index) => [id, index]));
  return {
    ok: true,
    value: photos.map((photo) =>
      orderById.has(photo.publicId)
        ? { ...photo, order: orderById.get(photo.publicId)! }
        : photo,
    ),
  };
}

export function applyAlt(
  photos: CmsPhoto[],
  publicId: string,
  alt: string,
): MutationResult<CmsPhoto[]> {
  const target = photos.find((photo) => photo.publicId === publicId);
  const blocked = requireLiveVisible(target);
  if (blocked) return blocked;
  if (alt.length > 160) return err("Keep photo descriptions under 160 characters.");
  return {
    ok: true,
    value: photos.map((photo) =>
      photo.publicId === publicId ? { ...photo, alt } : photo,
    ),
  };
}

export function applyUploadSlot(photos: CmsPhoto[]): MutationResult<true> {
  if (photos.length >= GALLERY_HARD_CAP) {
    return err("The gallery is full (500 photos). Remove one before adding another.");
  }
  return { ok: true, value: true };
}

export function applySetHidden(
  photos: CmsPhoto[],
  publicId: string,
  hidden: boolean,
): MutationResult<CmsPhoto[]> {
  const target = photos.find((photo) => photo.publicId === publicId);
  if (!target || target.archived) return err(NOT_LIVE_ERROR);
  if (target.hidden === hidden) return { ok: true, value: photos };

  if (hidden) {
    if (visiblePhotos(photos).length <= 1) return err(KEEP_VISIBLE_ERROR);
    let next = photos.map((photo) =>
      photo.publicId === publicId
        ? { ...photo, hidden: true, featured: false, hero: false }
        : photo,
    );
    if (target.hero) {
      const promoted = promoteVisibleHero(next);
      if (!promoted.ok) return promoted;
      next = promoted.value;
    }
    return { ok: true, value: next };
  }

  return {
    ok: true,
    value: photos.map((photo) =>
      photo.publicId === publicId ? { ...photo, hidden: false } : photo,
    ),
  };
}

export function applySetHiddenMany(
  photos: CmsPhoto[],
  publicIds: string[],
  hidden: boolean,
): MutationResult<CmsPhoto[]> {
  const unique = [...new Set(publicIds)];
  if (unique.length === 0) return err(CHOOSE_PHOTOS_ERROR);

  const liveTargets = unique
    .map((id) => photos.find((photo) => photo.publicId === id))
    .filter((photo): photo is CmsPhoto => Boolean(photo && !photo.archived));
  if (liveTargets.length === 0) return err(NOT_LIVE_ERROR);

  let next = photos;
  if (hidden) {
    const toHide = liveTargets.filter((photo) => !photo.hidden);
    if (visiblePhotos(photos).length - toHide.length < 1) {
      return err(KEEP_VISIBLE_ERROR);
    }
    const heroLast = [
      ...toHide.filter((photo) => !photo.hero),
      ...toHide.filter((photo) => photo.hero),
    ];
    for (const photo of heroLast) {
      const result = applySetHidden(next, photo.publicId, true);
      if (!result.ok) return result;
      next = result.value;
    }
    return { ok: true, value: next };
  }

  for (const photo of liveTargets.filter((item) => item.hidden)) {
    const result = applySetHidden(next, photo.publicId, false);
    if (!result.ok) return result;
    next = result.value;
  }
  return { ok: true, value: next };
}

export function applyStudioLayout(
  photos: CmsPhoto[],
  plan: StudioLayoutPlan,
): MutationResult<CmsPhoto[]> {
  const live = publishedPhotos(photos);
  const liveIds = new Set(live.map((photo) => photo.publicId));
  const orderedIds = plan.orderedIds;
  if (orderedIds.length !== live.length || orderedIds.some((id) => !liveIds.has(id))) {
    return err(ORDER_MISMATCH_ERROR);
  }
  if (new Set(orderedIds).size !== orderedIds.length) {
    return err(ORDER_MISMATCH_ERROR);
  }

  const hiddenIds = [...new Set(plan.hiddenIds)];
  if (hiddenIds.some((id) => !liveIds.has(id))) return err(ORDER_MISMATCH_ERROR);

  const featuredIds = [...new Set(plan.featuredIds)];
  if (featuredIds.some((id) => !liveIds.has(id))) return err(ORDER_MISMATCH_ERROR);
  if (featuredIds.some((id) => hiddenIds.includes(id))) return err(FEATURED_CAP_ERROR);
  if (featuredIds.length > FEATURED_CAP) return err(FEATURED_CAP_ERROR);

  const hiddenSet = new Set(hiddenIds);
  const visibleIds = orderedIds.filter((id) => !hiddenSet.has(id));
  if (visibleIds.length < 1) return err(KEEP_VISIBLE_ERROR);

  const sourceHero = live.find((photo) => photo.hero && !photo.hidden);
  const heroStaysVisible = Boolean(sourceHero && !hiddenSet.has(sourceHero.publicId));
  if (heroStaysVisible && sourceHero && !featuredIds.includes(sourceHero.publicId)) {
    return err(SHARE_UNPIN_ERROR);
  }

  const heroId = heroStaysVisible
    ? sourceHero!.publicId
    : (featuredIds[0] ?? visibleIds[0]);

  const nextFeatured = new Set(featuredIds);
  nextFeatured.add(heroId);
  if (nextFeatured.size > FEATURED_CAP) return err(FEATURED_CAP_ERROR);

  const orderById = new Map(orderedIds.map((id, index) => [id, index]));
  return {
    ok: true,
    value: photos.map((photo) => {
      if (!orderById.has(photo.publicId)) return photo;
      const isHidden = hiddenSet.has(photo.publicId);
      return {
        ...photo,
        order: orderById.get(photo.publicId)!,
        hidden: isHidden,
        hero: !isHidden && photo.publicId === heroId,
        featured: !isHidden && nextFeatured.has(photo.publicId),
      };
    }),
  };
}

export function applySetFeaturedMany(
  photos: CmsPhoto[],
  publicIds: string[],
  featured: boolean,
): MutationResult<CmsPhoto[]> {
  const unique = [...new Set(publicIds)];
  if (unique.length === 0) return err(CHOOSE_PHOTOS_ERROR);
  const hiddenBlocked = rejectHiddenTargets(photos, unique);
  if (hiddenBlocked) return hiddenBlocked;

  if (featured) {
    const featuredCount = featuredCountVisible(photos);
    const toPin = unique.filter((id) => {
      const target = photos.find((photo) => photo.publicId === id);
      return Boolean(target && !target.archived && !target.hidden && !target.featured && !target.hero);
    });
    if (toPin.length === 0) return { ok: true, value: photos };
    if (featuredCount + toPin.length > FEATURED_CAP) {
      return err(FEATURED_CAP_ERROR);
    }

    let next = photos;
    for (const id of toPin) {
      const result = applySetFeatured(next, id, true);
      if (!result.ok) return result;
      next = result.value;
    }
    return { ok: true, value: next };
  }

  const toUnpin = unique.filter((id) => {
    const target = photos.find((photo) => photo.publicId === id);
    return Boolean(target && !target.archived && !target.hidden && target.featured && !target.hero);
  });
  if (toUnpin.length === 0) {
    return err(SHARE_UNPIN_ERROR);
  }

  let next = photos;
  for (const id of toUnpin) {
    const result = applySetFeatured(next, id, false);
    if (!result.ok) return result;
    next = result.value;
  }
  return { ok: true, value: next };
}

export function applyArchiveMany(photos: CmsPhoto[], publicIds: string[]): MutationResult<CmsPhoto[]> {
  const unique = [...new Set(publicIds)];
  if (unique.length === 0) return err(CHOOSE_PHOTOS_ERROR);
  const hiddenBlocked = rejectHiddenTargets(photos, unique);
  if (hiddenBlocked) return hiddenBlocked;

  const visible = visiblePhotos(photos);
  const visibleIds = new Set(visible.map((photo) => photo.publicId));
  const toArchive = unique.filter((id) => visibleIds.has(id));
  if (toArchive.length === 0) return err(NOT_LIVE_ERROR);
  if (visible.length - toArchive.length < 1) {
    return err(KEEP_VISIBLE_ERROR);
  }

  const heroId = visible.find((photo) => photo.hero)?.publicId;
  const ordered = [
    ...toArchive.filter((id) => id !== heroId),
    ...toArchive.filter((id) => id === heroId),
  ];

  let next = photos;
  for (const id of ordered) {
    const result = applyArchive(next, id);
    if (!result.ok) return result;
    next = result.value;
  }
  return { ok: true, value: next };
}

export function tagsFor(photo: CmsPhoto): string[] {
  const tags: string[] = [];
  if (photo.archived) tags.push(ARCHIVED_TAG);
  if (photo.hidden) tags.push(HIDDEN_TAG);
  if (photo.featured) tags.push(FEATURED_TAG);
  if (photo.hero) tags.push(HERO_TAG);
  return tags;
}

export function samePhotoState(left: CmsPhoto, right: CmsPhoto): boolean {
  return (
    left.publicId === right.publicId &&
    left.alt === right.alt &&
    left.order === right.order &&
    left.featured === right.featured &&
    left.hero === right.hero &&
    left.archived === right.archived &&
    left.hidden === right.hidden
  );
}
