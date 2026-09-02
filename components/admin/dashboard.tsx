"use client";

import { useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { GalleryImage } from "@/lib/gallery";
import type { SiteSettings } from "@/lib/site-settings";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/admin/actions";
import { BrandMark } from "@/components/brand-mark";
import { HowThisWorks } from "./how-this-works";
import { HomepagePreview } from "./homepage-preview";
import { PhotoManager } from "./photo-manager";
import { SiteForm } from "./site-form";
import { studioMutationAllowed } from "@/lib/studio-layout";
import type { StudioRun } from "./studio-types";

const ADMIN_TABS = ["photos", "homepage", "settings", "guide"] as const;
type AdminTab = (typeof ADMIN_TABS)[number];

export function AdminDashboard({
  images: initialImages,
  settings,
  logoSrc,
}: {
  images: GalleryImage[];
  settings: SiteSettings;
  logoSrc: string;
}) {
  const router = useRouter();
  const [images, setImages] = useState(initialImages);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [logoutPending, startLogout] = useTransition();
  const [tab, setTab] = useState<AdminTab>("photos");
  const photosTabRef = useRef<HTMLButtonElement>(null);
  const homepageTabRef = useRef<HTMLButtonElement>(null);
  const settingsTabRef = useRef<HTMLButtonElement>(null);
  const guideTabRef = useRef<HTMLButtonElement>(null);
  const tabRefs: Record<AdminTab, typeof photosTabRef> = {
    photos: photosTabRef,
    homepage: homepageTabRef,
    settings: settingsTabRef,
    guide: guideTabRef,
  };

  const run: StudioRun = (label, work, next) => {
    if (!studioMutationAllowed(pending)) return;
    setError("");
    setMessage("");
    const previous = images;
    if (next) setImages(next);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        setImages(previous);
        setError(result.error ?? "That change could not be saved.");
        return;
      }
      if (label) setMessage(label);
    });
  };

  function selectTab(next: AdminTab) {
    setTab(next);
    tabRefs[next].current?.focus();
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, current: AdminTab) {
    const index = ADMIN_TABS.indexOf(current);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      selectTab(ADMIN_TABS[(index + 1) % ADMIN_TABS.length]);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectTab(ADMIN_TABS[(index - 1 + ADMIN_TABS.length) % ADMIN_TABS.length]);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      selectTab(ADMIN_TABS[0]);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      selectTab(ADMIN_TABS[ADMIN_TABS.length - 1]);
    }
  }

  const wide = tab === "photos" || tab === "homepage";

  return (
    <div className={`admin-shell ${wide ? "is-photos" : "is-settings"}`}>
      <header className="admin-topbar">
        <div className="admin-topbar-bar">
          <h1>
            <BrandMark logoSrc={logoSrc} />
          </h1>
          <nav className="admin-topbar-nav" aria-label="Studio">
            <button
              type="button"
              className="admin-icon-btn"
              disabled={logoutPending}
              aria-label="Sign out"
              title="Sign out"
              onClick={() =>
                startLogout(async () => {
                  const result = await logoutAction();
                  if (result.ok) {
                    router.replace("/");
                    return;
                  }
                  setError(result.error ?? "Could not sign out.");
                })
              }
            >
              <LogOut className="admin-nav-icon" aria-hidden />
            </button>
          </nav>
        </div>
        <div className="admin-tabs" role="tablist" aria-label="Studio sections">
          <button
            ref={photosTabRef}
            type="button"
            role="tab"
            id="admin-tab-photos"
            className="admin-tab"
            aria-selected={tab === "photos"}
            aria-controls="admin-panel-photos"
            tabIndex={tab === "photos" ? 0 : -1}
            onClick={() => setTab("photos")}
            onKeyDown={(event) => onTabKeyDown(event, "photos")}
          >
            Photos
          </button>
          <button
            ref={homepageTabRef}
            type="button"
            role="tab"
            id="admin-tab-homepage"
            className="admin-tab"
            aria-selected={tab === "homepage"}
            aria-controls="admin-panel-homepage"
            tabIndex={tab === "homepage" ? 0 : -1}
            onClick={() => setTab("homepage")}
            onKeyDown={(event) => onTabKeyDown(event, "homepage")}
          >
            Homepage
          </button>
          <button
            ref={settingsTabRef}
            type="button"
            role="tab"
            id="admin-tab-settings"
            className="admin-tab"
            aria-selected={tab === "settings"}
            aria-controls="admin-panel-settings"
            tabIndex={tab === "settings" ? 0 : -1}
            onClick={() => setTab("settings")}
            onKeyDown={(event) => onTabKeyDown(event, "settings")}
          >
            Site settings
          </button>
          <button
            ref={guideTabRef}
            type="button"
            role="tab"
            id="admin-tab-guide"
            className="admin-tab"
            aria-selected={tab === "guide"}
            aria-controls="admin-panel-guide"
            tabIndex={tab === "guide" ? 0 : -1}
            onClick={() => setTab("guide")}
            onKeyDown={(event) => onTabKeyDown(event, "guide")}
          >
            How this works
          </button>
        </div>
      </header>

      <div
        role="tabpanel"
        id="admin-panel-photos"
        aria-labelledby="admin-tab-photos"
        hidden={tab !== "photos"}
        className="admin-panel"
      >
        <PhotoManager images={images} pending={pending} error={error} message={message} run={run} />
      </div>
      <div
        role="tabpanel"
        id="admin-panel-homepage"
        aria-labelledby="admin-tab-homepage"
        hidden={tab !== "homepage"}
        className="admin-panel"
      >
        <HomepagePreview
          images={images}
          settings={settings}
          logoSrc={logoSrc}
          pending={pending}
          error={error}
          message={message}
          run={run}
        />
      </div>
      <div
        role="tabpanel"
        id="admin-panel-settings"
        aria-labelledby="admin-tab-settings"
        hidden={tab !== "settings"}
        className="admin-panel admin-panel-settings"
      >
        <SiteForm settings={settings} logoSrc={logoSrc} />
      </div>
      <div
        role="tabpanel"
        id="admin-panel-guide"
        aria-labelledby="admin-tab-guide"
        hidden={tab !== "guide"}
        className="admin-panel admin-panel-guide"
      >
        <HowThisWorks />
      </div>
    </div>
  );
}
