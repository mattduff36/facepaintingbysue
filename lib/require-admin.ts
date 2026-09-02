import "server-only";

import { cookies, headers } from "next/headers";
import { AuthError, readAdminEnvOrThrow, sessionCookieOptions, verifySessionValue } from "./auth";

export async function requestIsHttps(): Promise<boolean> {
  const headerStore = await headers();
  const proto = headerStore.get("x-forwarded-proto") ?? headerStore.get("x-forwarded-protocol");
  if (proto) return proto.split(",")[0].trim() === "https";
  return process.env.NODE_ENV === "production";
}

export async function requireAdmin(): Promise<void> {
  const env = readAdminEnvOrThrow();
  const isHttps = await requestIsHttps();
  const { name } = sessionCookieOptions(isHttps);
  const jar = await cookies();
  const raw = jar.get(name)?.value ?? jar.get(sessionCookieOptions(false).name)?.value;
  if (!verifySessionValue(raw, env)) {
    throw new AuthError();
  }
}

export async function hasAdminSession(): Promise<boolean> {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}
