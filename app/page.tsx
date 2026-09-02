import { BusinessCard } from "@/components/business-card";
import { getPublicSite } from "@/lib/public-data";

export const revalidate = 60;

export default async function Home() {
  const site = await getPublicSite();
  return (
    <BusinessCard
      images={site.images}
      featured={site.featured}
      rotating={site.rotating}
      settings={site.settings}
      logoSrc={site.logoSrc}
    />
  );
}
