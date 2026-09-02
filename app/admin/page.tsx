import { getCloudName, listGalleryPhotos, readSettings } from "@/lib/cloudinary";
import { toAdminGalleryImages } from "@/lib/gallery";
import { DEFAULT_SETTINGS } from "@/lib/site-settings";
import { logoUrl } from "@/lib/cloudinary-url";
import { hasAdminSession } from "@/lib/require-admin";
import { AdminDashboard } from "@/components/admin/dashboard";
import { LoginForm } from "@/components/admin/login-form";

async function loadStudioChrome() {
  let settings = DEFAULT_SETTINGS;
  let logoSrc = "/images/logo-trans-bg.png";
  try {
    const stored = await readSettings();
    const cloudName = getCloudName();
    settings = stored ?? DEFAULT_SETTINGS;
    logoSrc = logoUrl(cloudName, settings.logoPublicId);
  } catch {
    // Keep the local logo so login and the topbar still have a mark.
  }
  return { settings, logoSrc };
}

export default async function AdminPage() {
  const signedIn = await hasAdminSession();
  const chrome = await loadStudioChrome();

  if (!signedIn) {
    return (
      <main className="admin-login-page">
        <LoginForm logoSrc={chrome.logoSrc} />
      </main>
    );
  }

  let images = toAdminGalleryImages([], "");
  let settings = chrome.settings;
  let logoSrc = chrome.logoSrc;
  let loadError = "";

  try {
    const photos = await listGalleryPhotos();
    images = toAdminGalleryImages(photos, getCloudName());
  } catch {
    loadError = "Photos could not be loaded. Refresh to try again.";
  }

  return (
    <main className="admin-page">
      <AdminDashboard
        images={images}
        settings={settings}
        logoSrc={logoSrc}
        loadError={loadError}
      />
    </main>
  );
}
