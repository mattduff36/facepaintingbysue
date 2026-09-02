const MIN_SECRET_LENGTH = 32;
const MIN_PASSWORD_LENGTH = 8;
const MAX_ADMIN_ACCOUNTS = 20;

export class AdminConfigError extends Error {
  constructor(message = "Admin auth is not configured") {
    super(message);
    this.name = "AdminConfigError";
  }
}

export interface AdminAccount {
  username: string;
  password: string;
}

export interface AdminEnv {
  accounts: AdminAccount[];
  secret: string;
}

function readPair(
  env: NodeJS.ProcessEnv,
  userKey: string,
  passKey: string,
): AdminAccount | "absent" {
  const username = env[userKey]?.trim() ?? "";
  const password = env[passKey] ?? "";
  if (!username && !password) return "absent";
  if (!username || password.length < MIN_PASSWORD_LENGTH) {
    throw new AdminConfigError();
  }
  if (username.includes(".")) {
    throw new AdminConfigError();
  }
  return { username, password };
}

export function readAdminEnv(
  env: NodeJS.ProcessEnv = process.env,
): AdminEnv {
  const secret = env.ADMIN_SESSION_SECRET ?? "";
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new AdminConfigError();
  }

  const accounts: AdminAccount[] = [];
  const first = readPair(env, "ADMIN_USERNAME", "ADMIN_PASSWORD");
  const numberedFirst = readPair(env, "ADMIN_USERNAME_1", "ADMIN_PASSWORD_1");

  if (first !== "absent") accounts.push(first);
  if (numberedFirst !== "absent") {
    if (first !== "absent" && first.username === numberedFirst.username) {
      if (first.password !== numberedFirst.password) throw new AdminConfigError();
    } else {
      accounts.push(numberedFirst);
    }
  }

  for (let index = 2; index <= MAX_ADMIN_ACCOUNTS; index += 1) {
    const pair = readPair(env, `ADMIN_USERNAME_${index}`, `ADMIN_PASSWORD_${index}`);
    if (pair === "absent") continue;
    accounts.push(pair);
  }

  if (accounts.length === 0) {
    throw new AdminConfigError();
  }

  const seen = new Set<string>();
  for (const account of accounts) {
    if (seen.has(account.username)) throw new AdminConfigError();
    seen.add(account.username);
  }

  return { accounts, secret };
}

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
export const DEV_COOKIE_NAME = "fpbs-admin";
export const HOST_COOKIE_NAME = "__Host-fpbs-admin";

export function adminCookieName(secureHostCookie: boolean): string {
  return secureHostCookie ? HOST_COOKIE_NAME : DEV_COOKIE_NAME;
}
