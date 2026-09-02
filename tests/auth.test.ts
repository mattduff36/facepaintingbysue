import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AuthError,
  createSessionValue,
  credentialsMatch,
  sessionCookieOptions,
  verifySessionValue,
} from "../lib/auth";
import { HOST_COOKIE_NAME, SESSION_TTL_SECONDS, readAdminEnv } from "../lib/admin-env";
import { logoutCookiePatches } from "../lib/write-verify";

const env = {
  accounts: [{ username: "sue", password: "longenough" }],
  secret: "s".repeat(32),
};

const multiEnv = {
  accounts: [
    { username: "sue", password: "longenough" },
    { username: "matt", password: "alsolong1" },
  ],
  secret: "s".repeat(32),
};

describe("T-auth-login", () => {
  it("valid credentials create a verifiable seven-day cookie with required attributes", () => {
    assert.equal(credentialsMatch("sue", "longenough", env), true);
    assert.equal(credentialsMatch("sue", "wrong-password", env), false);
    assert.equal(credentialsMatch("other", "longenough", env), false);

    const now = 1_700_000_000_000;
    const value = createSessionValue(env, now);
    const session = verifySessionValue(value, env, now);
    assert.ok(session);
    assert.equal(session.exp, Math.floor(now / 1000) + SESSION_TTL_SECONDS);

    const https = sessionCookieOptions(true);
    assert.equal(https.name, HOST_COOKIE_NAME);
    assert.equal(https.httpOnly, true);
    assert.equal(https.secure, true);
    assert.equal(https.sameSite, "lax");
    assert.equal(https.path, "/");
    assert.equal(https.maxAge, SESSION_TTL_SECONDS);

    const http = sessionCookieOptions(false);
    assert.notEqual(http.name, HOST_COOKIE_NAME);
    assert.equal(http.httpOnly, true);
    assert.equal(http.secure, false);
  });

  it("accepts any configured username and password pair", () => {
    assert.equal(credentialsMatch("matt", "alsolong1", multiEnv), true);
    assert.equal(credentialsMatch("sue", "longenough", multiEnv), true);
    assert.equal(credentialsMatch("sue", "alsolong1", multiEnv), false);
    assert.equal(credentialsMatch("matt", "longenough", multiEnv), false);

    const now = 1_700_000_000_000;
    const mattSession = createSessionValue(multiEnv, now, SESSION_TTL_SECONDS, "matt");
    assert.ok(verifySessionValue(mattSession, multiEnv, now));
    assert.equal(verifySessionValue(mattSession, env, now), null);
  });

  it("logout clears both cookies including the Secure __Host- cookie", () => {
    const patches = logoutCookiePatches();
    const host = patches.find((patch) => patch.name === HOST_COOKIE_NAME);
    assert.ok(host);
    assert.equal(host.secure, true);
    assert.equal(host.httpOnly, true);
    assert.equal(host.path, "/");
    assert.equal(host.maxAge, 0);
    assert.equal(host.value, "");
  });
});

describe("T-auth-reject", () => {
  it("tampered, expired, missing, and malformed sessions cannot invoke a Cloudinary mutation", () => {
    const now = 1_700_000_000_000;
    const valid = createSessionValue(env, now);
    let sdkCalls = 0;
    const sdk = () => {
      sdkCalls += 1;
    };

    function guarded(cookie: string | undefined) {
      if (!verifySessionValue(cookie, env, now)) throw new AuthError();
      sdk();
    }

    assert.throws(() => guarded(undefined), AuthError);
    assert.throws(() => guarded(""), AuthError);
    assert.throws(() => guarded("not-a-session"), AuthError);
    assert.throws(() => guarded(valid.slice(0, -2) + "ff"), AuthError);
    assert.throws(() => guarded(createSessionValue(env, now - SESSION_TTL_SECONDS * 1000 - 1000)), AuthError);
    assert.equal(sdkCalls, 0);

    guarded(valid);
    assert.equal(sdkCalls, 1);
  });

  it("fails closed when admin env is missing or weak", () => {
    assert.throws(() => readAdminEnv({}));
    assert.throws(() => readAdminEnv({ ADMIN_USERNAME: "sue", ADMIN_PASSWORD: "short", ADMIN_SESSION_SECRET: "s".repeat(32) }));
    assert.throws(() => readAdminEnv({ ADMIN_USERNAME: "sue", ADMIN_PASSWORD: "longenough", ADMIN_SESSION_SECRET: "too-short" }));
    assert.throws(() =>
      readAdminEnv({
        ADMIN_USERNAME: "sue",
        ADMIN_PASSWORD: "longenough",
        ADMIN_USERNAME_2: "sue",
        ADMIN_PASSWORD_2: "otherlong",
        ADMIN_SESSION_SECRET: "s".repeat(32),
      }),
    );
    assert.throws(() =>
      readAdminEnv({
        ADMIN_USERNAME: "sue.admin",
        ADMIN_PASSWORD: "longenough",
        ADMIN_SESSION_SECRET: "s".repeat(32),
      }),
    );

    const two = readAdminEnv({
      ADMIN_USERNAME: "sue",
      ADMIN_PASSWORD: "longenough",
      ADMIN_USERNAME_2: "matt",
      ADMIN_PASSWORD_2: "alsolong1",
      ADMIN_SESSION_SECRET: "s".repeat(32),
    });
    assert.equal(two.accounts.length, 2);
    assert.equal(two.accounts[1].username, "matt");
  });
});
