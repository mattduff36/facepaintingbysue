import { site } from "./site";

export const SETTINGS_PUBLIC_ID = "facepaintingbysue/site-settings";
export const SETTINGS_BACKUP_PUBLIC_ID = "facepaintingbysue/site-settings.prev";
export const LOGO_PUBLIC_ID = "facepaintingbysue/brand/logo";
export const SETTINGS_MAX_BYTES = 32_768;

const ALLOWED_KEYS = [
  "revision",
  "name",
  "tagline",
  "area",
  "email",
  "phoneDisplay",
  "phoneHref",
  "facebook",
  "bookingSubject",
  "bookingBody",
  "seoTitle",
  "seoDescription",
  "availability",
  "logoPublicId",
] as const;

export type SiteSettings = {
  revision: number;
  name: string;
  tagline: string;
  area: string;
  email: string;
  phoneDisplay: string;
  phoneHref: string;
  facebook: string;
  bookingSubject: string;
  bookingBody: string;
  seoTitle: string;
  seoDescription: string;
  availability: string;
  logoPublicId: string;
};

export type SettingsError = { ok: false; error: string };
export type SettingsOk = { ok: true; value: SiteSettings };

const LIMITS: Record<Exclude<keyof SiteSettings, "revision">, number> = {
  name: 80,
  tagline: 160,
  area: 120,
  email: 120,
  phoneDisplay: 40,
  phoneHref: 40,
  facebook: 200,
  bookingSubject: 160,
  bookingBody: 4000,
  seoTitle: 80,
  seoDescription: 300,
  availability: 160,
  logoPublicId: 200,
};

export const DEFAULT_SETTINGS: SiteSettings = {
  revision: 1,
  name: site.name,
  tagline: site.tagline,
  area: site.area,
  email: site.email,
  phoneDisplay: site.phoneDisplay,
  phoneHref: site.phoneHref,
  facebook: site.facebook,
  bookingSubject: "Face painting enquiry",
  bookingBody:
    "Hi Sue,\n\nI'd love to book you for an event. Here are the details:\n\n- Date:\n- Location:\n- Type of event:\n- Approx. number of faces:\n\nThanks!",
  seoTitle: "Facepainting by Sue | Colourful face painting in Burton upon Trent",
  seoDescription:
    "Fun, colourful and professional face painting by Sue for birthdays, fairs, parties and events across Burton upon Trent and beyond.",
  availability: "",
  logoPublicId: LOGO_PUBLIC_ID,
};

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function phoneHrefFromDisplay(phoneDisplay: string, fallback: string): string {
  const digits = phoneDisplay.replace(/\D/g, "");
  if (!digits) return fallback;
  const rest = digits.startsWith("44")
    ? digits.slice(2)
    : digits.startsWith("0")
      ? digits.slice(1)
      : digits;
  if (!rest) return fallback;
  return `tel:+44${rest}`;
}

export function parseSettingsJson(raw: string): SettingsOk | SettingsError {
  if (Buffer.byteLength(raw, "utf8") > SETTINGS_MAX_BYTES) {
    return { ok: false, error: "Those details are too large to save." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Site details are not valid." };
  }

  return validateSettings(parsed);
}

export function validateSettings(input: unknown): SettingsOk | SettingsError {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Site details are not valid." };
  }

  const record = input as Record<string, unknown>;
  const keys = Object.keys(record);
  const unknown = keys.filter((key) => !ALLOWED_KEYS.includes(key as (typeof ALLOWED_KEYS)[number]));
  if (unknown.length > 0) {
    return { ok: false, error: "Site details include a field that cannot be saved." };
  }

  for (const key of ALLOWED_KEYS) {
    if (!(key in record)) {
      return { ok: false, error: "Site details are missing a required field." };
    }
  }

  if (typeof record.revision !== "number" || !Number.isInteger(record.revision) || record.revision < 1) {
    return { ok: false, error: "Site details are not valid." };
  }

  const next = { revision: record.revision } as SiteSettings;
  for (const key of Object.keys(LIMITS) as Array<keyof typeof LIMITS>) {
    const value = record[key];
    if (typeof value !== "string") {
      return { ok: false, error: "Site details are not valid." };
    }
    if (value.length > LIMITS[key]) {
      return { ok: false, error: "One of the fields is too long." };
    }
    next[key] = value;
  }

  if (!isEmail(next.email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!isHttpUrl(next.facebook)) {
    return { ok: false, error: "Enter a full Facebook link, starting with https://." };
  }
  if (!next.phoneHref.startsWith("tel:")) {
    return { ok: false, error: "Phone link must start with tel:." };
  }
  if (!next.logoPublicId.startsWith("facepaintingbysue/")) {
    return { ok: false, error: "Logo is not valid." };
  }

  return { ok: true, value: next };
}

export function assertCurrentRevision(
  incoming: SiteSettings,
  current: SiteSettings,
): SettingsError | { ok: true } {
  if (incoming.revision !== current.revision) {
    return {
      ok: false,
      error: "Someone else saved site details. Refresh the page and try again.",
    };
  }
  return { ok: true };
}

export function nextSettings(current: SiteSettings, patch: Omit<SiteSettings, "revision">): SiteSettings {
  return { ...patch, revision: current.revision + 1 };
}

export function settingsEqual(left: SiteSettings, right: SiteSettings): boolean {
  return ALLOWED_KEYS.every((key) => left[key] === right[key]);
}

export function bookingMailto(settings: SiteSettings): string {
  return `mailto:${settings.email}?subject=${encodeURIComponent(
    settings.bookingSubject,
  )}&body=${encodeURIComponent(settings.bookingBody)}`;
}
