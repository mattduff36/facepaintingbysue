import "server-only";

import { unstable_cache } from "next/cache";
import { GALLERY_TAG, PUBLIC_CACHE_SECONDS, SETTINGS_TAG } from "./cache-tags";
import { getCloudName, listGalleryPhotos, readSettings } from "./cloudinary";
import { featuredForMosaic, heroImage, publicImagesWhenSourceFails, rotatingImages, toGalleryImages, type GalleryImage } from "./gallery";
import { DEFAULT_SETTINGS, type SiteSettings } from "./site-settings";
import localManifest from "./gallery-data.json";
import { logoUrl, ogUrl } from "./cloudinary-url";

export interface PublicSite {
  settings: SiteSettings;
  images: GalleryImage[];
  featured: GalleryImage[];
  rotating: GalleryImage[];
  hero?: GalleryImage;
  logoSrc: string;
  ogSrc: string;
}

const cachedCloudinarySite = unstable_cache(
  async (): Promise<PublicSite> => {
    const [photos, settings] = await Promise.all([listGalleryPhotos(), readSettings()]);
    const cloudName = getCloudName();
    const resolved = settings ?? DEFAULT_SETTINGS;
    const images = toGalleryImages(photos, cloudName);
    const featured = featuredForMosaic(images);
    const hero = heroImage(images);
    return {
      settings: resolved,
      images,
      featured,
      rotating: rotatingImages(images, featured),
      hero,
      logoSrc: logoUrl(cloudName, resolved.logoPublicId),
      ogSrc: hero ? ogUrl(cloudName, hero.publicId, undefined) : "/gallery/sue-01.jpg",
    };
  },
  ["public-site"],
  { tags: [GALLERY_TAG, SETTINGS_TAG], revalidate: PUBLIC_CACHE_SECONDS },
);

function localFallback(): PublicSite {
  const images: GalleryImage[] = localManifest.map((item, index) => ({
    publicId: item.src,
    src: item.src,
    lightboxSrc: item.src,
    featured: item.featured,
    hero: item.src === "/gallery/sue-01.jpg",
    hidden: false,
    index,
    alt: "Face-painting design by Sue",
    order: index,
  }));
  const featured = featuredForMosaic(images);
  return {
    settings: DEFAULT_SETTINGS,
    images,
    featured,
    rotating: rotatingImages(images, featured),
    hero: heroImage(images),
    logoSrc: "/images/logo-trans-bg.png",
    ogSrc: "/gallery/sue-01.jpg",
  };
}

export async function getPublicSite(): Promise<PublicSite> {
  try {
    return await cachedCloudinarySite();
  } catch {
    const local = localFallback();
    const images = publicImagesWhenSourceFails(Boolean(process.env.CLOUDINARY_CLOUD_NAME), local.images);
    const featured = featuredForMosaic(images);
    return {
      ...local,
      images,
      featured,
      rotating: rotatingImages(images, featured),
      hero: heroImage(images),
    };
  }
}
