import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  SESSION_TTL_SECONDS,
  adminCookieName,
  readAdminEnv,
  type AdminEnv,
} from "./admin-env";

export class AuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthError";
  }
}

export interface SessionPayload {
  exp: number;
}

export function digestEqual(left: string, right: string): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

export function matchAccount(
  inputUser: string,
  inputPassword: string,
  env: AdminEnv,
): AdminEnv["accounts"][number] | null {
  const user = inputUser.trim();
  let matched: AdminEnv["accounts"][number] | null = null;
  for (const account of env.accounts) {
    const userOk = digestEqual(user, account.username);
    const passOk = digestEqual(inputPassword, account.password);
    if (userOk && passOk) matched = account;
  }
  return matched;
}

export function credentialsMatch(
  inputUser: string,
  inputPassword: string,
  env: AdminEnv,
): boolean {
  return matchAccount(inputUser, inputPassword, env) !== null;
}

function usernameKnown(username: string, env: AdminEnv): boolean {
  let known = false;
  for (const account of env.accounts) {
    if (digestEqual(username, account.username)) known = true;
  }
  return known;
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function signaturesEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function createSessionValue(
  env: AdminEnv,
  now = Date.now(),
  ttlSeconds = SESSION_TTL_SECONDS,
  username = env.accounts[0]?.username ?? "",
): string {
  const exp = Math.floor(now / 1000) + ttlSeconds;
  const payload = `v1.${username}.${exp}`;
  return `${payload}.${sign(payload, env.secret)}`;
}

export function verifySessionValue(
  raw: string | undefined,
  env: AdminEnv,
  now = Date.now(),
): SessionPayload | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 4) return null;
  const [version, username, expRaw, signature] = parts;
  if (version !== "v1" || !username || !expRaw || !signature) return null;
  if (!/^\d+$/.test(expRaw)) return null;

  const payload = `${version}.${username}.${expRaw}`;
  const expected = sign(payload, env.secret);
  if (!signaturesEqual(signature, expected)) return null;
  if (!usernameKnown(username, env)) return null;

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp <= Math.floor(now / 1000)) return null;
  return { exp };
}

export function sessionCookieOptions(isHttps: boolean) {
  const useHost = isHttps;
  return {
    name: adminCookieName(useHost),
    httpOnly: true,
    secure: useHttps(isHttps),
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

function useHttps(isHttps: boolean): boolean {
  return isHttps;
}

export function readAdminEnvOrThrow(env: NodeJS.ProcessEnv = process.env) {
  return readAdminEnv(env);
}
