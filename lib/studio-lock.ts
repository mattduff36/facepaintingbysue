import { applyUploadSlot, type CmsPhoto } from "./gallery-invariants";
import { assertCurrentRevision, type SiteSettings } from "./site-settings";

export const STUDIO_LOCK_PUBLIC_ID = "facepaintingbysue/studio-lock";
export const STUDIO_LOCK_TTL_MS = 20_000;
export const STUDIO_BUSY_ERROR = "Someone else is saving. Wait a moment and try again.";
export const STUDIO_STALE_ERROR = "Someone else saved. Refresh and try again.";

export interface StudioLock {
  token: string;
  expiresAt: number;
}

export interface FingerprintPhoto {
  publicId: string;
  alt: string;
  storedAlt?: string;
  order: number;
  featured: boolean;
  hero: boolean;
  hidden: boolean;
  version?: number;
}

export type LockRead =
  | { kind: "absent" }
  | { kind: "lock"; value: StudioLock }
  | { kind: "uncertain" };

export function interpretLockRead(raw: string | null | undefined): LockRead {
  if (raw == null || raw === "") return { kind: "absent" };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { kind: "uncertain" };
    const record = parsed as Record<string, unknown>;
    if (record.token === "" && record.expiresAt === 0) return { kind: "absent" };
    if (typeof record.token !== "string" || !record.token) return { kind: "uncertain" };
    if (typeof record.expiresAt !== "number" || !Number.isFinite(record.expiresAt)) return { kind: "uncertain" };
    return { kind: "lock", value: { token: record.token, expiresAt: record.expiresAt } };
  } catch {
    return { kind: "uncertain" };
  }
}

export function parseStudioLock(raw: string | null | undefined): StudioLock | null {
  const read = interpretLockRead(raw);
  return read.kind === "lock" ? read.value : null;
}

export function serializeStudioLock(lock: StudioLock): string {
  return JSON.stringify(lock);
}

export function lockHeldByOther(lock: StudioLock | null, token: string, now: number): boolean {
  if (!lock || !lock.token) return false;
  if (lock.expiresAt <= now) return false;
  return lock.token !== token;
}

export function lockOwnedBy(lock: StudioLock | null, token: string, now: number): boolean {
  return Boolean(lock && lock.token === token && lock.expiresAt > now);
}

export function decideLockAcquire(
  current: StudioLock | null,
  token: string,
  now: number,
  ttlMs = STUDIO_LOCK_TTL_MS,
): { ok: true; lock: StudioLock } | { ok: false; error: string } {
  if (lockHeldByOther(current, token, now)) {
    return { ok: false, error: STUDIO_BUSY_ERROR };
  }
  return { ok: true, lock: { token, expiresAt: now + ttlMs } };
}

export function galleryFingerprint(photos: FingerprintPhoto[]): string {
  return [...photos]
    .sort((left, right) => left.publicId.localeCompare(right.publicId))
    .map((photo) =>
      [
        photo.publicId,
        photo.version ?? "",
        photo.order,
        photo.featured ? "1" : "0",
        photo.hero ? "1" : "0",
        photo.hidden ? "1" : "0",
        photo.storedAlt ?? photo.alt,
      ].join("\t"),
    )
    .join("\n");
}

export function rejectIfGalleryStale(
  before: FingerprintPhoto[],
  live: FingerprintPhoto[],
): { ok: true } | { ok: false; error: string } {
  if (galleryFingerprint(before) !== galleryFingerprint(live)) {
    return { ok: false, error: STUDIO_STALE_ERROR };
  }
  return { ok: true };
}

export function prepareSettingsSave(incoming: SiteSettings, live: SiteSettings) {
  return assertCurrentRevision(incoming, live);
}

export function prepareUploadOnLiveList(photos: CmsPhoto[]) {
  return applyUploadSlot(photos);
}

export function expireAfterSuccess(expire: () => void): void {
  try {
    expire();
  } catch {
    // Cache expiry must not turn a verified write into a user-facing failure.
  }
}

export function shouldReloadStudio(error: string): boolean {
  return (
    error === STUDIO_BUSY_ERROR ||
    error === STUDIO_STALE_ERROR ||
    error.startsWith("Someone else saved")
  );
}

export interface StudioLockStore {
  read: () => Promise<string | null>;
  write: (json: string) => Promise<void>;
}

export class StudioLockLostError extends Error {
  constructor() {
    super(STUDIO_BUSY_ERROR);
    this.name = "StudioLockLostError";
  }
}

async function readLock(store: StudioLockStore): Promise<LockRead> {
  return interpretLockRead(await store.read());
}

export async function acquireStudioLock(
  token: string,
  store: StudioLockStore,
  now = Date.now(),
  ttlMs = STUDIO_LOCK_TTL_MS,
  clock: () => number = Date.now,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const currentRead = await readLock(store);
    if (currentRead.kind === "uncertain") return { ok: false, error: STUDIO_BUSY_ERROR };
    const current = currentRead.kind === "lock" ? currentRead.value : null;
    const decision = decideLockAcquire(current, token, now, ttlMs);
    if (!decision.ok) return decision;
    await store.write(serializeStudioLock(decision.lock));
    const confirmed = await readLock(store);
    if (confirmed.kind !== "lock" || !lockOwnedBy(confirmed.value, token, clock())) {
      return { ok: false, error: STUDIO_BUSY_ERROR };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: STUDIO_BUSY_ERROR };
  }
}

export async function renewStudioLock(
  token: string,
  store: StudioLockStore,
  now = Date.now(),
  ttlMs = STUDIO_LOCK_TTL_MS,
  clock: () => number = Date.now,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const current = await readLock(store);
    if (current.kind === "uncertain") return { ok: false, error: STUDIO_BUSY_ERROR };
    const held = current.kind === "lock" ? current.value : null;
    if (!lockOwnedBy(held, token, clock())) {
      return { ok: false, error: STUDIO_BUSY_ERROR };
    }
    await store.write(serializeStudioLock({ token, expiresAt: clock() + ttlMs }));
    const confirmed = await readLock(store);
    if (confirmed.kind !== "lock" || !lockOwnedBy(confirmed.value, token, clock())) {
      return { ok: false, error: STUDIO_BUSY_ERROR };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: STUDIO_BUSY_ERROR };
  }
}

export async function releaseStudioLock(
  token: string,
  store: StudioLockStore,
  now = Date.now(),
  clock: () => number = Date.now,
): Promise<void> {
  try {
    const current = await readLock(store);
    if (current.kind !== "lock") return;
    if (!lockOwnedBy(current.value, token, clock())) return;
    await store.write(serializeStudioLock({ token: "", expiresAt: 0 }));
  } catch {
    // TTL covers a failed release.
  }
}
