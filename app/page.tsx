import { BusinessCard } from "@/components/business-card";
import { DESKTOP_TILE_COUNT, galleryImages, getTileImages } from "@/lib/gallery";

export default function Home() {
  const tiles = getTileImages(DESKTOP_TILE_COUNT);
  return <BusinessCard images={galleryImages} tiles={tiles} />;
}
