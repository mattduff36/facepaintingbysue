import { settingsEqual, type SiteSettings } from "./site-settings";
import { sessionCookieOptions } from "./auth";

export function settingsWriteVerified(input: {
  next: SiteSettings;
  previous: SiteSettings | null;
  written: SiteSettings | null;
  backup: SiteSettings | null;
}): boolean {
  if (!input.written || !settingsEqual(input.written, input.next)) return false;
  if (input.previous && (!input.backup || !settingsEqual(input.backup, input.previous))) {
    return false;
  }
  return true;
}

export function logoWriteVerified(
  before: { version?: number } | null,
  after: { version?: number } | null,
): boolean {
  if (!after || typeof after.version !== "number") return false;
  if (!before) return true;
  if (typeof before.version !== "number") return false;
  return after.version !== before.version;
}

export function logoutCookiePatches() {
  return [true, false].map((secure) => {
    const options = sessionCookieOptions(secure);
    return {
      name: options.name,
      value: "",
      httpOnly: true,
      secure: options.secure,
      sameSite: options.sameSite,
      path: options.path,
      maxAge: 0,
    };
  });
}

export async function writeSettingsPipeline(input: {
  next: SiteSettings;
  previous: SiteSettings | null;
  writeBackup: (settings: SiteSettings) => Promise<void>;
  readBackup: () => Promise<SiteSettings | null>;
  writeMain: (settings: SiteSettings) => Promise<void>;
  readMain: () => Promise<SiteSettings | null>;
}): Promise<void> {
  let backup: SiteSettings | null = null;
  if (input.previous) {
    await input.writeBackup(input.previous);
    backup = await input.readBackup();
    if (!backup || !settingsEqual(backup, input.previous)) {
      throw new Error("Settings backup could not be verified");
    }
  }

  await input.writeMain(input.next);
  const written = await input.readMain();
  if (!settingsWriteVerified({ next: input.next, previous: input.previous, written, backup })) {
    throw new Error("Settings write could not be verified");
  }
}
