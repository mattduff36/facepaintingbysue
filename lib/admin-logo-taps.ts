export const ADMIN_LOGO_TAPS = 5;
export const ADMIN_LOGO_WINDOW_MS = 3000;

export function recordLogoTap(
  previous: number[],
  now: number,
  windowMs = ADMIN_LOGO_WINDOW_MS,
  needed = ADMIN_LOGO_TAPS,
): { times: number[]; unlocked: boolean } {
  const times = [...previous.filter((stamp) => now - stamp <= windowMs), now];
  if (times.length >= needed) {
    return { times: [], unlocked: true };
  }
  return { times, unlocked: false };
}
