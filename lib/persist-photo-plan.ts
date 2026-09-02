import { samePhotoState, type CmsPhoto } from "./gallery-invariants";

export async function persistPlannedPhotos(input: {
  before: Map<string, CmsPhoto>;
  planned: CmsPhoto[];
  persist: (photo: CmsPhoto) => Promise<CmsPhoto>;
  beforeEach?: () => Promise<void>;
}): Promise<{ ok: true } | { ok: false; incompleteRollback: boolean }> {
  const changed = input.planned.filter((photo) => {
    const previous = input.before.get(photo.publicId);
    return !previous || !samePhotoState(previous, photo);
  });

  const applied: CmsPhoto[] = [];
  try {
    for (const photo of changed) {
      if (input.beforeEach) await input.beforeEach();
      applied.push(photo);
      const verified = await input.persist(photo);
      if (!samePhotoState({ ...photo, version: verified.version }, verified)) {
        throw new Error("verify");
      }
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.name === "StudioLockLostError") throw error;
    let incompleteRollback = false;
    for (const photo of applied) {
      const original = input.before.get(photo.publicId);
      if (!original) {
        incompleteRollback = true;
        continue;
      }
      try {
        const restored = await input.persist(original);
        if (!samePhotoState({ ...original, version: restored.version }, restored)) {
          incompleteRollback = true;
        }
      } catch {
        incompleteRollback = true;
      }
    }
    return { ok: false, incompleteRollback };
  }
}
