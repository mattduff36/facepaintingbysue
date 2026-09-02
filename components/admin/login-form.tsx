"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "@/app/admin/actions";
import { BrandMark } from "@/components/brand-mark";
import { ViewSiteLink } from "./view-site-link";

export function LoginForm({ logoSrc }: { logoSrc: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="admin-login"
      action={(formData) => {
        setError("");
        startTransition(async () => {
          const result = await loginAction(formData);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.refresh();
        });
      }}
    >
      <span className="admin-dot admin-dot-red" aria-hidden />
      <span className="admin-dot admin-dot-teal" aria-hidden />

      <h1>
        <BrandMark logoSrc={logoSrc} size="login" />
      </h1>
      <p>Sign in to add photos and keep the site details up to date.</p>

      <label>
        Username
        <input
          name="username"
          type="text"
          autoComplete="username"
          required
          disabled={pending}
        />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
        />
      </label>

      {error ? (
        <p className="admin-error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <p className="admin-login-nav">
        <ViewSiteLink />
      </p>
    </form>
  );
}
