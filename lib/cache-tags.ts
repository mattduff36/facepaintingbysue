export const GALLERY_TAG = "gallery";
export const SETTINGS_TAG = "site-settings";
export const PUBLIC_CACHE_SECONDS = 60;

export function tagsToExpire(kind: "gallery" | "settings" | "both"): string[] {
  if (kind === "gallery") return [GALLERY_TAG];
  if (kind === "settings") return [SETTINGS_TAG];
  return [GALLERY_TAG, SETTINGS_TAG];
}

export function shouldExpireCaches(verified: boolean, mutationOk: boolean): boolean {
  return verified && mutationOk;
}
