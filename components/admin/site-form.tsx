"use client";

import { useState, useTransition } from "react";
import { phoneHrefFromDisplay, type SiteSettings } from "@/lib/site-settings";
import { replaceLogoAction, saveSettingsAction } from "@/app/admin/actions";

export function SiteForm({ settings, logoSrc }: { settings: SiteSettings; logoSrc: string }) {
  const [draft, setDraft] = useState(settings);
  const [preview, setPreview] = useState(logoSrc);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function field<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="admin-section" aria-labelledby="site-heading">
      <header className="admin-section-head">
        <div>
          <h2 id="site-heading">Site details</h2>
          <p>These appear on the homepage card, the booking email, and Google.</p>
        </div>
      </header>

      {error ? <p className="admin-error" role="alert">{error}</p> : null}
      {message ? <p className="admin-ok" role="status">{message}</p> : null}

      <form
        className="admin-site-form"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          setMessage("");
          startTransition(async () => {
            const result = await saveSettingsAction(draft);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setDraft((current) => ({ ...current, revision: current.revision + 1 }));
            setMessage("Site details saved.");
          });
        }}
      >
        <fieldset>
          <legend>Contact</legend>
          <label>
            Phone
            <input
              value={draft.phoneDisplay}
              onChange={(event) => {
                const phoneDisplay = event.target.value;
                field("phoneDisplay", phoneDisplay);
                field("phoneHref", phoneHrefFromDisplay(phoneDisplay, draft.phoneHref));
              }}
            />
          </label>
          <label>
            Email
            <input type="email" value={draft.email} onChange={(event) => field("email", event.target.value)} />
          </label>
          <label>
            Facebook
            <input value={draft.facebook} onChange={(event) => field("facebook", event.target.value)} />
          </label>
          <label>
            Area
            <input value={draft.area} onChange={(event) => field("area", event.target.value)} />
          </label>
        </fieldset>

        <fieldset>
          <legend>On the card</legend>
          <label>
            Tagline
            <input value={draft.tagline} onChange={(event) => field("tagline", event.target.value)} />
          </label>
          <label>
            Availability note
            <input
              value={draft.availability}
              placeholder="Optional — e.g. Now booking for summer fairs"
              onChange={(event) => field("availability", event.target.value)}
            />
          </label>
          <div className="admin-logo-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Current logo" />
            <label className="admin-upload">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={pending}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  const data = new FormData();
                  data.set("file", file);
                  startTransition(async () => {
                    const result = await replaceLogoAction(data);
                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }
                    if (result.data?.logoSrc) setPreview(result.data.logoSrc);
                    setMessage("Logo updated.");
                  });
                }}
              />
              Replace logo
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Booking email</legend>
          <label>
            Subject
            <input value={draft.bookingSubject} onChange={(event) => field("bookingSubject", event.target.value)} />
          </label>
          <label>
            Message
            <textarea
              rows={8}
              value={draft.bookingBody}
              onChange={(event) => field("bookingBody", event.target.value)}
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>Google and sharing</legend>
          <label>
            Page title
            <input value={draft.seoTitle} onChange={(event) => field("seoTitle", event.target.value)} />
          </label>
          <label>
            Description
            <textarea
              rows={3}
              value={draft.seoDescription}
              onChange={(event) => field("seoDescription", event.target.value)}
            />
          </label>
        </fieldset>

        <button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save site details"}
        </button>
      </form>
    </section>
  );
}
